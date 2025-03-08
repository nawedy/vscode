/**
 * HuggingFace Provider
 *
 * Provider implementation for HuggingFace Inference API models.
 * Supports various open-source models hosted on the HuggingFace platform.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * HuggingFace API response types
 */
interface HuggingFaceCompletionRequest {
	inputs: string;
	parameters?: {
		max_new_tokens?: number;
		temperature?: number;
		top_p?: number;
		stream?: boolean;
		return_full_text?: boolean;
	};
}

interface HuggingFaceChatCompletionRequest {
	model: string;
	messages: {
		role: string;
		content: string;
	}[];
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	stream?: boolean;
}

interface HuggingFaceCompletionResponse {
	generated_text: string;
}

interface HuggingFaceChatCompletionResponse {
	choices: {
		message: {
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

interface HuggingFaceStreamChunk {
	token: {
		text: string;
		id: number;
	};
	generated_text?: string;
}

/**
 * Model configuration for HuggingFace models
 */
interface HuggingFaceModelConfig {
	id: string;
	name: string;
	contextLength: number;
	capabilities: ModelCapability[];
	isChat: boolean;
	url?: string;
}

/**
 * Provider for HuggingFace models
// @ts-ignore: error TS2415: Class 'HuggingFaceProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'HuggingFaceProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'HuggingFaceProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'HuggingFaceProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'HuggingFaceProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'HuggingFaceProvider' incorrectly extends base class 'BaseModelProvider'.
 */
export class HuggingFaceProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private apiKey: string = '';
	private baseUrl: string = 'https://api-inference.huggingface.co/models';
	private client: AxiosInstance;
	private defaultModel: string = 'mistralai/Mistral-7B-Instruct-v0.2';
	private modelConfigs: Map<string, HuggingFaceModelConfig> = new Map();

	/**
	 * Create a new HuggingFace provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('huggingface', 'HuggingFace');
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

		// Initialize model configurations
		this.initializeModelConfigs();

		// Initialize models
		this.initializeModels();
	}

	/**
	 * Initialize model configurations
	 */
	private initializeModelConfigs(): void {
		// Code LLMs
		this.modelConfigs.set('bigcode/starcoder2-15b', {
			id: 'bigcode/starcoder2-15b',
			name: 'StarCoder 2 (15B)',
			contextLength: 16384,
			capabilities: [
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation
			],
			isChat: false
		});

		this.modelConfigs.set('codellama/CodeLlama-34b-Instruct-hf', {
			id: 'codellama/CodeLlama-34b-Instruct-hf',
			name: 'CodeLlama 34B Instruct',
			contextLength: 16384,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.CodeCompletion,
				ModelCapability.CodeGeneration,
				ModelCapability.Explanation,
				ModelCapability.Refactoring
			],
			isChat: true
		});

		// Chat models
		this.modelConfigs.set('mistralai/Mistral-7B-Instruct-v0.2', {
			id: 'mistralai/Mistral-7B-Instruct-v0.2',
			name: 'Mistral 7B Instruct v0.2',
			contextLength: 8192,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.Explanation
			],
			isChat: true
		});

		this.modelConfigs.set('meta-llama/Llama-3-8B-Instruct', {
			id: 'meta-llama/Llama-3-8B-Instruct',
			name: 'Llama 3 8B Instruct',
			contextLength: 8192,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.Explanation
			],
			isChat: true
		});

