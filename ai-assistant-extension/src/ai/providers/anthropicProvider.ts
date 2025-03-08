import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
// @ts-ignore: error TS2307: Cannot find module '../../utils/stream' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module '../../utils/stream' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module '../../utils/stream' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module '../../utils/stream' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module '../../utils/stream' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module '../../utils/stream' or its corresponding type declarations.
import { Logger } from '../../utils/logger';
import { createReadableStreamFromAsyncIterable } from '../../utils/stream';

/**
 * Anthropic API response types
 */
interface AnthropicMessage {
	role: 'user' | 'assistant';
	content: string | AnthropicContent[];
}

interface AnthropicContent {
	type: 'text' | 'image';
	text?: string;
	source?: {
		type: 'base64';
		media_type: string;
		data: string;
	};
}

interface AnthropicCompletionRequest {
	model: string;
	messages: AnthropicMessage[];
	max_tokens?: number;
	temperature?: number;
	top_p?: number;
	stop_sequences?: string[];
	stream?: boolean;
	system?: string;
}

interface AnthropicCompletionResponse {
	id: string;
	model: string;
	type: string;
	role: string;
	content: AnthropicContent[];
	stop_reason: string | null;
	stop_sequence: string | null;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
}

interface AnthropicStreamChunk {
	type: string;
	delta?: {
		type?: string;
		text?: string;
	};
	usage?: {
		input_tokens: number;
		output_tokens: number;
	};
	model?: string;
	index?: number;
	stop_reason?: string | null;
	stop_sequence?: string | null;
}

/**
 * Provider for Anthropic Claude models
// @ts-ignore: error TS2415: Class 'AnthropicProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'AnthropicProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'AnthropicProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'AnthropicProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'AnthropicProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'AnthropicProvider' incorrectly extends base class 'BaseModelProvider'.
 */
