/**
 * Model Manager
 *
 * Manages AI model providers and provides a unified interface
 * for interacting with models across different providers.
 */

import * as vscode from 'vscode';
import {
	BaseModelProvider,
	ModelCapability,
	ModelInfo,
	ModelProviderError,
	ModelRequestOptions,
	ModelResponse,
	StreamingResponseHandler
} from './providers/baseProvider';
import { ProviderRegistry } from './providerRegistry';
import { ConfigService } from '../services/configService';
import { TelemetryService } from '../services/telemetryService';
import { Logger } from '../utils/logger';

/**
 * Class for managing model providers and models
 */
export class ModelManager {
	private readonly registry: ProviderRegistry;
	private readonly configService: ConfigService;
	private readonly telemetryService: TelemetryService;
	private readonly logger: Logger;

	// Event emitter for model ready state changes
	private readonly _onModelReady = new vscode.EventEmitter<BaseModelProvider>();

	/**
	 * Event fired when a model becomes ready
	 */
	public readonly onModelReady = this._onModelReady.event;

	/**
	 * Create a new model manager
	 * @param registry Provider registry
	 * @param configService Configuration service
	 * @param telemetryService Telemetry service
	 * @param logger Logger instance
	 */
	constructor(
		registry: ProviderRegistry,
		configService: ConfigService,
		telemetryService: TelemetryService,
		logger: Logger
	) {
		this.registry = registry;
		this.configService = configService;
		this.telemetryService = telemetryService;
		this.logger = logger;

		// Listen for provider state changes
		this.registry.onProviderStateChanged(provider => {
			if (provider.isReady) {
				this._onModelReady.fire(provider);
			}
		});
	}

	/**
	 * Initialize the model manager
	 */
	public async initialize(): Promise<void> {
		this.logger.info('Initializing model manager');
		await this.registry.initialize();
	}

	/**
	 * Get model providers
	 * @returns Array of providers
	 */
	public getProviders(): BaseModelProvider[] {
		return this.registry.getProviders();
	}

	/**
	 * Get provider by ID
	 * @param providerId Provider ID
	 * @returns Provider or undefined if not found
	 */
	public getProvider(providerId: string): BaseModelProvider | undefined {
		return this.registry.getProvider(providerId);
	}

	/**
	 * Get available providers (those that are ready)
	 * @returns Array of available providers
	 */
	public getAvailableProviders(): BaseModelProvider[] {
		return this.registry.getAvailableProviders();
	}

	/**
	 * Initialize a provider
	 * @param providerId Provider ID
	 * @returns Whether initialization was successful
	 */
	public async initializeProvider(providerId: string): Promise<boolean> {
		return this.registry.initializeProvider(providerId);
	}

	/**
	 * Get all models across all providers
	 * @returns Array of model info objects with provider info
	 */
	public getAllModels(): Array<{ provider: BaseModelProvider; model: ModelInfo }> {
		const result: Array<{ provider: BaseModelProvider; model: ModelInfo }> = [];

		for (const provider of this.registry.getProviders()) {
			for (const [, model] of provider.getModels()) {
				result.push({ provider, model });
			}
		}

		return result;
	}

	/**
	 * Get models with a specific capability
	 * @param capability Model capability
	 * @returns Array of models with provider info
	 */
	public getModelsWithCapability(capability: ModelCapability): Array<{ provider: BaseModelProvider; model: ModelInfo }> {
		return this.getAllModels().filter(({ model }) =>
			model.capabilities.includes(capability) && model.available
		);
	}