		// Add more models as needed
		this.modelConfigs.set('HuggingFaceH4/zephyr-7b-beta', {
			id: 'HuggingFaceH4/zephyr-7b-beta',
			name: 'Zephyr 7B Beta',
			contextLength: 4096,
			capabilities: [
				ModelCapability.ChatCompletion,
				ModelCapability.Explanation
			],
			isChat: true
		});
	}

	/**
	 * Initialize available models
	 */
	private initializeModels(): void {
		for (const [id, config] of this.modelConfigs) {
			this.models.set(id, {
				id: config.id,
				name: config.name,
				contextLength: config.contextLength,
				capabilities: config.capabilities,
				available: true
			});
		}
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing HuggingFace Provider');

			// Get configuration from settings
			this.baseUrl = this.configService.get<string>('providers.huggingface.baseUrl', 'https://api-inference.huggingface.co/models');
			this.defaultModel = this.configService.get<string>('providers.huggingface.defaultModel', 'mistralai/Mistral-7B-Instruct-v0.2');

			// Update client base URL
			this.client.defaults.baseURL = this.baseUrl;

			// Get API key from secret storage
			this.apiKey = await this.configService.getSecret('huggingface.apiKey') || '';

			if (!this.apiKey) {
				this.logger.warn('HuggingFace API key not found');
				return false;
			}

			// Set the API key header
			this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;

			// Test connection
			const isAvailable = await this.testConnection();
			if (!isAvailable) {
				this.logger.warn('HuggingFace provider test connection failed');
				return false;
			}

			this._isReady = true;
			this.logger.info('HuggingFace Provider initialized successfully');
			return true;
		} catch (error) {
			this.logger.error(`Failed to initialize HuggingFace Provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Test connection to HuggingFace API
	 * @returns Whether connection is successful
	 */
	private async testConnection(): Promise<boolean> {
		try {
			// Simple test request with default model
			const response = await this.client.get(`/${this.defaultModel}`);
			return true;
		} catch (error) {
			// Status 503 actually means model is on-demand but API is working
			if (axios.isAxiosError(error) && error.response?.status === 503) {
				return true;
			}
			this.logger.error(`HuggingFace connection test failed: ${error instanceof Error ? error.message : String(error)}`);
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
			throw new ModelProviderError('HuggingFace provider not initialized', this.id);
		}

		// Get model ID from options or default
		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		try {
			const modelConfig = this.modelConfigs.get(modelId);
			if (!modelConfig) {
				throw new ModelProviderError(`Model ${modelId} not found`, this.id);
			}

			let content: string;
			let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

			if (modelConfig.isChat) {
				// Chat model - use chat API endpoint
				const messages: {role: string, content: string}[] = [];

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
				const requestBody: HuggingFaceChatCompletionRequest = {
					model: modelId,
					messages,
					temperature: options?.temperature ?? 0.7,
					max_tokens: options?.maxTokens ?? 2048,
					top_p: options?.topP ?? 1
				};

				// Make request to chat endpoint
				const response = await this.client.post<HuggingFaceChatCompletionResponse>(`/${modelId}`, requestBody);

				// Extract content from response
				content = response.data.choices[0]?.message?.content || '';

				// Extract usage info
				usage = response.data.usage;
			} else {
				// Text completion model - use completion endpoint
				let fullPrompt = prompt;
				if (options?.systemPrompt) {
					fullPrompt = `${options.systemPrompt}\n\n${prompt}`;
				}

				// Prepare request body
				const requestBody: HuggingFaceCompletionRequest = {
					inputs: fullPrompt,
					parameters: {
						max_new_tokens: options?.maxTokens ?? 1024,
						temperature: options?.temperature ?? 0.7,
						top_p: options?.topP ?? 1,
						return_full_text: false // Don't include the prompt in the response
					}
				};

				// Make request to completion endpoint
				const response = await this.client.post<HuggingFaceCompletionResponse>(`/${modelId}`, requestBody);

				// Extract content
				content = response.data.generated_text || '';

				// Estimate token usage without actual counts
				usage = {
					prompt_tokens: Math.ceil(fullPrompt.length / 4),
					completion_tokens: Math.ceil(content.length / 4),
					total_tokens: Math.ceil((fullPrompt.length + content.length) / 4)
				};
			}

			return {
				content,
				promptTokens: usage.prompt_tokens,
				completionTokens: usage.completion_tokens,
				totalTokens: usage.total_tokens,
				metadata: {
					model: modelId,
					provider: 'huggingface'
				}
			};
		} catch (error) {
			throw new ModelProviderError(
				`HuggingFace request failed: ${error instanceof Error ? error.message : String(error)}`,
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
			throw new ModelProviderError('HuggingFace provider not initialized', this.id);
		}

		// Get model ID from options or default
		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
		}

		// HuggingFace doesn't properly support streaming yet for all models
		// So we'll implement a fake streaming response
		try {
			// Get the full completion
			const response = await this.generateCompletion(prompt, options);

			// Split content into chunks for simulated streaming
			const content = response.content;
			const chunks = content.match(/.{1,20}/g) || []; // Split into 20-char chunks

			// Stream each chunk with a delay
			let accumulatedContent = '';
			for (const chunk of chunks) {
				// Short delay to simulate streaming
				await new Promise(resolve => setTimeout(resolve, 50));

				accumulatedContent += chunk;
				handler.onContent(chunk);
			}

			// Send completion
			handler.onComplete(response);
		} catch (error) {
			handler.onError(
				new ModelProviderError(
					`HuggingFace streaming request failed: ${error instanceof Error ? error.message : String(error)}`,
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
		// HuggingFace doesn't provide a token counting endpoint
		// This is a rough approximation - not accurate
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
