import * as vscode from 'vscode';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * API key information
 */
interface ApiKeyInfo {
	provider: string;
	key: string;
	lastUsed: Date;
	expires?: Date;
	isValid: boolean;
}

/**
 * Provider key configuration
 */
interface ProviderKeyConfig {
	secretKey: string;
	displayName: string;
}

/**
 * Security manager for handling API keys
 */
export class ApiKeyManager {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private readonly errorHandler: ErrorHandler;
	private readonly metadataKey = 'apikey-metadata';

	// Mapping of provider IDs to their key configurations
	private readonly providerKeyConfigs = new Map<string, ProviderKeyConfig>([
		['openai', { secretKey: 'openai.apiKey', displayName: 'OpenAI' }],
		['anthropic', { secretKey: 'anthropic.apiKey', displayName: 'Anthropic' }],
		['mistral', { secretKey: 'mistral.apiKey', displayName: 'Mistral AI' }],
		['qwen', { secretKey: 'qwen.apiKey', displayName: 'Qwen' }],
		['deepseek', { secretKey: 'deepseek.apiKey', displayName: 'DeepSeek' }],
		['huggingface', { secretKey: 'huggingface.apiKey', displayName: 'HuggingFace' }],
		['kimi', { secretKey: 'kimi.apiKey', displayName: 'Kimi' }],
		['xai', { secretKey: 'xai.apiKey', displayName: 'XAI' }]
	]);

	/**
	 * Create a new ApiKeyManager
	 * @param configService The configuration service
	 * @param logger The logger
	 * @param errorHandler The error handler
	 */
	constructor(configService: ConfigService, logger: Logger, errorHandler: ErrorHandler) {
		this.configService = configService;
		this.logger = logger;
		this.errorHandler = errorHandler;
	}

	/**
	 * Get API key for a provider
	 * @param providerId Provider ID
	 * @returns API key or undefined if not found
	 */
	public async getApiKey(providerId: string): Promise<string | undefined> {
		const config = this.providerKeyConfigs.get(providerId);
		if (!config) {
			this.logger.warn(`No API key configuration found for provider: ${providerId}`);
			return undefined;
		}

		try {
			const key = await this.configService.getSecret(config.secretKey);
			if (key) {
				// Update last used timestamp
				await this.updateLastUsed(providerId);
			}
			return key;
		} catch (error) {
			this.errorHandler.handleError(error, `Failed to retrieve API key for ${providerId}`);
			return undefined;
		}
	}

	/**
	 * Save API key for a provider
	 * @param providerId Provider ID
	 * @param apiKey API key
	 * @returns Whether the key was saved successfully
	 */
	public async saveApiKey(providerId: string, apiKey: string): Promise<boolean> {
		const config = this.providerKeyConfigs.get(providerId);
		if (!config) {
			this.logger.warn(`No API key configuration found for provider: ${providerId}`);
			return false;
		}

		try {
			// Validate the key format
			if (!this.validateKeyFormat(providerId, apiKey)) {
				this.logger.warn(`Invalid API key format for ${providerId}`);
				return false;
			}

			// Store the key
			await this.configService.setSecret(config.secretKey, apiKey);
			this.logger.info(`API key saved for provider: ${providerId}`);

			// Store metadata
			const metadata: APIKeyMetadata = {
				providerId,
				createdAt: Date.now(),
				isValid: true
			};
			await this.storeMetadata(providerId, metadata);

			return true;
		} catch (error) {
			this.errorHandler.handleError(error, `Failed to store API key for ${providerId}`);
			return false;
		}
	}

