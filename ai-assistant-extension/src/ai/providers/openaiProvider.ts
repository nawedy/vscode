/**
 * OpenAI Provider
 *
 * Provider implementation for OpenAI API integration.
 * Supports GPT family models for various AI capabilities.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * OpenAI API message format
 */
interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant' | 'function';
	content: string;
	name?: string;
}

/**
 * OpenAI completion request parameters
 */
interface OpenAICompletionRequest {
	model: string;
	messages: OpenAIMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stream?: boolean;
	stop?: string[];
	presence_penalty?: number;
	frequency_penalty?: number;
}

/**
 * OpenAI API response format
 */
interface OpenAICompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: OpenAIMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * OpenAI stream chunk format
 */
interface OpenAIStreamChunk {
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
 * Provider for OpenAI models
 */
export class OpenAIProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private apiKey: string = '';
	private client: AxiosInstance | null = null;
	private baseUrl: string = 'https://api.openai.com/v1';
	private orgId: string = '';

	/**
	 * Create a new OpenAI provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('openai', 'OpenAI', configService, logger);
		this.configService = configService;
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing OpenAI provider');

			// Get API key and org ID from secure storage
			this.apiKey = await this.configService.getSecret('openai.apiKey') || '';
			this.orgId = await this.configService.getSecret('openai.orgId') || '';

			if (!this.apiKey) {
				this.logger.warn('OpenAI API key not found');
				return false;
			}

			// Get base URL (configurable for Azure OpenAI)
			this.baseUrl = this.configService.get<string>(
				'providers.openai.baseUrl',
				'https://api.openai.com/v1'
			);

			// Initialize API client
			this.client = axios.create({
				baseURL: this.baseUrl,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
					...(this.orgId ? { 'OpenAI-Organization': this.orgId } : {})
				},
				timeout: 60000
			});

			// Load available models
			await this.loadModels();

			this._isReady = true;
			this.logger.info('OpenAI provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize OpenAI provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Load available models from OpenAI
	 */
	private async loadModels(): Promise<void> {
		try {
			// Define standard OpenAI models
			const standardModels: ModelInfo[] = [
				{
					id: 'gpt-4o',
					name: 'GPT-4o',
					contextLength: 128000,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
						ModelCapability.SecurityAnalysis,
						ModelCapability.Testing,
						ModelCapability.Explanation,
						ModelCapability.Planning
					],
					available: true
				},
				{
					id: 'gpt-4-turbo',
					name: 'GPT-4 Turbo',
					contextLength: 128000,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
						ModelCapability.SecurityAnalysis,
						ModelCapability.Testing,
						ModelCapability.Explanation,
						ModelCapability.Planning
					],
					available: true
				},
				{
					id: 'gpt-4',
					name: 'GPT-4',
					contextLength: 8192,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
						ModelCapability.SecurityAnalysis,
						ModelCapability.Testing,
						ModelCapability.Explanation
					],
					available: true
				},
				{
					id: 'gpt-3.5-turbo',
					name: 'GPT-3.5 Turbo',
					contextLength: 16385,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.Explanation
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

						// Only add GPT models
						if (model.id.includes('gpt')) {
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
					this.logger.warn(`Failed to get models from OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			this.logger.info(`Loaded ${this.models.size} OpenAI models`);
		} catch (error) {
			throw new Error(`Failed to load OpenAI models: ${error instanceof Error ? error.message : String(error)}`);
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
			throw new ModelProviderError('OpenAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		try {
			// Prepare messages
			const messages: OpenAIMessage[] = [];

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
			const request: OpenAICompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stop: options?.stopSequences,
				stream: false,
				presence_penalty: options?.presencePenalty,
				frequency_penalty: options?.frequencyPenalty
			};

			const response = await this.client.post<OpenAICompletionResponse>('/chat/completions', request);
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
					`OpenAI request failed: ${responseData.error?.message || error.message}`,
					this.id,
					modelId,
					String(error.response?.status || 'NETWORK_ERROR')
				);
			}
			throw new ModelProviderError(`OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`, this.id, modelId);
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
			throw new ModelProviderError('OpenAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for streaming', this.id);
		}

		try {
			// Prepare messages
			const messages: OpenAIMessage[] = [];

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
			const request: OpenAICompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stop: options?.stopSequences,
				stream: true,
				presence_penalty: options?.presencePenalty,
				frequency_penalty: options?.frequencyPenalty
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

						const data = JSON.parse(dataMatch[1]) as OpenAIStreamChunk;
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
				// Estimate token counts until we get a better way
				// OpenAI doesn't provide token counts in streaming mode
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
						`OpenAI streaming failed: ${responseData.error?.message || error.message}`,
						this.id,
						modelId,
						String(error.response?.status || 'NETWORK_ERROR')
					)
				);
			} else {
				handler.onError(
					new ModelProviderError(
						`OpenAI streaming failed: ${error instanceof Error ? error.message : String(error)}`,
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

		// All OpenAI models support basic chat completion
		capabilities.push(ModelCapability.ChatCompletion);

		if (lowerModelId.includes('gpt-4')) {
			// GPT-4 models have more capabilities
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.CodeCompletion);
			capabilities.push(ModelCapability.Refactoring);
			capabilities.push(ModelCapability.SecurityAnalysis);
			capabilities.push(ModelCapability.Testing);
			capabilities.push(ModelCapability.Explanation);
			capabilities.push(ModelCapability.Planning);
		} else if (lowerModelId.includes('gpt-3.5')) {
			// GPT-3.5 models have fewer capabilities
			capabilities.push(ModelCapability.CodeCompletion);
			capabilities.push(ModelCapability.Explanation);

			// Some GPT-3.5 models can handle code generation
			if (lowerModelId.includes('turbo')) {
				capabilities.push(ModelCapability.CodeGeneration);
			}
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

		if (lowerModelId.includes('gpt-4-turbo') || lowerModelId.includes('gpt-4o')) {
			return 128000;
		} else if (lowerModelId.includes('gpt-4-32k')) {
			return 32768;
		} else if (lowerModelId.includes('gpt-4')) {
			return 8192;
		} else if (lowerModelId.includes('gpt-3.5-turbo-16k')) {
			return 16384;
		} else {
			return 4096; // Default for other models
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
		const preferredModel = this.configService.get<string>('providers.openai.preferredModel', '');

		if (preferredModel) {
			const model = this.models.get(preferredModel);
			if (model && model.capabilities.includes(capability)) {
				return model.id;
			}
		}

		// Otherwise select based on capability
		let candidateModels = Array.from(this.models.values())
			.filter(model => model.capabilities.includes(capability))
			.sort((a, b) => b.contextLength - a.contextLength); // Prefer models with larger context

		// For code-related capabilities, prefer GPT-4
		if ([ModelCapability.CodeGeneration, ModelCapability.Refactoring, ModelCapability.SecurityAnalysis].includes(capability)) {
			const gpt4Models = candidateModels.filter(m => m.id.toLowerCase().includes('gpt-4'));
			if (gpt4Models.length > 0) {
				return gpt4Models[0].id;
			}
		}

		// Use the first model with the capability if available
		return candidateModels.length > 0 ? candidateModels[0].id : null;
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this._isReady = false;
		this.client = null;
	}
}
