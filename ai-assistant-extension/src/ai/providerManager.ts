import * as vscode from 'vscode';
import { BaseModelProvider, ModelCapability } from './providers/baseProvider';
import { XAIProvider } from './providers/xaiProvider';
import { QwenProvider } from './providers/qwenProvider';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';

/**
 * Manages AI model providers
 */
export class ProviderManager implements vscode.Disposable {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private providers: Map<string, BaseModelProvider> = new Map();
	private activeProviderId: string | null = null;

	/**
	 * Create a new provider manager
	 * @param configService Configuration service
	 * @param logger Logger
	 */
	constructor(configService: ConfigService, logger: Logger) {
		this.configService = configService;
		this.logger = logger;
	}

	/**
	 * Initialize available providers
	 */
	public async initialize(): Promise<void> {
		this.logger.info('Initializing AI providers');

		try {
			// Initialize XAI provider
			const xaiProvider = new XAIProvider(this.configService, this.logger);
			if (await xaiProvider.initialize()) {
				this.providers.set(xaiProvider.id, xaiProvider);
				this.logger.info(`Provider ${xaiProvider.name} initialized`);
			}

			// Initialize Qwen provider
			const qwenProvider = new QwenProvider(this.configService, this.logger);
			if (await qwenProvider.initialize()) {
				this.providers.set(qwenProvider.id, qwenProvider);
				this.logger.info(`Provider ${qwenProvider.name} initialized`);
			}

			// Add more providers here as needed...

			// Set active provider from configuration or use first available
			this.activeProviderId = this.configService.get<string>('activeProviderId', null);

			if (!this.activeProviderId || !this.providers.has(this.activeProviderId)) {
				this.activeProviderId = this.providers.size > 0 ?
					Array.from(this.providers.keys())[0] :
					null;
			}

			this.logger.info(`Active AI provider: ${this.activeProviderId || 'none'}`);

		} catch (error: unknown) {
			// Fix: Properly handle the unknown error type
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error initializing providers: ${errorMessage}`);
		}
	}

	/**
	 * Get available providers
	 * @returns Array of available providers
	 */
	public getAvailableProviders(): BaseModelProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Get the active provider
	 * @returns Active provider or null if none
	 */
	public getActiveProvider(): BaseModelProvider | null {
		if (!this.activeProviderId) {
			return null;
		}
		return this.providers.get(this.activeProviderId) || null;
	}

	/**
	 * Set the active provider
	 * @param providerId Provider ID
	 */
	public async setActiveProvider(providerId: string): Promise<void> {
		if (!this.providers.has(providerId)) {
			throw new Error(`Provider ${providerId} not available`);
		}

		this.activeProviderId = providerId;
		await this.configService.update('activeProviderId', providerId);

		this.logger.info(`Active provider set to ${providerId}`);
	}

	/**
	 * Get a provider with the specified capability
	 * @param capability Required capability
	 * @returns Provider with the capability or null
	 */
	public async getProviderForCapability(capability: ModelCapability): Promise<BaseModelProvider | null> {
		// First try the active provider
		const activeProvider = this.getActiveProvider();

		if (activeProvider) {
			// Check if the active provider has a model with this capability
			const modelId = await activeProvider.getDefaultModelForCapability(capability);
			if (modelId) {
				return activeProvider;
			}
		}

		// Try all providers
		for (const provider of this.providers.values()) {
			const modelId = await provider.getDefaultModelForCapability(capability);
			if (modelId) {
				return provider;
			}
		}

		return null;
	}

	/**
	 * Check if a provider is available
	 * @param providerId Provider ID
	 * @returns True if provider is available
	 */
	public hasProvider(providerId: string): boolean {
		return this.providers.has(providerId);
	}

	/**
	 * Get a provider by ID
	 * @param providerId Provider ID
	 * @returns Provider or null if not found
	 */
	public getProvider(providerId: string): BaseModelProvider | null {
		return this.providers.get(providerId) || null;
	}

	/**
	 * Dispose of all providers
	 */
	public dispose(): void {
		for (const provider of this.providers.values()) {
			provider.dispose();
		}
		this.providers.clear();
		this.activeProviderId = null;
	}
}
