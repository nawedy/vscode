/**
 * Local LLM Provider
 *
 * Provider implementation for running local language models.
 * Supports local inference via various backends (ollama, llama.cpp, etc).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import { BaseModelProvider, ModelCapability, ModelInfo, ModelProviderError, ModelRequestOptions, ModelResponse, StreamingResponseHandler } from './baseProvider';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * Local LLM message format
 */
interface LocalLLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Local LLM completion request parameters
 */
interface LocalLLMCompletionRequest {
	model: string;
	messages: LocalLLMMessage[];
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stream?: boolean;
	stop?: string[];
}

/**
 * Local LLM API response format
 */
interface LocalLLMCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: LocalLLMMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Local LLM stream chunk format
 */
interface LocalLLMStreamChunk {
	id?: string;
	object?: string;
	created?: number;
	model?: string;
	choices?: {
		index?: number;
		delta?: {
			role?: string;
			content?: string;
		};
		finish_reason?: string | null;
	}[];
}

/**
 * Provider type for local LLM
 */
enum LocalLLMProviderType {
	Ollama = 'ollama',
	LlamaCpp = 'llama.cpp',
	LocalAI = 'localai',
	Custom = 'custom'
}

/**
 * Provider for Local LLMs
 */
export class LocalLLMProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private client: AxiosInstance | null = null;
	private baseUrl: string = 'http://localhost:11434/v1';
	private modelPath: string = '';
	private providerType: LocalLLMProviderType = LocalLLMProviderType.Ollama;

	/**
	 * Create a new Local LLM provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('localllm', 'Local LLM', configService, logger);
		this.configService = configService;
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing Local LLM provider');

			// Get provider configuration
			this.providerType = this.configService.get<LocalLLMProviderType>(
				'providers.localLLM.type',
				LocalLLMProviderType.Ollama
			);

			// Get base URL based on provider type
			switch (this.providerType) {
				case LocalLLMProviderType.Ollama:
					this.baseUrl = this.configService.get<string>(
						'providers.localLLM.ollama.baseUrl',
						'http://localhost:11434/v1'
					);
					break;
				case LocalLLMProviderType.LlamaCpp:
					this.baseUrl = this.configService.get<string>(
						'providers.localLLM.llamaCpp.baseUrl',
						'http://localhost:8080/v1'
					);
					break;
				case LocalLLMProviderType.LocalAI:
					this.baseUrl = this.configService.get<string>(
						'providers.localLLM.localAI.baseUrl',
						'http://localhost:8080/v1'
					);
					break;
				case LocalLLMProviderType.Custom:
					this.baseUrl = this.configService.get<string>(
						'providers.localLLM.custom.baseUrl',
						'http://localhost:8080/v1'
					);
					break;
				default:
					this.baseUrl = 'http://localhost:11434/v1';
			}

			// Get model path if applicable
			this.modelPath = this.configService.get<string>(
				'providers.localLLM.modelPath',
				''
			);

			// Initialize API client
			this.client = axios.create({
				baseURL: this.baseUrl,
				headers: {
					'Content-Type': 'application/json'
				},
				timeout: 60000
			});

			// Try to load available models
			try {
				await this.loadModels();
				this._isReady = true;
				this.logger.info('Local LLM provider initialized successfully');
				return true;
			} catch (error) {
				this.logger.error(`Failed to load Local LLM models: ${error instanceof Error ? error.message : String(error)}`);
				return false;
			}
		} catch (error) {
			this.logger.error(`Failed to initialize Local LLM provider: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Load available models
	 */
	private async loadModels(): Promise<void> {
		try {
			// Different approaches based on provider type
			switch (this.providerType) {
				case LocalLLMProviderType.Ollama:
					await this.loadOllamaModels();
					break;
				case LocalLLMProviderType.LlamaCpp:
				case LocalLLMProviderType.LocalAI:
				case LocalLLMProviderType.Custom:
					await this.loadGenericModels();
					break;
			}

			this.logger.info(`Loaded ${this.models.size} Local LLM models`);
		} catch (error) {
			throw new Error(`Failed to load Local LLM models: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Load Ollama models
	 */
	private async loadOllamaModels(): Promise<void> {
		if (!this.client) {
			throw new Error('Client not initialized');
		}

		try {
			const response = await this.client.get('/models');
			const models = response.data.models || [];

			for (const model of models) {
				const capabilities = this.inferModelCapabilities(model.name);
				const contextLength = this.inferContextLength(model.name);

				this.models.set(model.name, {
					id: model.name,
					name: model.name,
					contextLength,
					capabilities,
					available: true
				});
			}
		} catch (error) {
			// Fall back to some standard models
			this.addDefaultModels();
			throw new Error(`Failed to fetch Ollama models: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Load generic models for other providers
	 */
	private async loadGenericModels(): Promise<void> {
		// For non-Ollama providers, we add default models
		// based on common local models
		this.addDefaultModels();
	}

	/**
	 * Add default models when API discovery fails
	 */
	private addDefaultModels(): void {
		const defaultModels: Array<[string, ModelInfo]> = [
			[
				'llama2',
				{
					id: 'llama2',
					name: 'LLaMA 2',
					contextLength: 4096,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.Explanation
					],
					available: true
				}
			],
			[
				'llama3',
				{
					id: 'llama3',
					name: 'LLaMA 3',
					contextLength: 8192,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.Explanation
					],
					available: true
				}
			],
			[
				'mistral',
				{
					id: 'mistral',
					name: 'Mistral 7B',
					contextLength: 8192,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.Explanation
					],
					available: true
				}
			],
			[
				'codellama',
				{
					id: 'codellama',
					name: 'CodeLLaMA',
					contextLength: 16384,
					capabilities: [
						ModelCapability.ChatCompletion,
						ModelCapability.CodeCompletion,
						ModelCapability.CodeGeneration,
						ModelCapability.Refactoring
					],
					available: true
				}
			]
		];

		// Add models to the map
		defaultModels.forEach(([id, info]) => {
			this.models.set(id, info);
		});
	}

	/**
	 * Generate completion from a prompt
	 * @param prompt The prompt text
	 * @param options Request options
	 * @returns Model response
	 */
	public async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('Local LLM provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for completion', this.id);
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

			// Prepare request based on provider type
			const request: LocalLLMCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stop: options?.stopSequences,
				stream: false
			};

			const endpoint = this.getCompletionEndpoint();
			const response = await this.client.post<LocalLLMCompletionResponse>(endpoint, request);

			// Extract content based on provider type
			const content = this.extractContentFromResponse(response.data);

			return {
				content,
				promptTokens: response.data.usage?.prompt_tokens || this.estimateTokenCount(prompt),
				completionTokens: response.data.usage?.completion_tokens || this.estimateTokenCount(content),
				totalTokens: response.data.usage?.total_tokens ||
					(this.estimateTokenCount(prompt) + this.estimateTokenCount(content)),
				metadata: {
					model: modelId,
					provider: this.id,
					finishReason: response.data.choices?.[0]?.finish_reason || 'stop'
				}
			};
		} catch (error) {
			throw new ModelProviderError(
				`Local LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
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
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('Local LLM provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.ChatCompletion);

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
			const request: LocalLLMCompletionRequest = {
				model: modelId,
				messages,
				temperature: options?.temperature ?? 0.7,
				top_p: options?.topP ?? 1,
				max_tokens: options?.maxTokens,
				stop: options?.stopSequences,
				stream: true
			};

			const endpoint = this.getCompletionEndpoint();
			const response = await this.client.post(endpoint, request, {
				responseType: 'stream'
			});

			let accumulatedContent = '';
			let finishReason = '';
			const promptTokens = this.estimateTokenCount(prompt);
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

						const data = JSON.parse(dataMatch[1]) as LocalLLMStreamChunk;
						const content = data.choices?.[0]?.delta?.content || '';

						if (content) {
							accumulatedContent += content;
							handler.onContent(content);
							completionTokens = this.estimateTokenCount(accumulatedContent);
						}

						if (data.choices?.[0]?.finish_reason) {
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
				// Calculate final token counts
				completionTokens = this.estimateTokenCount(accumulatedContent);

				handler.onComplete({
					content: accumulatedContent,
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens,
					metadata: {
						model: modelId,
						provider: this.id,
						finishReason: finishReason || 'stop'
					}
				});
			});
		} catch (error) {
			handler.onError(
				new ModelProviderError(
					`Local LLM streaming failed: ${error instanceof Error ? error.message : String(error)}`,
					this.id,
					modelId
				)
			);
		}
	}

	/**
	 * Get the appropriate completion endpoint based on provider type
	 * @returns API endpoint path
	 */
	private getCompletionEndpoint(): string {
		switch (this.providerType) {
			case LocalLLMProviderType.Ollama:
				return '/chat/completions';
			case LocalLLMProviderType.LocalAI:
			case LocalLLMProviderType.LlamaCpp:
			case LocalLLMProviderType.Custom:
			default:
				return '/chat/completions';
		}
	}

	/**
	 * Extract content from response based on provider type
	 * @param response API response
	 * @returns Extracted content
	 */
	private extractContentFromResponse(response: LocalLLMCompletionResponse): string {
		// Extract based on provider type
		switch (this.providerType) {
			case LocalLLMProviderType.Ollama:
				return response.choices?.[0]?.message?.content || '';
			case LocalLLMProviderType.LlamaCpp:
			case LocalLLMProviderType.LocalAI:
			case LocalLLMProviderType.Custom:
			default:
				return response.choices?.[0]?.message?.content || '';
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
	 * Infer model capabilities from model name
	 * @param modelName Model name
	 * @returns Array of capabilities
	 */
	private inferModelCapabilities(modelName: string): ModelCapability[] {
		const capabilities: ModelCapability[] = [ModelCapability.ChatCompletion];
		const lowerName = modelName.toLowerCase();

		// Code-related models
		if (
			lowerName.includes('code') ||
			lowerName.includes('starcoder') ||
			lowerName.includes('wizardcoder') ||
			lowerName.includes('deepseek-coder') ||
			lowerName.includes('phind')
		) {
			capabilities.push(ModelCapability.CodeCompletion);
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.Refactoring);
		}

		// Math or reasoning models
		if (
			lowerName.includes('math') ||
			lowerName.includes('wizard')
		) {
			capabilities.push(ModelCapability.Explanation);
		}

		// Any large or advanced model
		if (
			lowerName.includes('13b') ||
			lowerName.includes('34b') ||
			lowerName.includes('70b') ||
			lowerName.includes('7b-instruct') ||
			lowerName.includes('llama-3')
		) {
			capabilities.push(ModelCapability.Explanation);
			capabilities.push(ModelCapability.CodeCompletion);
		}

		// Specific models with known capabilities
		if (lowerName.includes('llama3') || lowerName.includes('llama-3')) {
			capabilities.push(ModelCapability.Planning);
		}

		return capabilities;
	}

	/**
	 * Infer context length from model name
	 * @param modelName Model name
	 * @returns Context length
	 */
	private inferContextLength(modelName: string): number {
		const lowerName = modelName.toLowerCase();

		if (lowerName.includes('llama-3') || lowerName.includes('llama3')) {
			return 8192;
		} else if (lowerName.includes('mistral') || lowerName.includes('mixtral')) {
			return 8192;
		} else if (lowerName.includes('codellama')) {
			return 16384;
		} else if (lowerName.includes('deepseek')) {
			return 4096;
		}

		// Default
		return 4096;
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
		const preferredModel = this.configService.get<string>('providers.localLLM.preferredModel', '');

		if (preferredModel && this.models.has(preferredModel)) {
			const model = this.models.get(preferredModel);
			if (model && model.capabilities.includes(capability)) {
				return model.id;
			}
		}

		// Find a model with the requested capability
		const models = Array.from(this.models.values())
			.filter(model => model.capabilities.includes(capability))
			.sort((a, b) => b.contextLength - a.contextLength); // Prefer larger context

		return models.length > 0 ? models[0].id : null;
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this._isReady = false;
		this.client = null;
	}
}
