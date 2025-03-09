/**
 * XAI Provider
 *
 * Provider implementation for XAI (Explainable AI) API integration.
 * Supports various XAI models for code generation and explanation tasks.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * XAI API message format
 */
interface XAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * XAI completion request parameters
 */
interface XAICompletionRequest {
	model: string;
	messages: XAIMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stop_sequences?: string[];
	stream?: boolean;
}

/**
 * XAI API response format
 */
interface XAICompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: XAIMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * XAI stream chunk format
 */
interface XAIStreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		delta: {
			role?: string;
			content?: string;
		};
		finish_reason: string | null;
	}[];
}

/**
 * Provider for XAI models
 */
export class XAIProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private apiKey: string = '';
	private client: AxiosInstance | null = null;
	private baseUrl: string = 'https://api.xai.com/v1';

	/**
	 * Create a new XAI provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('xai', 'XAI', configService, logger);
		this.configService = configService;
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing XAI provider');

			// Get API key from secure storage
			this.apiKey = await this.configService.getSecret('xai.apiKey') || '';

			if (!this.apiKey) {
				this.logger.warn('XAI API key not found');
				return false;
			}

			// Get base URL (configurable)
			this.baseUrl = this.configService.get<string>(
				'providers.xai.baseUrl',
				'https://api.xai.com/v1'
			);

			// Initialize API client
			this.client = axios.create({
				baseURL: this.baseUrl,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: 60000
			});

			// Load available models
			await this.loadModels();

			this._isReady = true;
			this.logger.info('XAI provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize XAI provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Load available models from XAI
	 */
	private async loadModels(): Promise<void> {
		try {
			// Define standard XAI models
			const standardModels: ModelInfo[] = [
				{
					id: 'xai-explainer-large',
					name: 'XAI Explainer Large',
					contextLength: 32768,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.Explanation,
						ModelCapability.CodeExplanation,
						ModelCapability.SecurityAnalysis
					],
					available: true
				},
				{
					id: 'xai-coder-pro',
					name: 'XAI Coder Pro',
					contextLength: 32768,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
						ModelCapability.Testing
					],
					available: true
				},
				{
					id: 'xai-assistant',
					name: 'XAI Assistant',
					contextLength: 16384,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.Explanation,
						ModelCapability.CodeCompletion
					],
					available: true
				}
			];

			// Add models to map
			standardModels.forEach(model => {
				this.models.set(model.id, model);
			});

			// If client is available, try to get additional models from API
			if (this.client) {
				try {
					const response = await this.client.get('/models');
					const apiModels = response.data.data || [];

					for (const model of apiModels) {
						// Skip if we already have this model
						if (this.models.has(model.id)) {
							continue;
						}

						// Only add XAI models
						if (model.id.includes('xai')) {
							const capabilities = this.inferModelCapabilities(model.id);
							const contextLength = this.getContextLengthForModel(model.id);

							this.models.set(model.id, {
								id: model.id,
								name: model.id,
								contextLength,
								capabilities,
								available: true
							});
						}
					}
				} catch (error) {
					// Non-fatal error, we already have standard models
					this.logger.warn(`Failed to get models from XAI API: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			this.logger.info(`Loaded ${this.models.size} XAI models`);
		} catch (error) {
			throw new Error(`Failed to load XAI models: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate completion from a prompt
	 * @param prompt The prompt text
	 * @param options Request options
	 * @returns Model response
	 */
	public async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('XAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		try {
			// Prepare messages
			const messages: XAIMessage[] = [];

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
			const request: XAICompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stop_sequences: options?.stopSequences,
				stream: false
			};

			const response = await this.client.post<XAICompletionResponse>('/chat/completions', request);
			const content = response.data.choices[0]?.message?.content || '';

			return {
				content,
				promptTokens: response.data.usage?.prompt_tokens || 0,
				completionTokens: response.data.usage?.completion_tokens || 0,
				totalTokens: response.data.usage?.total_tokens || 0,
				metadata: {
					model: modelId,
					finishReason: response.data.choices[0]?.finish_reason || 'stop'
				}
			};
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.data) {
				const responseData = error.response.data as { error?: { message?: string } };
				throw new ModelProviderError(
					`XAI request failed: ${responseData.error?.message || error.message}`,
					this.id,
					modelId,
					String(error.response?.status || 'NETWORK_ERROR')
				);
			}
			throw new ModelProviderError(`XAI request failed: ${error instanceof Error ? error.message : String(error)}`, this.id, modelId);
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
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('XAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for streaming', this.id);
		}

		try {
			// Prepare messages
			const messages: XAIMessage[] = [];

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
			const request: XAICompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stop_sequences: options?.stopSequences,
				stream: true
			};

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

						const data = JSON.parse(dataMatch[1]) as XAIStreamChunk;
						const content = data.choices[0]?.delta?.content || '';

						if (content) {
							accumulatedContent += content;
							handler.onContent(content);
						}

						if (data.choices[0]?.finish_reason) {
							finishReason = data.choices[0].finish_reason;
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
				// Estimate token counts
				promptTokens = this.estimateTokenCount(prompt);
				completionTokens = this.estimateTokenCount(accumulatedContent);

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
			if (axios.isAxiosError(error) && error.response?.data) {
				const responseData = error.response.data as { error?: { message?: string } };
				handler.onError(
					new ModelProviderError(
						`XAI streaming failed: ${responseData.error?.message || error.message}`,
						this.id,
						modelId,
						String(error.response?.status || 'NETWORK_ERROR')
					)
				);
			} else {
				handler.onError(
					new ModelProviderError(
						`XAI streaming failed: ${error instanceof Error ? error.message : String(error)}`,
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
		return this.estimateTokenCount(text);
	}

	/**
	 * Estimate token count based on text length
	 * @param text Text to estimate tokens for
	 * @returns Estimated token count
	 */
	private estimateTokenCount(text: string): number {
		// Roughly 4 chars per token for English text
		return Math.ceil(text.length / 4);
	}

	/**
	 * Infer model capabilities from model ID
	 * @param modelId Model ID
	 * @returns Array of capabilities
	 */
	private inferModelCapabilities(modelId: string): ModelCapability[] {
		const capabilities: ModelCapability[] = [];
		const lowerModelId = modelId.toLowerCase();

		// All XAI models support basic chat completion
		capabilities.push(ModelCapability.ChatCompletion);

		if (lowerModelId.includes('explainer')) {
			// Explainer models focus on explanation capabilities
			capabilities.push(ModelCapability.Explanation);
			capabilities.push(ModelCapability.CodeExplanation);

			if (lowerModelId.includes('large') || lowerModelId.includes('pro')) {
				capabilities.push(ModelCapability.SecurityAnalysis);
			}
		} else if (lowerModelId.includes('coder')) {
			// Coder models focus on code generation capabilities
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.CodeCompletion);
			capabilities.push(ModelCapability.Refactoring);

			if (lowerModelId.includes('pro')) {
				capabilities.push(ModelCapability.Testing);
			}
		} else {
			// Assistant models have basic capabilities
			capabilities.push(ModelCapability.Explanation);
			capabilities.push(ModelCapability.CodeCompletion);
		}

		return capabilities;
	}

	/**
	 * Get context length for a model
	 * @param modelId Model ID
	 * @returns Context length
	 */
	private getContextLengthForModel(modelId: string): number {
		const lowerModelId = modelId.toLowerCase();

		if (lowerModelId.includes('large') || lowerModelId.includes('pro')) {
			return 32768;
		} else {
			return 16384; // Default for other models
		}
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
		// Get preferred model from config
		const preferredModel = this.configService.get<string>('providers.xai.preferredModel', '');

		if (preferredModel) {
			const model = this.models.get(preferredModel);
			if (model && model.capabilities.includes(capability)) {
				return model.id;
			}
		}

		// Default models based on capability
		switch (capability) {
			case ModelCapability.Explanation:
			case ModelCapability.SecurityAnalysis:
				// Use explainer model for explanation capabilities
				return 'xai-explainer-large';

			case ModelCapability.CodeGeneration:
			case ModelCapability.CodeCompletion:
			case ModelCapability.Refactoring:
			case ModelCapability.Testing:
				// Use coder model for code-related capabilities
				return 'xai-coder-pro';

			case ModelCapability.ChatCompletion:
				// Use assistant model for general chat
				return 'xai-assistant';

			default:
				// Find any model with the capability
				const models = Array.from(this.models.values())
					.filter(model => model.capabilities.includes(capability))
					.sort((a, b) => b.contextLength - a.contextLength); // Prefer models with larger context

				return models.length > 0 ? models[0].id : null;
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this._isReady = false;
		this.client = null;
	}
}
