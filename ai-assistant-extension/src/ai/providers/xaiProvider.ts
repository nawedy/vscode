/**
 * XAI Provider
 *
 * Provider implementation for XAI API integration.
 * Supports Xenova's AI models for code generation and completions.
 */

import * as vscode from 'vscode';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import {
	BaseModelProvider,
	ModelInfo,
	ModelCapability,
	ModelRequestOptions,
	CompletionOptions,
	ModelProviderError,
	StreamingResponseHandler,
	ModelResponse,
	TokenUsageInfo
} from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * XAI API response types
 */
interface XAIResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message?: {
			role: string;
			content: string;
		};
		delta?: {
			role?: string;
			content?: string;
		};
		finish_reason: string | null;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * XAI API message structure
 */
interface XAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * XAI completion request structure
 */
interface XAICompletionRequest {
	model: string;
	messages: XAIMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stream?: boolean;
}

/**
 * XAI streaming response chunk structure
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
	private readonly client: AxiosInstance;
	private readonly apiUrl: string;
	private readonly streamChunkSize: number = 8192;
	private readonly availableModels: Map<string, ModelInfo> = new Map();

	/**
	 * Create a new XAI provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('xai', 'XAI', configService, logger);

		this.apiUrl = 'https://api.xai.com/v1';

		// Create Axios instance
		this.client = axios.create({
			baseURL: this.apiUrl,
			timeout: 60000
		});

		// Initialize models
		this.initializeModels();
	}

	/**
	 * Initialize model information
	 */
	private initializeModels(): void {
		const models: ModelInfo[] = [
			{
				id: 'xai-large',
				name: 'XAI Large',
				contextLength: 16384,
				capabilities: [
					ModelCapability.Completion,
					ModelCapability.Chat,
					ModelCapability.CodeGeneration,
					ModelCapability.Explanation
				],
				available: true
			},
			{
				id: 'xai-mega',
				name: 'XAI Mega',
				contextLength: 32768,
				capabilities: [
					ModelCapability.Completion,
					ModelCapability.Chat,
					ModelCapability.CodeGeneration,
					ModelCapability.Refactoring,
					ModelCapability.Explanation,
					ModelCapability.Testing
				],
				available: true
			},
			{
				id: 'xai-code',
				name: 'XAI Code',
				contextLength: 32768,
				capabilities: [
					ModelCapability.CodeGeneration,
					ModelCapability.Refactoring,
					ModelCapability.Explanation
				],
				available: true
			}
		];

		// Add models to the map
		for (const model of models) {
			this.models.set(model.id, model);
			this.availableModels.set(model.id, model);
		}
	}

	/**
	 * Initialize the provider
	 */
	public async initialize(): Promise<boolean> {
		try {
			// Check if API key is available
			if (!this.hasApiKey()) {
				this.logger?.warn('XAI API key not found');
				this._isReady = false;
				return false;
			}

			// Update client with authentication header
			this.client.defaults.headers.common['Authorization'] = `Bearer ${this.getApiKey()}`;

			// Check if API is accessible
			const response = await this.client.get('/models');
			if (response.status === 200) {
				this._isReady = true;
				this.logger?.info('XAI provider initialized successfully');
				return true;
			}

			this.logger?.warn('XAI API is not accessible');
			this._isReady = false;
			return false;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger?.error(`Failed to initialize XAI provider: ${errorMessage}`);
			this._isReady = false;
			return false;
		}
	}

	/**
	 * Get API key from configuration
	 * @returns API key
	 */
	private getApiKey(): string {
		return this.configService?.getSecureValue(`${this.id}.apiKey`) || '';
	}

	/**
	 * Check if API key is available
	 * @returns True if API key exists
	 */
	private hasApiKey(): boolean {
		return Boolean(this.getApiKey());
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
		// Find a suitable model based on capability
		if (capability === ModelCapability.CodeGeneration ||
			capability === ModelCapability.Refactoring) {
			return 'xai-code';
		} else if (capability === ModelCapability.Explanation) {
			return 'xai-mega';
		}

		// Default model for general capabilities
		return 'xai-large';
	}

	/**
	 * Generate completion from a prompt
	 */
	public async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this._isReady) {
			throw new ModelProviderError('XAI provider not initialized', this.id);
		}

		try {
			const modelId = options?.modelParams?.modelId as string ||
				await this.getDefaultModelForCapability(options?.capability || ModelCapability.Completion);

			if (!modelId) {
				throw new ModelProviderError('No suitable model found', this.id);
			}

			// Prepare messages
			const messages = [{
				role: 'user',
				content: prompt
			}];

			if (options?.systemPrompt) {
				messages.unshift({
					role: 'system',
					content: options.systemPrompt
				});
			}

			// Make request
			const response = await this.client.post('/chat/completions', {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1.0,
				max_tokens: options?.maxTokens ?? 1024,
				stop: options?.stopSequences
			});

			const data = response.data;
			const content = data.choices[0]?.message?.content || '';
			const promptTokens = data.usage?.prompt_tokens || 0;
			const completionTokens = data.usage?.completion_tokens || 0;

			// Track token usage
			this.updateTokenUsage({
				provider: this.id,
				model: modelId,
				promptTokens,
				completionTokens,
				totalTokens: promptTokens + completionTokens
			});

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
					`XAI request failed: ${errorMessage}`,
					this.id,
					options?.modelParams?.modelId as string
				);
			}

			throw new ModelProviderError(
				`XAI request failed: ${error instanceof Error ? error.message : String(error)}`,
				this.id
			);
		}
	}

	/**
	 * Generate completion from a prompt with streaming response
	 */
	public async generateCompletionStream(
		prompt: string,
		handler: StreamingResponseHandler,
		options?: ModelRequestOptions
	): Promise<void> {
		if (!this._isReady) {
			throw new ModelProviderError('XAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string ||
			await this.getDefaultModelForCapability(options?.capability || ModelCapability.Completion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for streaming', this.id);
		}

		try {
			// Prepare messages
			const messages = [{
				role: 'user',
				content: prompt
			}];

			if (options?.systemPrompt) {
				messages.unshift({
					role: 'system',
					content: options.systemPrompt
				});
			}

			// Make streaming request
			const response = await this.client.post('/chat/completions', {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1.0,
				max_tokens: options?.maxTokens ?? 1024,
				stream: true,
				stop: options?.stopSequences
			}, {
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

						const data = JSON.parse(dataMatch[1]);
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
					this.logger?.debug(`Failed to parse streaming chunk: ${error instanceof Error ? error.message : String(error)}`);
				}
			});

			response.data.on('error', (error: Error) => {
				handler.onError(new ModelProviderError(`Stream error: ${error.message}`, this.id, modelId));
			});

			response.data.on('end', () => {
				// Estimate token counts
				promptTokens = Math.ceil(prompt.length / 4);
				completionTokens = Math.ceil(accumulatedContent.length / 4);

				// Track token usage
				this.updateTokenUsage({
					provider: this.id,
					model: modelId,
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens
				});

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
						`XAI streaming failed: ${errorMessage}`,
						this.id,
						modelId,
						String(axiosError.response?.status || 'NETWORK_ERROR')
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
		// Simple token estimation - in a real implementation this would be more accurate
		return Math.ceil(text.length / 4);
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this._isReady = false;
		this.logger?.debug('XAI provider disposed');
	}
}
