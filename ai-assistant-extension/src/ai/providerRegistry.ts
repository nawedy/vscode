/**
 * Provider Registry
 *
 * Central registry for all AI model providers.
 * Manages provider initialization, discovery, and selection.
 */

import * as vscode from 'vscode';
import { BaseModelProvider, ModelCapability } from './providers/baseProvider';
import { OpenAIProvider } from './providers/openaiProvider';
import { AnthropicProvider } from './providers/anthropicProvider';
// @ts-ignore: error TS2307: Cannot find module './providers/azureOpenAIProvider' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module './providers/azureOpenAIProvider' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module './providers/azureOpenAIProvider' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module './providers/azureOpenAIProvider' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module './providers/azureOpenAIProvider' or its corresponding type declarations.
// @ts-ignore: error TS2307: Cannot find module './providers/azureOpenAIProvider' or its corresponding type declarations.
import { LocalLLMProvider } from './providers/localLLMProvider';
import { AzureOpenAIProvider } from './providers/azureOpenAIProvider';
import { HuggingFaceProvider } from './providers/huggingfaceProvider';
import { MistralProvider } from './providers/mistralProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import { QwenProvider } from './providers/qwenProvider';
import { XAIProvider } from './providers/xaiProvider';
import { KimiProvider } from './providers/kimiProvider';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';

/**
 * Registry for model providers
 */
export class ProviderRegistry {
	private readonly providers: Map<string, BaseModelProvider> = new Map();
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private _isInitialized: boolean = false;

	// Event emitter for provider registration
	private readonly _onProviderRegistered = new vscode.EventEmitter<BaseModelProvider>();

	/**
	 * Event fired when a provider is registered
	 */
	public readonly onProviderRegistered = this._onProviderRegistered.event;

	// Event emitter for provider state changes
	private readonly _onProviderStateChanged = new vscode.EventEmitter<BaseModelProvider>();

	/**
	 * Event fired when a provider's state changes
	 */
	public readonly onProviderStateChanged = this._onProviderStateChanged.event;

	/**
	 * Create a new provider registry
	 * @param configService Configuration service
	 * @param logger Logger instance
	 */
	constructor(configService: ConfigService, logger: Logger) {
		this.configService = configService;
		this.logger = logger;
	}

	/**
	 * Initialize the provider registry
	 */
	public async initialize(): Promise<void> {
		if (this._isInitialized) {
			return;
		}

		this.logger.info('Initializing provider registry');

		// Register built-in providers
		this.registerBuiltInProviders();

		// Load configuration to determine which providers to initialize
		await this.initializeProviders();

		this._isInitialized = true;
		this.logger.info('Provider registry initialized');
	}

	/**
	 * Register a provider
	 * @param provider Provider to register
	 */
	public registerProvider(provider: BaseModelProvider): void {
		this.providers.set(provider.id, provider);
		this._onProviderRegistered.fire(provider);
		this.logger.info(`Registered provider: ${provider.id}`);
	}

	/**
	 * Get all registered providers
	 * @returns Array of registered providers
	 */
	public getProviders(): BaseModelProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Get provider by ID
	 * @param providerId Provider ID
	 * @returns Provider or undefined if not found
	 */
	public getProvider(providerId: string): BaseModelProvider | undefined {
		return this.providers.get(providerId);
	}

	/**
	 * Get available providers that are ready
	 * @returns Array of available providers
	 */
	public getAvailableProviders(): BaseModelProvider[] {
		return this.getProviders().filter(provider => provider.isReady);
	}

	/**
	 * Get providers that support a specific capability
	 * @param capability Model capability
	 * @returns Array of providers supporting the capability
	 */
	public getProvidersWithCapability(capability: ModelCapability): BaseModelProvider[] {
		return this.getAvailableProviders().filter(provider => {
			// Check if provider has at least one model with the capability
			for (const model of provider.getModels().values()) {
				if (model.capabilities.includes(capability) && model.available) {
					return true;
				}
			}
			return false;
		});
	}

	/**
	 * Initialize enabled providers
	 */
	private async initializeProviders(): Promise<void> {
		// Get enabled providers from config
		const enabledProviders = this.configService.get<string[]>('providers.enabled', [
			'openai',
			'anthropic',
			'local'
		]);

		// Auto-initialize providers that are enabled
		for (const providerId of enabledProviders) {
			const provider = this.providers.get(providerId);
			if (provider) {
				try {
					this.logger.info(`Auto-initializing provider: ${providerId}`);
					const initialized = await provider.initialize();
					if (initialized) {
						this.logger.info(`Successfully initialized provider: ${providerId}`);
					} else {
						this.logger.warn(`Failed to initialize provider: ${providerId}`);
					}
					this._onProviderStateChanged.fire(provider);
				} catch (error) {
					this.logger.error(`Error initializing provider ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	}

	/**
	 * Initialize a specific provider
	 * @param providerId Provider ID
	 * @returns Whether initialization was successful
	 */
	public async initializeProvider(providerId: string): Promise<boolean> {
		const provider = this.providers.get(providerId);
		if (!provider) {
			this.logger.warn(`Provider not found: ${providerId}`);
			return false;
		}

		try {
			const initialized = await provider.initialize();
			this._onProviderStateChanged.fire(provider);
			return initialized;
		} catch (error) {
			this.logger.error(`Error initializing provider ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Register built-in providers
	 */
	private registerBuiltInProviders(): void {
// @ts-ignore: error TS2345: Argument of type 'OpenAIProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register OpenAI provider
		this.registerProvider(new OpenAIProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'AnthropicProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register Anthropic provider
		this.registerProvider(new AnthropicProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'LocalLLMProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register Local LLM provider
		this.registerProvider(new LocalLLMProvider(this.configService, this.logger));

		// Register Azure OpenAI provider
		this.registerProvider(new AzureOpenAIProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'HuggingFaceProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register HuggingFace provider
		this.registerProvider(new HuggingFaceProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'MistralProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register Mistral provider
		this.registerProvider(new MistralProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'DeepSeekProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register DeepSeek provider
		this.registerProvider(new DeepSeekProvider(this.configService, this.logger));

		// Register Qwen provider
		this.registerProvider(new QwenProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'XAIProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register XAI provider
		this.registerProvider(new XAIProvider(this.configService, this.logger));

// @ts-ignore: error TS2345: Argument of type 'KimiProvider' is not assignable to parameter of type 'BaseModelProvider'.
		// Register Kimi provider
		this.registerProvider(new KimiProvider(this.configService, this.logger));
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		// Dispose of all providers
		for (const provider of this.providers.values()) {
			provider.dispose();
		}

		this.providers.clear();
		this._onProviderRegistered.dispose();
		this._onProviderStateChanged.dispose();
	}
}