	/**
	 * Get the default model for a capability
	 * @param capability Model capability
	 * @returns Model and provider, or null if not found
	 */
	public async getDefaultModelForCapability(capability: ModelCapability): Promise<{ provider: BaseModelProvider; modelId: string } | null> {
		try {
			// Check user configuration for default models
			const defaultModels = this.configService.get<Record<string, { providerId: string; modelId: string }>>('models.defaults', {});

			// If there's a configured default for this capability, use it
			if (defaultModels[capability]) {
				const { providerId, modelId } = defaultModels[capability];
				const provider = this.registry.getProvider(providerId);

				if (provider && provider.isReady) {
					// Verify model exists and has the capability
					const modelInfo = provider.getModelInfo(modelId);

					if (modelInfo && modelInfo.available && modelInfo.capabilities.includes(capability)) {
						return { provider, modelId };
					}
				}
			}

			// No valid configured default, find a suitable model
			const providersWithCapability = this.registry.getProvidersWithCapability(capability);

			for (const provider of providersWithCapability) {
				const modelId = await provider.getDefaultModelForCapability(capability);

				if (modelId) {
					return { provider, modelId };
				}
			}

			return null;
		} catch (error) {
			this.logger.error(`Error getting default model for ${capability}: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
	 * Generate completion from a prompt using specified capability
	 * @param prompt Prompt text
	 * @param capability Capability to use, or ModelRequestOptions
	 * @param options Optional request options (if capability is not ModelRequestOptions)
	 * @returns Model response
	 */
	public async generateCompletion(
		prompt: string,
		capability: ModelCapability | ModelRequestOptions,
		options?: ModelRequestOptions
	): Promise<ModelResponse> {
		try {
			// Parse arguments
			let modelCapability: ModelCapability;
			let modelOptions: ModelRequestOptions = {};

			if (typeof capability === 'string') {
				modelCapability = capability;
				modelOptions = options || {};
			} else {
				modelCapability = capability.capability || ModelCapability.ChatCompletion;
				modelOptions = capability;
			}

			// Start performance measurement
			const startTime = Date.now();

			// Get default model for capability
			const defaultModel = await this.getDefaultModelForCapability(modelCapability);

			if (!defaultModel) {
				throw new ModelProviderError(
					`No model available for capability: ${modelCapability}`,
					'modelManager'
				);
			}

			// Use the selected provider and model
			const { provider, modelId } = defaultModel;

			// Set modelId in options if not specified
			if (!modelOptions.modelParams) {
				modelOptions.modelParams = { modelId };
			} else if (!modelOptions.modelParams.modelId) {
				modelOptions.modelParams.modelId = modelId;
			}

			// Generate completion
			const response = await provider.generateCompletion(prompt, modelOptions);

			// End performance measurement
			const duration = Date.now() - startTime;

			// Track telemetry
			this.telemetryService.trackModelRequest(
				modelId,
				provider.id,
				modelCapability,
				{ promptLength: prompt.length },
				{
					durationMs: duration,
					promptTokens: response.promptTokens || 0,
					completionTokens: response.completionTokens || 0,
					totalTokens: response.totalTokens || 0
				}
			);

			return response;
		} catch (error) {
			// Log error
			this.logger.error(`Error generating completion: ${error instanceof Error ? error.message : String(error)}`);

			// Track error telemetry
			this.telemetryService.trackError(
				'ModelCompletion',
				error instanceof Error ? error.message : String(error),
				{ capability: typeof capability === 'string' ? capability : capability.capability || 'unknown' }
			);

			// Rethrow error
			throw error;
		}
	}

	/**
	 * Generate completion with streaming response
	 * @param prompt Prompt text
	 * @param handler Streaming handler to process the response
	 * @param capability Capability to use, or ModelRequestOptions
	 * @param options Optional request options (if capability is not ModelRequestOptions)
	 */
	public async generateCompletionStream(
		prompt: string,
		handler: StreamingResponseHandler,
		capability: ModelCapability | ModelRequestOptions,
		options?: ModelRequestOptions
	): Promise<void> {
		try {
			// Parse arguments
			let modelCapability: ModelCapability;
			let modelOptions: ModelRequestOptions = {};

			if (typeof capability === 'string') {
				modelCapability = capability;
				modelOptions = options || {};
			} else {
				modelCapability = capability.capability || ModelCapability.ChatCompletion;
				modelOptions = capability;
			}

			// Start performance measurement
			const startTime = Date.now();

			// Get default model for capability
			const defaultModel = await this.getDefaultModelForCapability(modelCapability);

			if (!defaultModel) {
				throw new ModelProviderError(
					`No model available for capability: ${modelCapability}`,
					'modelManager'
				);
			}

			// Use the selected provider and model
			const { provider, modelId } = defaultModel;

			// Set modelId in options if not specified
			if (!modelOptions.modelParams) {
				modelOptions.modelParams = { modelId };
			} else if (!modelOptions.modelParams.modelId) {
				modelOptions.modelParams.modelId = modelId;
			}

			// Create a wrapper handler to track telemetry
			const wrapperHandler: StreamingResponseHandler = {
				onContent: (content: string) => {
					// Pass through to original handler
					handler.onContent(content);
				},
				onComplete: (response: ModelResponse) => {
					// End performance measurement
					const duration = Date.now() - startTime;

					// Track telemetry
					this.telemetryService.trackModelRequest(
						modelId,
						provider.id,
						modelCapability,
						{ promptLength: prompt.length },
						{
							durationMs: duration,
							promptTokens: response.promptTokens || 0,
							completionTokens: response.completionTokens || 0,
							totalTokens: response.totalTokens || 0
						}
					);

					// Pass through to original handler
					handler.onComplete(response);
				},
				onError: (error: Error) => {
					// Track error telemetry
					this.telemetryService.trackError(
						'ModelCompletionStream',
						error.message,
						{ capability: typeof capability === 'string' ? capability : capability.capability || 'unknown' }
					);

					// Pass through to original handler
					handler.onError(error);
				}
			};

			// Generate streaming completion
			await provider.generateCompletionStream(prompt, wrapperHandler, modelOptions);
		} catch (error) {
			// Log error
			this.logger.error(`Error generating streaming completion: ${error instanceof Error ? error.message : String(error)}`);

			// Track error telemetry
			this.telemetryService.trackError(
				'ModelCompletionStream',
				error instanceof Error ? error.message : String(error),
				{ capability: typeof capability === 'string' ? capability : capability.capability || 'unknown' }
			);

			// Notify handler
			handler.onError(
				error instanceof Error ?
					error :
					new ModelProviderError(String(error), 'modelManager')
			);
		}
	}

	/**
	 * Set the default model for a capability
	 * @param capability Model capability
	 * @param providerId Provider ID
	 * @param modelId Model ID
	 */
	public async setDefaultModelForCapability(
		capability: ModelCapability,
		providerId: string,
		modelId: string
	): Promise<boolean> {
		try {
			// Get current defaults
			const defaultModels = this.configService.get<Record<string, { providerId: string; modelId: string }>>('models.defaults', {});

			// Update the default for this capability
			defaultModels[capability] = { providerId, modelId };

			// Save to configuration
			await this.configService.update('models.defaults', defaultModels);

			// Log change
			this.logger.info(`Set default model for ${capability}: ${providerId}/${modelId}`);

			return true;
		} catch (error) {
			this.logger.error(`Error setting default model for ${capability}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Count tokens in a text using the appropriate tokenizer
	 * @param text Text to count tokens for
	 * @param providerId Optional provider ID to use for counting
	 * @returns Token count
	 */
	public async countTokens(text: string, providerId?: string): Promise<number> {
		try {
			// If provider specified, use it
			if (providerId) {
				const provider = this.registry.getProvider(providerId);
				if (provider && provider.isReady) {
					return await provider.countTokens(text);
				}
			}

			// Otherwise, use the first available provider
			const providers = this.registry.getAvailableProviders();
			if (providers.length > 0) {
				return await providers[0].countTokens(text);
			}

			// Fallback: very rough estimate (4 chars ≈ 1 token)
			return Math.ceil(text.length / 4);
		} catch (error) {
			this.logger.error(`Error counting tokens: ${error instanceof Error ? error.message : String(error)}`);

			// Fallback: very rough estimate
			return Math.ceil(text.length / 4);
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this._onModelReady.dispose();
	}
}
