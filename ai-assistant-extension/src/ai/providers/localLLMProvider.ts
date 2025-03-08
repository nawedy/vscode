/**
 * Local LLM Provider
 *
 * Provider implementation for locally-hosted language models through LM Studio, Ollama, or similar services.
 */

import * as vscode from 'vscode';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
	BaseModelProvider,
	ModelCapability,
	ModelInfo,
	ModelRequestOptions,
	ModelResponse,
	ModelProviderError,
	StreamingResponseHandler
} from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';
import { debounce } from '../../utils/debounce';

/**
 * Interface for local LLM request
 */
interface LocalLLMRequest {
	model: string;
	prompt?: string;
	messages?: LocalLLMMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stop?: string[];
	stream?: boolean;
}

/**
 * Interface for local LLM message
 */
interface LocalLLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Interface for local LLM response
 */
interface LocalLLMResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message?: LocalLLMMessage;
		text?: string;
		delta?: {
			role?: string;
			content?: string;
		};
		finish_reason: string | null;
	}[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Provider for local LLMs
 */
export class LocalLLMProvider extends BaseModelProvider {
	// Make logger protected to match base class
	protected readonly client: AxiosInstance | null = null;
	protected readonly configService: ConfigService;
	// Change from private to protected to match base class
	protected readonly apiUrl: string;
	private isModelListLoaded = false;
	private modelCheckInterval: NodeJS.Timeout | null = null;

	/**
	 * Create a new Local LLM provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('local-llm', 'Local LLM', configService, logger);

		this.configService = configService;
		this.apiUrl = this.configService.get<string>('localLLM.apiUrl', 'http://localhost:1234/v1');

		// Initialize with a default model
		this.models.set('local-model', {
			id: 'local-model',
			name: 'Local Model',
			contextLength: 8192,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeGeneration
			],
			available: false
		});

		// Create debounced check function
		this.debouncedCheckModels = debounce(this.checkModels.bind(this), 5000);
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing Local LLM provider');

			// Initialize HTTP client
			this.client = axios.create({
				baseURL: this.apiUrl,
				timeout: 30000,
				headers: {
					'Content-Type': 'application/json'
				}
			});

			// Check if the API is accessible
			const isAvailable = await this.checkApiAvailability();

			if (isAvailable) {
				this.logger.info('Local LLM API is available');
				this._isReady = true;

				// Load available models
				await this.loadAvailableModels();

				// Start periodic model checking
				this.startModelChecking();

				return true;
			}

			this.logger.warn('Local LLM API is not available');
			this._isReady = false;
			return false;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to initialize Local LLM provider: ${errorMessage}`);
			this._isReady = false;
			return false;
		}
	}

	/**
	 * Check API availability
	 */
	private async checkApiAvailability(): Promise<boolean> {
		if (!this.client) {
			return false;
		}

		try {
			const response = await this.client.get('/models', { timeout: 2000 });
			return response.status === 200;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Load available models from the API
	 */
	private async loadAvailableModels(): Promise<void> {
		if (!this.client || !this._isReady) {
			return;
		}

		try {
			const response = await this.client.get('/models');

			if (response.status === 200 && response.data.data) {
				// Clear existing models
				this.models.clear();

				// Add each model from the API
				for (const model of response.data.data) {
					this.models.set(model.id, {
						id: model.id,
						name: model.id,
						contextLength: this.estimateContextLength(model.id),
						capabilities: this.inferModelCapabilities(model.id),
						available: true
					});
				}

				this.isModelListLoaded = true;
				this.logger.info(`Loaded ${this.models.size} local models`);
			}
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Failed to load local models: ${errorMessage}`);

			// Add a default model if we couldn't load any
			if (this.models.size === 0) {
				this.models.set('local-model', {
					id: 'local-model',
					name: 'Local Model',
					contextLength: 8192,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration
					],
					available: true
				});
			}
		}
	}

	/**
	 * Estimate context length based on model name
	 * @param modelId Model ID
	 * @returns Estimated context length
	 */
	private estimateContextLength(modelId: string): number {
		// Estimate based on model name patterns
		const lowerModelId = modelId.toLowerCase();

		if (lowerModelId.includes('70b') || lowerModelId.includes('claude')) {
			return 32768;
		} else if (lowerModelId.includes('13b') || lowerModelId.includes('wizardcoder') || lowerModelId.includes('llama-2')) {
			return 16384;
		} else if (lowerModelId.includes('7b') || lowerModelId.includes('coder')) {
			return 8192;
		}

		// Default for unknown models
		return 4096;
	}

	/**
	 * Infer model capabilities from model name
	 * @param modelId Model ID
	 * @returns Array of capabilities
	 */
	private inferModelCapabilities(modelId: string): ModelCapability[] {
		const capabilities: ModelCapability[] = [];
		const lowerModelId = modelId.toLowerCase();

		// All models support basic capabilities
		capabilities.push(ModelCapability.ChatCompletion);
		capabilities.push(ModelCapability.Completion);

		// Code-specific models
		if (lowerModelId.includes('code') || lowerModelId.includes('starcoder') ||
			lowerModelId.includes('wizard') || lowerModelId.includes('llama-2') ||
			lowerModelId.includes('codellama')) {
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.CodeCompletion);
			capabilities.push(ModelCapability.Explanation);

			// More advanced code capabilities for larger models
			if (lowerModelId.includes('13b') || lowerModelId.includes('70b') ||
				lowerModelId.includes('34b') || lowerModelId.includes('wizard')) {
				capabilities.push(ModelCapability.Refactoring);
				capabilities.push(ModelCapability.Planning);
			}
		}

		return capabilities;
	}

	/**
	 * Start periodic model checking
	 */
	private startModelChecking(): void {
		if (this.modelCheckInterval) {
			clearInterval(this.modelCheckInterval);
		}

		// Check models every 5 minutes
		this.modelCheckInterval = setInterval(() => {
			this.debouncedCheckModels();
		}, 5 * 60 * 1000);
	}

	/**
	 * Debounced check models function
	 */
	private debouncedCheckModels: () => void;

	/**
	 * Check for available models
	 */
	private async checkModels(): Promise<void> {
		if (!this._isReady) {
			return;
		}

		try {
			const isAvailable = await this.checkApiAvailability();

			if (isAvailable && !this.isModelListLoaded) {
				await this.loadAvailableModels();
			}
		} catch (error) {
			// Silently handle errors during background checks
		}
	}

	/**
	 * Generate completion from a prompt
	 * @param prompt The prompt text
	 * @param options Request options
	 * @returns Model response
	 */
	public async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this._isReady || !this.client) {
			throw new ModelProviderError('Local LLM provider not initialized', this.id);
		}

		try {
			const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

			if (!modelId) {
				throw new ModelProviderError('No suitable model found', this.id);
			}

			// Prepare messages
			const messages: LocalLLMMessage[] = [];

			// Add system prompt if provided
			if (options?.systemPrompt) {
				messages.push({
					role: 'system',
					content: options.systemPrompt
				});
			}

			// Add user prompt
			messages.push({
				role: 'user',
				content: prompt
			});

			// Prepare request
			const request: LocalLLMRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1.0,
				max_tokens: options?.maxTokens ?? 1024,
				stop: options?.stopSequences
			};

			// Make request
			const response = await this.client.post('/chat/completions', request);
			const data = response.data as LocalLLMResponse;

			// Extract content and token counts
			const content = data.choices[0]?.message?.content || '';
			const promptTokens = data.usage?.prompt_tokens || 0;
			const completionTokens = data.usage?.completion_tokens || 0;

			return {
				content,
				promptTokens,
				completionTokens,
				totalTokens: promptTokens + completionTokens,
				metadata: {
					model: modelId,
					finishReason: data.choices[0]?.finish_reason
				}
			};
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const axiosError = error as AxiosError;
				let errorMessage = axiosError.message;

				// Safely access potential error details
				if (axiosError.response?.data) {
					const data = axiosError.response.data as any;
					if (data.error && typeof data.error === 'object' && data.error.message) {
						errorMessage = data.error.message;
					} else if (typeof data.error === 'string') {
						errorMessage = data.error;
					}
				}

				throw new ModelProviderError(
					`Local LLM request failed: ${errorMessage}`,
					this.id,
					options?.modelParams?.modelId as string
				);
			}

			throw new ModelProviderError(
				`Local LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
				this.id
			);
		}
	}

	/**
	 * Generate completion from a prompt with streaming response
	 * @param prompt The prompt text
	 * @param handler Streaming handler
	 * @param options Request options
	 */
	public async generateCompletionStream(
		prompt: string,
		handler: StreamingResponseHandler,
		options?: ModelRequestOptions
	): Promise<void> {
		if (!this._isReady || !this.client) {
			throw new ModelProviderError('Local LLM provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for streaming', this.id);
		}

		try {
			// Prepare messages
			const messages: LocalLLMMessage[] = [];

			// Add system prompt if provided
			if (options?.systemPrompt) {
				messages.push({
					role: 'system',
					content: options.systemPrompt
				});
			}

			// Add user prompt
			messages.push({
				role: 'user',
				content: prompt
			});

			// Prepare request
			const request: LocalLLMRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1.0,
				max_tokens: options?.maxTokens ?? 1024,
				stream: true,
				stop: options?.stopSequences
			};

			// Make streaming request
			const response = await this.client.post('/chat/completions', request, {
				responseType: 'stream'
			});

			let accumulatedContent = '';
			let finishReason = '';
			let promptTokens = 0;
			let completionTokens = 0;

			response.data.on('data', (chunk: Buffer) => {
				try {
					const lines = chunk.toString().split('\n');

					for (const line of lines) {
						if (!line.trim() || line.trim() === 'data: [DONE]') {
							continue;
						}

						const dataMatch = line.match(/^data: (.+)$/);
						if (!dataMatch) {
							continue;
						}

						const data = JSON.parse(dataMatch[1]) as LocalLLMResponse;
						const content = data.choices[0]?.delta?.content || '';

						if (content) {
							accumulatedContent += content;
							handler.onContent(content);
						}

						if (data.choices[0]?.finish_reason) {
							finishReason = data.choices[0].finish_reason;
						}

						// Track token usage if available in this chunk
						if (data.usage) {
							promptTokens = data.usage.prompt_tokens;
							completionTokens += data.usage.completion_tokens;
						}
					}
				} catch (error) {
					// If we can't parse, ignore this chunk
					this.logger.debug(`Failed to parse streaming chunk: ${error instanceof Error ? error.message : String(error)}`);
				}
			});

			response.data.on('error', (error: Error) => {
				handler.onError(new ModelProviderError(`Stream error: ${error.message}`, this.id, modelId));
			});

			response.data.on('end', () => {
				// If we didn't get token counts from the API, estimate them
				if (promptTokens === 0) {
					promptTokens = Math.ceil(prompt.length / 4);
				}
				if (completionTokens === 0) {
					completionTokens = Math.ceil(accumulatedContent.length / 4);
				}

				handler.onComplete({
					content: accumulatedContent,
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens,
					metadata: {
						model: modelId,
						finishReason: finishReason || 'stop'
					}
				});
			});
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const axiosError = error as AxiosError;
				let errorMessage = axiosError.message;

				// Safely access potential error details
				if (axiosError.response?.data) {
					const data = axiosError.response.data as any;
					if (data.error && typeof data.error === 'object' && data.error.message) {
						errorMessage = data.error.message;
					} else if (typeof data.error === 'string') {
						errorMessage = data.error;
					}
				}

				handler.onError(
					new ModelProviderError(
						`Local LLM streaming failed: ${errorMessage}`,
						this.id,
						modelId,
						String(axiosError.response?.status || 'NETWORK_ERROR')
					)
				);
			} else {
				handler.onError(
					new ModelProviderError(
						`Local LLM streaming failed: ${error instanceof Error ? error.message : String(error)}`,
						this.id,
						modelId
					)
				);
			}
		}
	}

	/**
	 * Count tokens in a text
	 * @param text The text to count tokens for
	 * @returns Token count
	 */
	public async countTokens(text: string): Promise<number> {
		// Simple approximation: ~4 characters per token for English text
		return Math.ceil(text.length / 4);
	}

	/**
	 * Get model info by ID
	 * @param modelId Model ID
	 * @returns Model info or null if not found
	 */
	public getModelInfo(modelId: string): ModelInfo | null {
		return this.models.get(modelId) || null;
	}

	/**
	 * Get default model ID for a capability
	 * @param capability Model capability
	 * @returns Model ID or null if no suitable model found
	 */
	public async getDefaultModelForCapability(capability: ModelCapability): Promise<string | null> {
		// If no models are loaded, try to load them
		if (this.models.size === 0 || !this.isModelListLoaded) {
			await this.loadAvailableModels();
		}

		// Find models with the requested capability
		const modelsWithCapability = Array.from(this.models.values()).filter(
			model => model.capabilities.includes(capability)
		);

		if (modelsWithCapability.length === 0) {
			return null;
		}

		// Prefer models with code in the name for code-related capabilities
		if (capability === ModelCapability.CodeGeneration ||
			capability === ModelCapability.CodeCompletion ||
			capability === ModelCapability.Refactoring) {

			const codeModels = modelsWithCapability.filter(
				model => model.id.toLowerCase().includes('code') ||
					model.id.toLowerCase().includes('wizard') ||
					model.id.toLowerCase().includes('starcoder')
			);

			if (codeModels.length > 0) {
				// Sort by estimated capability (context length is a proxy)
				codeModels.sort((a, b) => b.contextLength - a.contextLength);
				return codeModels[0].id;
			}
		}

		// Sort by estimated capability (context length is a proxy)
		modelsWithCapability.sort((a, b) => b.contextLength - a.contextLength);
		return modelsWithCapability[0].id;
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		if (this.modelCheckInterval) {
			clearInterval(this.modelCheckInterval);
			this.modelCheckInterval = null;
		}

		this._isReady = false;
	}
}