export class AnthropicProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private readonly client: AxiosInstance;
	private apiKey: string = '';
	private baseUrl: string = 'https://api.anthropic.com/v1';
	private defaultModel: string = 'claude-3-haiku-20240307';

	/**
	 * Create a new Anthropic provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('anthropic', 'Anthropic Claude');
		this.configService = configService;
		this.logger = logger;

		// Create HTTP client
		this.client = axios.create({
			baseURL: this.baseUrl,
			timeout: 60000,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'anthropic-version': '2023-06-01'
			}
		});

		// Initialize models
		this.initializeModels();
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing Anthropic Provider');

			// Get configuration from settings
			this.baseUrl = this.configService.get<string>(
				'providers.anthropic.baseUrl',
				'https://api.anthropic.com/v1'
			);
			this.defaultModel = this.configService.get<string>(
				'providers.anthropic.defaultModel',
				'claude-3-haiku-20240307'
			);

			// Update axios client base URL
			this.client.defaults.baseURL = this.baseUrl;

			// Get API key from secrets storage
			this.apiKey = await this.configService.getSecret('anthropic.apiKey') || '';

			if (!this.apiKey) {
				this.logger.warn('Anthropic API key not found');
				return false;
			}

			// Set API key header
			this.client.defaults.headers.common['x-api-key'] = this.apiKey;

			// Test connection
			const isAvailable = await this.testConnection();
			if (!isAvailable) {
				this.logger.warn('Anthropic provider test connection failed');
				return false;
			}

			this._isReady = true;
			this.logger.info('Anthropic Provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize Anthropic Provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Test connection to Anthropic API
	 * @returns Whether connection is successful
	 */
	private async testConnection(): Promise<boolean> {
		try {
			// Simple test request to verify API key works
			await this.client.get('/models');
			return true;
		} catch (error) {
			this.logger.error(`Anthropic connection test failed: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Initialize available models
	 */
	private initializeModels(): void {
		// Claude 3 Opus (largest model)
		this.models.set('claude-3-opus-20240229', {
			id: 'claude-3-opus-20240229',
			name: 'Claude 3 Opus',
			contextLength: 200000,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring,
				ModelCapability.Planning,
				ModelCapability.SecurityAnalysis
			],
			available: true
		});

		// Claude 3 Sonnet (balanced model)
		this.models.set('claude-3-sonnet-20240229', {
			id: 'claude-3-sonnet-20240229',
			name: 'Claude 3 Sonnet',
			contextLength: 200000,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring,
				ModelCapability.Planning,
				ModelCapability.SecurityAnalysis
			],
			available: true
		});

		// Claude 3 Haiku (fastest model)
		this.models.set('claude-3-haiku-20240307', {
			id: 'claude-3-haiku-20240307',
			name: 'Claude 3 Haiku',
			contextLength: 200000,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring
			],
			available: true
		});

		// Claude 2.1
		this.models.set('claude-2.1', {
			id: 'claude-2.1',
			name: 'Claude 2.1',
			contextLength: 100000,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring
			],
			available: true
		});

		// Claude Instant
		this.models.set('claude-instant-1.2', {
			id: 'claude-instant-1.2',
			name: 'Claude Instant',
			contextLength: 100000,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion
			],
			available: true
		});
	}

	/**
	 * Generate completion from a prompt
	 * @param prompt The prompt text
	 * @param options Request options
	 * @returns Model response
	 */
	async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this._isReady) {
			throw new ModelProviderError('Anthropic provider not initialized', this.id);
		}

		// Get model ID from options or default
		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for chat completion', this.id);
		}

		try {
			// Construct messages
			const messages: AnthropicMessage[] = [
				{
					role: 'user',
					content: prompt
				}
			];

			// Construct request body
			const requestBody: AnthropicCompletionRequest = {
				model: modelId,
				messages,
				max_tokens: options?.maxTokens ?? 2048,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				stop_sequences: options?.stopSequences || []
			};

			// System prompt if provided
			if (options?.systemPrompt) {
				requestBody.system = options.systemPrompt;
			}

			// Make request
			const response = await this.client.post<AnthropicCompletionResponse>('/messages', requestBody);

			// Extract text content from response
			let content = '';
			for (const contentItem of response.data.content) {
				if (contentItem.type === 'text') {
					content += contentItem.text || '';
				}
			}

			return {
				content,
				promptTokens: response.data.usage.input_tokens,
				completionTokens: response.data.usage.output_tokens,
				totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
				metadata: {
					model: response.data.model,
					provider: 'anthropic'
				}
			};
		} catch (error) {
			throw new ModelProviderError(
				`Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
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
	async generateCompletionStream(
		prompt: string,
		handler: StreamingResponseHandler,
		options?: ModelRequestOptions
	): Promise<void> {
		if (!this._isReady) {
			throw new ModelProviderError('Anthropic provider not initialized', this.id);
		}

		// Get model ID from options or default
		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for chat completion', this.id);
		}

		try {
			// Construct messages
			const messages: AnthropicMessage[] = [
				{
					role: 'user',
					content: prompt
				}
			];

			// Construct request body
			const requestBody: AnthropicCompletionRequest = {
				model: modelId,
				messages,
				max_tokens: options?.maxTokens ?? 2048,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				stop_sequences: options?.stopSequences || [],
				stream: true
			};

			// System prompt if provided
			if (options?.systemPrompt) {
				requestBody.system = options.systemPrompt;
			}

			// Make streaming request
			const response = await this.client.post('/messages', requestBody, {
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
							const parsed = JSON.parse(data) as AnthropicStreamChunk;

							if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
								const content = parsed.delta.text;
								accumulatedContent += content;
								handler.onContent(content);
							} else if (parsed.type === 'message_stop') {
								// Message complete
							} else if (parsed.usage) {
								// Usage information
								promptTokens = parsed.usage.input_tokens;
								completionTokens = parsed.usage.output_tokens;
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
						provider: 'anthropic'
					}
				});
			});

			// Handle errors
			stream.on('error', (err: Error) => {
				handler.onError(
					new ModelProviderError(`Anthropic stream error: ${err.message}`, this.id, modelId)
				);
			});
		} catch (error) {
			handler.onError(
				new ModelProviderError(
					`Anthropic streaming request failed: ${error instanceof Error ? error.message : String(error)}`,
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
	async countTokens(text: string): Promise<number> {
		// Anthropic doesn't provide a token counting endpoint
		// This is a very rough approximation
		return Math.ceil(text.length / 4);
	}

	/**
	 * Get model info by ID
	 * @param modelId Model ID
	 * @returns Model info or null if not found
	 */
	getModelInfo(modelId: string): ModelInfo | null {
		return this.models.get(modelId) || null;
	}

	/**
	 * Get the default model ID for a capability
	 * @param capability Model capability
	 * @returns Model ID or null if no suitable model found
	 */
	async getDefaultModelForCapability(capability: ModelCapability): Promise<string | null> {
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
	dispose(): void {
		this._isReady = false;
		this.models.clear();
	}
}
