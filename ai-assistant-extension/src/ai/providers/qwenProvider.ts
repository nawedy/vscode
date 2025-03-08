/**
 * Qwen Provider
 *
 * Provider implementation for Alibaba Cloud's Qwen models.
 * Supports Qwen series of models for code-related tasks.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
	BaseModelProvider,
	ModelCapability,
	ModelInfo,
	ModelRequestOptions,
	ModelResponse,
	StreamingResponseHandler,
	ModelProviderError
} from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * Interface for Qwen API request
 */
interface QwenChatRequest {
	model: string;
	messages: QwenMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stream?: boolean;
	stop?: string[];
}

/**
 * Interface for Qwen API message
 */
interface QwenMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Interface for Qwen API response
 */
interface QwenResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: QwenMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Interface for Qwen API streaming response
 */
interface QwenStreamChunk {
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
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Provider for Qwen AI models
 */
export class QwenProvider extends BaseModelProvider {
	private client: AxiosInstance | null = null;
	// Change from private to protected to match BaseModelProvider
	protected readonly configService: ConfigService;
	// Already changed from private to protected in previous fix
	protected readonly logger: Logger;
	private apiKey: string = '';
	private readonly apiBaseUrl: string = 'https://api.qwen.ai/v1';

	/**
	 * Create a new Qwen provider
	 * @param configService Configuration service
	 * @param logger Logger
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('qwen', 'Qwen AI');
		this.configService = configService;
		this.logger = logger;

		// Define available models
		this.models.set('qwen-max', {
			id: 'qwen-max',
			name: 'Qwen Max',
			contextLength: 32768,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring
			],
			available: true
		});

		this.models.set('qwen-plus', {
			id: 'qwen-plus',
			name: 'Qwen Plus',
			contextLength: 16384,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation
			],
			available: true
		});

		this.models.set('qwen-turbo', {
			id: 'qwen-turbo',
			name: 'Qwen Turbo',
			contextLength: 8192,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion
			],
			available: true
		});
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing Qwen provider');

			// Get API key from config
			this.apiKey = this.configService.getSecureValue('qwen.apiKey') || '';

			if (!this.apiKey) {
				this.logger.warn('Qwen API key not found');
				this._isReady = false;
				return false;
			}

			// Initialize axios client
			this.client = axios.create({
				baseURL: this.apiBaseUrl,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.apiKey}`
				}
			});

			// Check if the API is accessible
			const response = await this.client.get('/models');

			if (response.status === 200) {
				this._isReady = true;
				this.logger.info('Qwen provider initialized successfully');
				return true;
			}

			this.logger.warn(`Qwen API returned unexpected status: ${response.status}`);
			this._isReady = false;
			return false;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to initialize Qwen provider: ${errorMessage}`);
			this._isReady = false;
			return false;
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
			throw new ModelProviderError('Qwen provider not initialized', this.id);
		}

		try {
			const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

			if (!modelId) {
				throw new ModelProviderError('No suitable model found', this.id);
			}

			// Prepare messages
			const messages: QwenMessage[] = [];

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
			const request: QwenChatRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1.0,
				max_tokens: options?.maxTokens ?? 1024,
				stop: options?.stopSequences
			};

			// Make request
			const response = await this.client.post('/chat/completions', request);
			const data = response.data as QwenResponse;

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
				const errorData = axiosError.response?.data as { error?: { message?: string } };
				const errorMessage = errorData?.error?.message || axiosError.message;

				throw new ModelProviderError(
					`Qwen request failed: ${errorMessage}`,
					this.id,
					options?.modelParams?.modelId as string
				);
			}

			throw new ModelProviderError(
				`Qwen request failed: ${error instanceof Error ? error.message : String(error)}`,
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
			throw new ModelProviderError('Qwen provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(options?.capability || ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for streaming', this.id);
		}

		try {
			// Prepare messages
			const messages: QwenMessage[] = [];

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
			const request: QwenChatRequest = {
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

						const data = JSON.parse(dataMatch[1]) as QwenStreamChunk;
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
				const errorData = axiosError.response?.data as { error?: { message?: string } };
				const errorMessage = errorData?.error?.message || axiosError.message;

				handler.onError(
					new ModelProviderError(
						`Qwen streaming failed: ${errorMessage}`,
						this.id,
						modelId,
						String(axiosError.response?.status || 'NETWORK_ERROR')
					)
				);
			} else {
				handler.onError(
					new ModelProviderError(
						`Qwen streaming failed: ${error instanceof Error ? error.message : String(error)}`,
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
		if (!this._isReady || !this.client) {
			throw new ModelProviderError('Qwen provider not initialized', this.id);
		}

		try {
			// If the API provides token counting endpoint, use it
			const response = await this.client.post('/tokenize', {
				text
			});

			return response.data.token_count;
		} catch (error: unknown) {
			// Fall back to approximation if token counting endpoint fails
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Token counting API failed: ${errorMessage}. Using approximation.`);

			// Simple approximation: ~4 characters per token for English text
			return Math.ceil(text.length / 4);
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
		// Return the best model for each capability
		switch (capability) {
			case ModelCapability.CodeGeneration:
			case ModelCapability.Refactoring:
				return 'qwen-max'; // Best for code tasks

			case ModelCapability.Explanation:
			case ModelCapability.Planning:
				return 'qwen-plus'; // Good balance for explanations

			case ModelCapability.ChatCompletion:
			case ModelCapability.CodeCompletion:
				return 'qwen-turbo'; // Fastest for quick completions

			default:
				// For other capabilities, use the most capable model
				return 'qwen-max';
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.client = null;
		this._isReady = false;
		this.logger.debug('Qwen provider disposed');
	}
}