	/**
	 * Delete API key for a provider
	 * @param providerId Provider ID
	 * @returns Whether the key was deleted successfully
	 */
	public async deleteApiKey(providerId: string): Promise<boolean> {
		const config = this.providerKeyConfigs.get(providerId);
		if (!config) {
			this.logger.warn(`No API key configuration found for provider: ${providerId}`);
			return false;
		}

		try {
			await this.configService.deleteSecret(config.secretKey);
			this.logger.info(`API key deleted for provider: ${providerId}`);
			return true;
		} catch (error) {
			this.logger.error(`Error deleting API key for ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Check if API key exists for a provider
	 * @param providerId Provider ID
	 * @returns Whether the key exists
	 */
	public async hasApiKey(providerId: string): Promise<boolean> {
		const key = await this.getApiKey(providerId);
		return key !== undefined && key.length > 0;
	}

	/**
	 * Validate API key format
	 * @param providerId Provider ID
	 * @param apiKey API key
	 * @returns Whether the key format is valid
	 */
	private validateKeyFormat(providerId: string, apiKey: string): boolean {
		// Skip validation if key is empty
		if (!apiKey) {
			return false;
		}

		// Provider-specific validations
		switch (providerId) {
			case 'openai':
				return apiKey.startsWith('sk-') && apiKey.length >= 20;
			case 'anthropic':
				return apiKey.length >= 20;
			case 'mistral':
				return apiKey.length >= 20;
			case 'qwen':
				return apiKey.length >= 20;
			default:
				// Default validation - just check it's not empty
				return apiKey.length > 0;
		}
	}

	/**
	 * Get a list of all provider IDs
	 * @returns Array of provider IDs
	 */
	public getProviderIds(): string[] {
		return Array.from(this.providerKeyConfigs.keys());
	}

	/**
	 * Get display name for a provider
	 * @param providerId Provider ID
	 * @returns Display name or the original ID if not found
	 */
	public getProviderDisplayName(providerId: string): string {
		return this.providerKeyConfigs.get(providerId)?.displayName || providerId;
	}

	/**
	 * Check if a provider is registered with this manager
	 * @param providerId Provider ID
	 * @returns Whether the provider is registered
	 */
	public isProviderRegistered(providerId: string): boolean {
		return this.providerKeyConfigs.has(providerId);
	}

	/**
	 * Register a new provider
	 * @param providerId Provider ID
	 * @param config Provider key configuration
	 */
	public registerProvider(providerId: string, config: ProviderKeyConfig): void {
		this.providerKeyConfigs.set(providerId, config);
		this.logger.info(`Registered API key configuration for provider: ${providerId}`);
	}

	/**
	 * Prompt user to input an API key
	 * @param providerId Provider ID
	 * @returns The entered API key or undefined if canceled
	 */
	public async promptForApiKey(providerId: string): Promise<string | undefined> {
		const displayName = this.getProviderDisplayName(providerId);

		const result = await vscode.window.showInputBox({
			prompt: `Enter your ${displayName} API key`,
			password: true,
			ignoreFocusOut: true,
			placeHolder: 'API key',
			validateInput: (value) => {
				if (!value) {
					return 'API key cannot be empty';
				}

				if (!this.validateKeyFormat(providerId, value)) {
					return 'Invalid API key format';
				}

				return null;
			}
		});

		return result;
	}

	/**
	 * Configure API key for a provider with user interaction
	 * @param providerId Provider ID
	 * @returns Whether the key was configured successfully
	 */
	public async configureApiKey(providerId: string): Promise<boolean> {
		// Check if provider is registered
		if (!this.isProviderRegistered(providerId)) {
			this.logger.error(`Provider not registered: ${providerId}`);
			return false;
		}

		// Get current key
		const currentKey = await this.getApiKey(providerId);
		const displayName = this.getProviderDisplayName(providerId);

		// If key exists, ask if user wants to update it
		if (currentKey) {
			const action = await vscode.window.showQuickPick([
				{ label: 'Update', description: `Replace the existing ${displayName} API key` },
				{ label: 'Delete', description: `Remove the ${displayName} API key` },
				{ label: 'Cancel', description: 'Do nothing' }
			], {
				placeHolder: `${displayName} API key is already configured. What would you like to do?`,
				ignoreFocusOut: true
			});

			if (!action || action.label === 'Cancel') {
				return false;
			}

			if (action.label === 'Delete') {
				return await this.deleteApiKey(providerId);
			}
		}

		// Prompt for new key
		const newKey = await this.promptForApiKey(providerId);
		if (!newKey) {
			return false;
		}

		// Save the new key
		return await this.saveApiKey(providerId, newKey);
	}

	private async storeMetadata(providerId: string, metadata: APIKeyMetadata): Promise<void> {
		const allMetadata = await this.getAllMetadata();
		allMetadata[providerId] = metadata;
		await this.configService.storeState(this.metadataKey, allMetadata);
	}

	private async getAllMetadata(): Promise<Record<string, APIKeyMetadata>> {
		return this.configService.getState(this.metadataKey, {});
	}

	private async updateLastUsed(providerId: string): Promise<void> {
		const allMetadata = await this.getAllMetadata();
		if (allMetadata[providerId]) {
			allMetadata[providerId].lastUsed = Date.now();
			await this.configService.storeState(this.metadataKey, allMetadata);
		}
	}
}
