/**
 * OpenAI Provider
 *
 * Provider implementation for OpenAI API integration.
 * Supports various OpenAI models for different capabilities.
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
 * OpenAI provider for LLM models
// @ts-ignore: error TS2415: Class 'OpenAIProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'OpenAIProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'OpenAIProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'OpenAIProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'OpenAIProvider' incorrectly extends base class 'BaseModelProvider'.
// @ts-ignore: error TS2415: Class 'OpenAIProvider' incorrectly extends base class 'BaseModelProvider'.
 */
export class OpenAIProvider extends BaseModelProvider {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private apiKey: string = '';
	private client: AxiosInstance | null = null;
	private baseUrl: string = 'https://api.openai.com/v1';

	/**
	 * Create a new OpenAI provider
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		super('openai', 'OpenAI');
		this.configService = configService;
		this.logger = logger;
	}

	/**
	 * Initialize the OpenAI provider
	 * @returns Whether initialization was successful
	 */
	async initialize(): Promise<boolean> {
		try {
			this.logger.info('Initializing OpenAI provider');

			// Get API key
			this.apiKey = await this.configService.getSecret('openai.apiKey') || '';
			if (!this.apiKey) {
				this.logger.warn('OpenAI API key not found');
				return false;
			}

			// Get base URL (for Azure OpenAI or other endpoints)
			this.baseUrl = this.configService.get<string>(
				'providers.openai.baseUrl',
				'https://api.openai.com/v1'
			);

			// Initialize API client
			this.client = axios.create({
				baseURL: this.baseUrl,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: this.configService.get<number>('providers.openai.timeout', 30000)
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
	 * Load available models
	 */
	private async loadModels(): Promise<void> {
		try {
			// Define standard models
			const standardModels: ModelInfo[] = [
				{
					id: 'gpt-4o',
					name: 'GPT-4o',
					contextLength: 128000,
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
					id: 'gpt-4-turbo',
					name: 'GPT-4 Turbo',
					contextLength: 128000,
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
					id: 'gpt-4',
					name: 'GPT-4',
					contextLength: 8192,
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
					id: 'gpt-3.5-turbo',
					name: 'GPT-3.5 Turbo',
					contextLength: 16385,
					capabilities: [
						ModelCapability.CodeGeneration,
						ModelCapability.CodeCompletion,
						ModelCapability.Refactoring,
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

						// Add model if it's likely to be useful for code
						if (model.id.includes('gpt-4') ||
							model.id.includes('gpt-3.5') ||
							model.id.includes('codex') ||
							model.id.includes('code')) {

							const capabilities = this.inferModelCapabilities(model.id);

							this.models.set(model.id, {
								id: model.id,
								name: model.id,
								contextLength: this.getContextLengthForModel(model.id),
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
	async generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('OpenAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.CodeGeneration);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for generation', this.id);
		}

		try {
			// Use chat API for modern models
			if (modelId.includes('gpt-')) {
				const response = await this.client.post('/chat/completions', {
					model: modelId,
					messages: [{
						role: 'user',
						content: prompt
					}],
					temperature: options?.temperature ?? 0.3,
					top_p: options?.topP ?? 0.95,
					max_tokens: options?.maxTokens ?? 2048,
					stop: options?.stopSequences,
					stream: false
				});

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
			} else {
				// Use completions API for older models
				const response = await this.client.post('/completions', {
					model: modelId,
					prompt,
					temperature: options?.temperature ?? 0.3,
					top_p: options?.topP ?? 0.95,
					max_tokens: options?.maxTokens ?? 2048,
					stop: options?.stopSequences,
					stream: false
				});

				const content = response.data.choices[0]?.text || '';

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
			}
		} catch (error) {
			if (axios.isAxiosError(error)) {
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
// @ts-ignore: error TS2339: Property 'error' does not exist on type 'unknown'.
				throw new ModelProviderError(
					`OpenAI generation failed: ${error.response?.data?.error?.message || error.message}`,
					this.id,
					modelId,
					String(error.response?.status || 'NETWORK_ERROR')
				);
			}
			throw new ModelProviderError(`OpenAI generation failed: ${error instanceof Error ? error.message : String(error)}`, this.id, modelId);
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
			throw new ModelProviderError('OpenAI provider not initialized', this.id);
		}

		const modelId = options?.modelParams?.modelId as string || await this.getDefaultModelForCapability(ModelCapability.CodeGeneration);

		if (!modelId) {
			throw new ModelProviderError('No suitable model found for generation', this.id);
		}

		try {
			if (modelId.includes('gpt-')) {
				// Use chat API with streaming for modern models
				const response = await this.client.post('/chat/completions', {
					model: modelId,
					messages: [{
						role: 'user',
						content: prompt
					}],
					temperature: options?.temperature ?? 0.3,
					top_p: options?.topP ?? 0.95,
					max_tokens: options?.maxTokens ?? 2048,
					stop: options?.stopSequences,
					stream: true
				}, {
					responseType: 'stream'
				});

				let accumulatedText = '';
				let finishReason = '';

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
								accumulatedText += content;
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
					const promptTokens = Math.ceil(prompt.length / 4);
					const completionTokens = Math.ceil(accumulatedText.length / 4);

					handler.onComplete({
						content: accumulatedText,
						promptTokens,
						completionTokens,
						totalTokens: promptTokens + completionTokens,
						metadata: {
							model: modelId,
							finishReason: finishReason || 'stop'
						}
					});
				});
			} else {
				// Use completions API with streaming for older models
				const response = await this.client.post('/completions', {
					model: modelId,
					prompt,
					temperature: options?.temperature ?? 0.3,
					top_p: options?.topP ?? 0.95,
					max_tokens: options?.maxTokens ?? 2048,
					stop: options?.stopSequences,
					stream: true
				}, {
					responseType: 'stream'
				});

				let accumulatedText = '';
				let finishReason = '';

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
							const content = data.choices[0]?.text || '';

							if (content) {
								accumulatedText += content;
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
					const promptTokens = Math.ceil(prompt.length / 4);
					const completionTokens = Math.ceil(accumulatedText.length / 4);

					handler.onComplete({
						content: accumulatedText,
						promptTokens,
						completionTokens,
						totalTokens: promptTokens + completionTokens,
						metadata: {
							model: modelId,
							finishReason: finishReason || 'stop'
						}
					});
				});
			}
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
						`OpenAI streaming failed: ${error.response?.data?.error?.message || error.message}`,
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
	async countTokens(text: string): Promise<number> {
		if (!this.isReady || !this.client) {
			throw new ModelProviderError('OpenAI provider not initialized', this.id);
		}

		// OpenAI doesn't have a specific token counting API
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

		// All OpenAI models support basic code completion
		capabilities.push(ModelCapability.CodeCompletion);

		if (lowerModelId.includes('gpt-4')) {
			// GPT-4 models support all capabilities
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.Refactoring);
			capabilities.push(ModelCapability.SecurityAnalysis);
			capabilities.push(ModelCapability.Testing);
			capabilities.push(ModelCapability.Explanation);
			capabilities.push(ModelCapability.Planning);
		} else if (lowerModelId.includes('gpt-3.5')) {
			// GPT-3.5 models support most capabilities
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.Refactoring);
			capabilities.push(ModelCapability.Explanation);
		} else if (lowerModelId.includes('codex') || lowerModelId.includes('code')) {
			// Codex models are specialized for code
			capabilities.push(ModelCapability.CodeGeneration);
			capabilities.push(ModelCapability.Refactoring);
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
		if (lowerModelId.includes('gpt-4o')) {
			return 128000;
		} else if (lowerModelId.includes('gpt-4-turbo') || lowerModelId.includes('gpt-4-1106')) {
			return 128000;
		} else if (lowerModelId.includes('gpt-4-32k')) {
			return 32768;
		} else if (lowerModelId.includes('gpt-4')) {
			return 8192;
		} else if (lowerModelId.includes('gpt-3.5-turbo-16k')) {
			return 16385;
		} else if (lowerModelId.includes('gpt-3.5-turbo')) {
			return 4096;
		} else if (lowerModelId.includes('davinci')) {
			return 4096;
		} else {
			// Default for unknown models
			return 2048;
		}
	}
}
