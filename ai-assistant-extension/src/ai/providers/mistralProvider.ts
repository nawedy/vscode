/**
 * Mistral Provider
 *
 * Provider implementation for Mistral AI models.
 * Supports Mixtral and Mistral models for code generation, chat, and other capabilities.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * Mistral API response types
 */
interface MistralMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface MistralCompletionRequest {
	model: string;
	messages: MistralMessage[];
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	stream?: boolean;
	safe_prompt?: boolean;
}

interface MistralCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

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
 * Provider for Mistral AI models
// @ts-ignore: error TS2415: Class 'MistralProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'MistralProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'MistralProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'MistralProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'MistralProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'MistralProvider' incorrectly extends base class 'BaseModelProvider'.
 */
export class MistralProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private apiKey: string = '';
	private baseUrl: string = 'https://api.mistral.ai/v1';
	private client: AxiosInstance;
	private defaultModel: string = 'mistral-large-latest';

	/**
	 * Create a new Mistral provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('mistral', 'Mistral AI');
		this.configService = configService;
		this.logger = logger;

		// Create HTTP client
		this.client = axios.create({
			baseURL: this.baseUrl,
			headers: {
				'Content-Type': 'application/json'
			},
			timeout: 60000
		});

		// Initialize models
		this.initializeModels();
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing Mistral Provider');

			// Get configuration from settings
			this.baseUrl = this.configService.get<string>('providers.mistral.baseUrl', 'https://api.mistral.ai/v1');
			this.defaultModel = this.configService.get<string>('providers.mistral.defaultModel', 'mistral-large-latest');

			// Update client base URL
			this.client.defaults.baseURL = this.baseUrl;

			// Get API key from secret storage
			this.apiKey = await this.configService.getSecret('mistral.apiKey') || '';

			if (!this.apiKey) {
				this.logger.warn('Mistral API key not found');
				return false;
			}

			// Set the API key header
			this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;

			// Test connection
			const isAvailable = await this.testConnection();
			if (!isAvailable) {
				this.logger.warn('Mistral provider test connection failed');
				return false;
			}

			this._isReady = true;
			this.logger.info('Mistral Provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize Mistral Provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Initialize available models
	 */
	private initializeModels(): void {
		// Mistral Large
		this.models.set('mistral-large-latest', {
			id: 'mistral-large-latest',
			name: 'Mistral Large (Latest)',
			contextLength: 32768,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring,
				ModelCapability.Planning
			],
			available: true
		});

		// Mixtral 8x7B
		this.models.set('mixtral-8x7b-instruct', {
			id: 'mixtral-8x7b-instruct',
			name: 'Mixtral 8x7B Instruct',
			contextLength: 32768,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring
			],
			available: true
		});

		// Mistral Medium
		this.models.set('mistral-medium-latest', {
			id: 'mistral-medium-latest',
			name: 'Mistral Medium (Latest)',
			contextLength: 32768,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation
			],
			available: true
		});

		// Mistral Small
		this.models.set('mistral-small-latest', {
			id: 'mistral-small-latest',
			name: 'Mistral Small (Latest)',
			contextLength: 32000,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.Explanation
			],
			available: true
		});
	}

	/**
	 * Test connection to Mistral API
	 * @returns Whether connection is successful
	 */
	private async testConnection(): Promise<boolean> {
		try {
			// Simple test request to verify API key works
			await this.client.get('/models');
			return true;
		} catch (error) {
			this.logger.error(`Mistral connection test failed: ${error instanceof Error ? error.message : String(error)}`);
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
		if (!this._isReady) {
			throw new ModelProviderError('Mistral provider not initialized', this.id);
		}

		// Get model ID from options or default
		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		try {
			// Create messages array
			const messages: MistralMessage[] = [];

			// Add system message if provided
			if (options?.systemPrompt) {
				messages.push({
					role: 'system',
					content: options.systemPrompt
				});
			}

			// Add user message (the prompt)
			messages.push({
				role: 'user',
				content: prompt
			});

			// Prepare request body
			const requestBody: MistralCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				max_tokens: options?.maxTokens ?? 2048,
				top_p: options?.topP ?? 1
			};

			// Make request
			const response = await this.client.post<MistralCompletionResponse>('/chat/completions', requestBody);

			// Extract content from the first choice
			const content = response.data.choices[0]?.message?.content || '';

			return {
				content,
				promptTokens: response.data.usage.prompt_tokens,
				completionTokens: response.data.usage.completion_tokens,
				totalTokens: response.data.usage.total_tokens,
				metadata: {
					model: response.data.model,
					provider: 'mistral'
				}
			};
		} catch (error) {
			throw new ModelProviderError(
				`Mistral request failed: ${error instanceof Error ? error.message : String(error)}`,
				this.id,
				modelId
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
		if (!this._isReady) {
			throw new ModelProviderError('Mistral provider not initialized', this.id);
		}

		// Get model ID from options or default
		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		try {
			// Create messages array
			const messages: MistralMessage[] = [];

			// Add system message if provided
			if (options?.systemPrompt) {
				messages.push({
					role: 'system',
					content: options.systemPrompt
				});
			}

			// Add user message (the prompt)
			messages.push({
				role: 'user',
				content: prompt
			});

			// Prepare request body
			const requestBody: MistralCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				max_tokens: options?.maxTokens ?? 2048,
				top_p: options?.topP ?? 1,
				stream: true
			};

			// Make streaming request
			const response = await this.client.post('/chat/completions', requestBody, {
				responseType: 'stream'
			});

			// Process the response stream
			const stream = response.data;
			let accumulatedContent = '';
			let promptTokens = 0;
			let completionTokens = 0;

			// Read event stream
			stream.on('data', (chunk: Buffer) => {
				const lines = chunk.toString().split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.substring(6);

						if (data === '[DONE]') {
							continue;
						}

						try {
							const parsed = JSON.parse(data) as MistralStreamChunk;

							if (parsed.choices && parsed.choices[0]?.delta?.content) {
								const content = parsed.choices[0].delta.content;
								accumulatedContent += content;
								handler.onContent(content);
							}
						} catch (e) {
							this.logger.warn(`Error parsing stream chunk: ${e instanceof Error ? e.message : String(e)}`);
						}
					}
				}
			});

			// Handle end of stream
			stream.on('end', () => {
				handler.onComplete({
					content: accumulatedContent,
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens,
					metadata: {
						model: modelId,
						provider: 'mistral'
					}
				});
			});

			// Handle errors
			stream.on('error', (err: Error) => {
				handler.onError(
					new ModelProviderError(`Mistral stream error: ${err.message}`, this.id, modelId)
				);
			});
		} catch (error) {
			handler.onError(
				new ModelProviderError(
					`Mistral streaming request failed: ${error instanceof Error ? error.message : String(error)}`,
					this.id,
					modelId
				)
			);
		}
	}

	/**
	 * Count tokens in a text
	 * @param text The text to count tokens for
	 * @returns Token count
	 */
	public async countTokens(text: string): Promise<number> {
		// Mistral doesn't provide a token counting endpoint
		// This is a rough approximation - not accurate
		return Math.ceil(text.length / 3);
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
		// Use configured default model if it supports the capability
		const defaultModel = this.models.get(this.defaultModel);

		if (defaultModel && defaultModel.capabilities.includes(capability)) {
			return defaultModel.id;
		}

		// Otherwise find a suitable model based on capability
		for (const [id, model] of this.models.entries()) {
			if (model.capabilities.includes(capability)) {
				return id;
			}
		}

		return null;
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this._isReady = false;
		this.models.clear();
	}
}
