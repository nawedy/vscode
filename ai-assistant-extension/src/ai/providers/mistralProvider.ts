/**
 * Mistral Provider
 *
 * Provider implementation for Mistral AI API integration.
 * Supports Mistral's large language models for various AI capabilities.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * Mistral API message format
 */
interface MistralMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Mistral completion request parameters
 */
interface MistralCompletionRequest {
	model: string;
	messages: MistralMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stream?: boolean;
	safe_prompt?: boolean;
	random_seed?: number;
}

/**
 * Mistral API response format
 */
interface MistralCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: MistralMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Mistral stream chunk format
 */
interface MistralStreamChunk {
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
 * Provider for Mistral models
 */
export class MistralProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private apiKey: string = '';
	private client: AxiosInstance | null = null;
	private baseUrl: string = 'https://api.mistral.ai/v1';

	/**
	 * Create a new Mistral provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('mistral', 'Mistral AI', configService, logger);
		this.configService = configService;
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing Mistral provider');

			// Get API key from secure storage
			this.apiKey = await this.configService.getSecret('mistral.apiKey') || '';

			if (!this.apiKey) {
				this.logger.warn('Mistral API key not found');
				return false;
			}

			// Get base URL (configurable)
			this.baseUrl = this.configService.get<string>(
				'providers.mistral.baseUrl',
				'https://api.mistral.ai/v1'
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
			this.logger.info('Mistral provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize Mistral provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Load available models
	 */
	private async loadModels(): Promise<void> {
		try {
			// Define standard Mistral models
			const standardModels: ModelInfo[] = [
				{
					id: 'mistral-large-latest',
					name: 'Mistral Large',
					contextLength: 32768,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
						ModelCapability.Explanation,
						ModelCapability.Planning
					],
					available: true
				},
				{
					id: 'mistral-medium-latest',
					name: 'Mistral Medium',
					contextLength: 32768,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Explanation
					],
					available: true
				},
				{
					id: 'mistral-small-latest',
					name: 'Mistral Small',
					contextLength: 32768,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.Explanation
					],
					available: true
				},
				{
					id: 'open-mistral-7b',
					name: 'Open Mistral 7B',
					contextLength: 8192,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.Explanation
					],
					available: true
				},
				{
					id: 'open-mixtral-8x7b',
					name: 'Open Mixtral 8x7B',
					contextLength: 32768,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.Explanation,
						ModelCapability.CodeGeneration
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

						// Only add Mistral models
						if (model.id.includes('mistral') || model.id.includes('mixtral')) {
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
					this.logger.warn(`Failed to get models from Mistral API: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			this.logger.info(`Loaded ${this.models.size} Mistral models`);
		} catch (error) {
			throw new Error(`Failed to load Mistral models: ${error instanceof Error ? error.message : String(error)}`);
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
			throw new ModelProviderError('Mistral provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		try {
			// Prepare messages
			const messages: MistralMessage[] = [];

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
			const request: MistralCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stream: false
			};

			const response = await this.client.post<MistralCompletionResponse>('/chat/completions', request);
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
					`Mistral request failed: ${responseData.error?.message || error.message}`,
					this.id,
					modelId,
					String(error.response?.status || 'NETWORK_ERROR')
				);
			}
			throw new ModelProviderError(`Mistral request failed: ${error instanceof Error ? error.message : String(error)}`, this.id, modelId);
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
			throw new ModelProviderError('Mistral provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for streaming', this.id);
		}

		try {
			// Prepare messages
			const messages: MistralMessage[] = [];

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
			const request: MistralCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
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

						const data = JSON.parse(dataMatch[1]) as MistralStreamChunk;
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
				// Estimate token counts (since they're not provided by the API in streaming mode)
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
						`Mistral streaming failed: ${responseData.error?.message || error.message}`,
						this.id,
						modelId,
						String(error.response?.status || 'NETWORK_ERROR')
					)
				);
			} else {
				handler.onError(
					new ModelProviderError(
						`Mistral streaming failed: ${error instanceof Error ? error.message : String(error)}`,
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
		// For English text, roughly 4 characters per token
		return Math.ceil(text.length / 4);
	}

	/**
	 * Infer model capabilities from model ID
	 * @param modelId Model ID
	 * @returns Array of capabilities
	 */
	private inferModelCapabilities(modelId: string): ModelCapability[] {
		const capabilities = new Set<ModelCapability>();
		const lowerModelId = modelId.toLowerCase();

		// All Mistral models support chat completion
		capabilities.add(ModelCapability.ChatCompletion);
		capabilities.add(ModelCapability.Explanation);

		if (lowerModelId.includes('large')) {
			// Large models have additional capabilities
			capabilities.add(ModelCapability.CodeGeneration);
			capabilities.add(ModelCapability.CodeCompletion);
			capabilities.add(ModelCapability.Refactoring);
			capabilities.add(ModelCapability.Planning);
		} else if (lowerModelId.includes('medium')) {
			// Medium models
			capabilities.add(ModelCapability.CodeGeneration);
			capabilities.add(ModelCapability.CodeCompletion);
		} else {
			// Small/base models have basic capabilities
			capabilities.add(ModelCapability.CodeCompletion);
		}

		// Mixtral models have good code capabilities
		if (lowerModelId.includes('mixtral')) {
			capabilities.add(ModelCapability.CodeGeneration);
			capabilities.add(ModelCapability.CodeCompletion);
		}

		return Array.from(capabilities);
	}

	/**
	 * Get context length for a model
	 * @param modelId Model ID
	 * @returns Context length
	 */
	private getContextLengthForModel(modelId: string): number {
		const lowerModelId = modelId.toLowerCase();

		if (lowerModelId.includes('large') ||
			lowerModelId.includes('medium') ||
			lowerModelId.includes('mixtral-8x7b')) {
			return 32768;
		} else if (lowerModelId.includes('small')) {
			return 16384;
		} else {
			// Default for other models (like open-mistral-7b)
			return 8192;
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
		// Check for configured preferred model first
		const preferredModel = this.configService.get<string>('providers.mistral.preferredModel', '');

		if (preferredModel) {
			const model = this.models.get(preferredModel);
			if (model && model.capabilities.includes(capability)) {
				return model.id;
			}
		}

		// Match based on capability
		switch (capability) {
			case ModelCapability.CodeGeneration:
			case ModelCapability.Refactoring:
			case ModelCapability.Planning:
				// For advanced capabilities, prefer Large model
				return 'mistral-large-latest';

			case ModelCapability.CodeCompletion:
				// For code completion, Medium is a good balance
				return 'mistral-medium-latest';

			default:
				// For basic capabilities, start with Small
				const models = Array.from(this.models.values())
					.filter(model => model.capabilities.includes(capability))
					.sort((a, b) => b.contextLength - a.contextLength);

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
