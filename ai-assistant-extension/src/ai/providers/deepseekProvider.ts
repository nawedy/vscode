/**
 * DeepSeek Provider
 *
 * Provider implementation for DeepSeek API integration.
 * Supports DeepSeek's models including DeepSeek Coder series.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import {
	BaseModelProvider,
	ModelCapability,
	ModelInfo,
	ModelProviderError,
	ModelRequestOptions,
	ModelResponse,
	StreamingResponseHandler
} from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * DeepSeek API response types
 */
interface DeepSeekMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface DeepSeekCompletionRequest {
	model: string;
	messages: DeepSeekMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stop?: string[];
	stream?: boolean;
}

interface DeepSeekCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: DeepSeekMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

interface DeepSeekStreamChunk {
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
 * Provider for DeepSeek models
// @ts-ignore: error TS2415: Class 'DeepSeekProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'DeepSeekProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'DeepSeekProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'DeepSeekProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'DeepSeekProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'DeepSeekProvider' incorrectly extends base class 'BaseModelProvider'.
 */
export class DeepSeekProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private apiKey: string = '';
	private client: AxiosInstance | null = null;
	private baseUrl: string = 'https://api.deepseek.com/v1';

	/**
	 * Create a new DeepSeek provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('deepseek', 'DeepSeek');
		this.configService = configService;
		this.logger = logger;
	}

	/**
	 * Initialize the DeepSeek provider
	 * @returns Whether initialization was successful
	 */
	async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing DeepSeek provider');

			// Get API key
			this.apiKey = await this.configService.getSecret('deepseek.apiKey') || '';
			if (!this.apiKey) {
				this.logger.warn('DeepSeek API key not found');
				return false;
			}

			// Get base URL (configurable)
			this.baseUrl = this.configService.get<string>(
				'providers.deepseek.baseUrl',
				'https://api.deepseek.com/v1'
			);

			// Initialize API client
			this.client = axios.create({
				baseURL: this.baseUrl,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: this.configService.get<number>('providers.deepseek.timeout', 30000)
			});

			// Load available models
			await this.loadModels();

			this._isReady = true;
			this.logger.info('DeepSeek provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize DeepSeek provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Load available models
	 */
	private async loadModels(): Promise<void> {
		try {
			// Define standard DeepSeek models
			const standardModels: ModelInfo[] = [
				{
					id: 'deepseek-coder-v2',
					name: 'DeepSeek Coder v2',
					contextLength: 32000,
					capabilities: [
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
					id: 'deepseek-coder-v2-mini',
					name: 'DeepSeek Coder v2 Mini',
					contextLength: 32000,
					capabilities: [
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
						ModelCapability.Explanation
					],
					available: true
				},
				{
					id: 'deepseek-llm-67b-chat',
					name: 'DeepSeek LLM 67B Chat',
					contextLength: 16000,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.Explanation
					],
					available: true
				},
				{
					id: 'deepseek-llm-7b-chat',
					name: 'DeepSeek LLM 7B Chat',
					contextLength: 4096,
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

						// Only add models that are related to DeepSeek
						if (model.id.includes('deepseek')) {
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
					this.logger.warn(`Failed to get models from DeepSeek API: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			this.logger.info(`Loaded ${this.models.size} DeepSeek models`);
		} catch (error) {
			throw new Error(`Failed to load DeepSeek models: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate completion from a prompt
	 * @param prompt The prompt text
	 * @param options Request options
	 * @returns Model response
	 */
	async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('DeepSeek provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.CodeGeneration);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for generation', this.id);
		}

		try {
			// Prepare messages
			const messages: DeepSeekMessage[] = [];

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
			const request: DeepSeekCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.3,
				top_p: options?.topP ?? 0.95,
				max_tokens: options?.maxTokens ?? 2048,
				stop: options?.stopSequences,
				stream: false
			};

			const response = await this.client.post<DeepSeekCompletionResponse>('/chat/completions', request);
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
			if (axios.isAxiosError(error)) {
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
				throw new ModelProviderError(
					`DeepSeek request failed: ${error.response?.data?.error?.message || error.message}`,
					this.id,
					modelId,
					String(error.response?.status || 'NETWORK_ERROR')
				);
			}
			throw new ModelProviderError(`DeepSeek request failed: ${error instanceof Error ? error.message : String(error)}`, this.id, modelId);
		}
	}

	/**
	 * Generate completion from a prompt with streaming response
	 * @param prompt The prompt text
	 * @param handler Streaming handler
	 * @param options Request options
	 */
	async generateCompletionStream(
		prompt: string,
		handler: StreamingResponseHandler,
		options?: ModelRequestOptions
	): Promise<void> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('DeepSeek provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.CodeGeneration);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for generation', this.id);
		}

		try {
			// Prepare messages
			const messages: DeepSeekMessage[] = [];

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
			const request: DeepSeekCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.3,
				top_p: options?.topP ?? 0.95,
				max_tokens: options?.maxTokens ?? 2048,
				stop: options?.stopSequences,
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

						const data = JSON.parse(dataMatch[1]) as DeepSeekStreamChunk;
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
				promptTokens = Math.ceil(prompt.length / 4);
				completionTokens = Math.ceil(accumulatedContent.length / 4);

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
				handler.onError(
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
					new ModelProviderError(
						`DeepSeek streaming failed: ${error.response?.data?.error?.message || error.message}`,
						this.id,
						modelId,
						String(error.response?.status || 'NETWORK_ERROR')
					)
				);
			} else {
				handler.onError(
					new ModelProviderError(
						`DeepSeek streaming failed: ${error instanceof Error ? error.message : String(error)}`,
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
	async countTokens(text: string): Promise<number> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('DeepSeek provider not initialized', this.id);
		}

		// DeepSeek doesn't have a specific token counting API
		// We use a heuristic based on characters
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

		// All DeepSeek models support basic chat completion
		capabilities.push(ModelCapability.ChatCompletion);

		if (lowerModelId.includes('coder')) {
			// Coder models support code-related tasks
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.CodeCompletion);
			capabilities.push(ModelCapability.Refactoring);
			capabilities.push(ModelCapability.Explanation);

			// Advanced code capabilities for main coder models
			if (!lowerModelId.includes('mini')) {
				capabilities.push(ModelCapability.Testing);
				capabilities.push(ModelCapability.SecurityAnalysis);
				capabilities.push(ModelCapability.Planning);
			}
		} else if (lowerModelId.includes('llm')) {
			// General LLM models
			capabilities.push(ModelCapability.Explanation);

			// Larger models have more capabilities
			if (lowerModelId.includes('67b') || lowerModelId.includes('32b')) {
				capabilities.push(ModelCapability.CodeCompletion);
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

		// Return context lengths based on model
		if (lowerModelId.includes('coder-v2')) {
			return 32000;
		} else if (lowerModelId.includes('llm-67b')) {
			return 16000;
		} else if (lowerModelId.includes('llm-7b')) {
			return 4096;
		} else {
			// Default for unknown models
			return 4096;
		}
	}
}
