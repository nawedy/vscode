/**
 * Auth Service
 *
 * Manages authentication for AI providers, handles secure storage
 * of API keys and tokens, and provides login/logout functionality.
 */

import * as vscode from 'vscode';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';

interface AuthToken {
	token: string;
	expiresAt: number;
}

interface AuthCredentials {
	providerId: string;
	apiKey: string;
	apiEndpoint?: string;
}

/**
 * Authentication state for a provider
 */
export interface ProviderAuthState {
	providerId: string;
	isAuthenticated: boolean;
	username?: string;
	email?: string;
	expiresAt?: number; // Timestamp in ms
}

/**
 * Service for managing authentication with AI providers
 */
export class AuthService {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private authStates: Map<string, ProviderAuthState> = new Map();
	private readonly tokens: Map<string, AuthToken> = new Map();

	// Event emitter for authentication state changes
	private readonly _onAuthStateChanged = new vscode.EventEmitter<ProviderAuthState>();

	/**
	 * Event fired when authentication state changes
	 */
	public readonly onAuthStateChanged = this._onAuthStateChanged.event;

	/**
	 * Create a new auth service
	 * @param configService Configuration service
	 * @param logger Logger
	 */
	constructor(configService: ConfigService, logger: Logger) {
		this.configService = configService;
		this.logger = logger;
	}

	/**
	 * Initialize auth service
	 */
	public async initialize(): Promise<void> {
		await this.loadAuthStates();
	}

	/**
	 * Get API key for a provider
	 * @param providerId Provider ID
	 * @returns API key or null if not found
	 */
	public async getApiKey(providerId: string): Promise<string | null> {
		try {
			const key = await this.configService.getSecret(`${providerId}.apiKey`);
			return key || null;
		} catch (error) {
			this.logger.error(`Error getting API key for ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
	 * Save API key for a provider
	 * @param providerId Provider ID
	 * @param apiKey API key
	 */
	public async saveApiKey(providerId: string, apiKey: string): Promise<boolean> {
		try {
			await this.configService.setSecret(`${providerId}.apiKey`, apiKey);

			// Update auth state
			const authState: ProviderAuthState = {
				providerId,
				isAuthenticated: true
			};

			this.authStates.set(providerId, authState);
			this._onAuthStateChanged.fire(authState);

			this.logger.info(`API key saved for ${providerId}`);
			return true;
		} catch (error) {
			this.logger.error(`Error saving API key for ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Delete API key for a provider
	 * @param providerId Provider ID
	 */
	public async deleteApiKey(providerId: string): Promise<boolean> {
		try {
			await this.configService.deleteSecret(`${providerId}.apiKey`);

			// Update auth state
			const authState: ProviderAuthState = {
				providerId,
				isAuthenticated: false
			};

			this.authStates.set(providerId, authState);
			this._onAuthStateChanged.fire(authState);

			this.logger.info(`API key deleted for ${providerId}`);
			return true;
		} catch (error) {
			this.logger.error(`Error deleting API key for ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Check if a provider is authenticated
	 * @param providerId Provider ID
	 */
	public isAuthenticated(providerId: string): boolean {
		return this.authStates.get(providerId)?.isAuthenticated || false;
	}

	/**
	 * Get authentication state for a provider
	 * @param providerId Provider ID
	 */
	public getAuthState(providerId: string): ProviderAuthState | null {
		return this.authStates.get(providerId) || null;
	}

	/**
	 * Load authentication states
	 */
	private async loadAuthStates(): Promise<void> {
		try {
			// Check each known provider for API keys
			const providers = [
				'openai',
				'anthropic',
				'azure',
				'huggingface',
				'mistral',
				'deepseek',
				'local',
				'xai',
				'kimi'
			];

			for (const providerId of providers) {
				const apiKey = await this.getApiKey(providerId);

				this.authStates.set(providerId, {
					providerId,
					isAuthenticated: !!apiKey
				});
			}

			this.logger.info('Auth states loaded');
		} catch (error) {
			this.logger.error(`Error loading auth states: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Authenticate with OAuth flow
	 * @param providerId Provider ID
	 * @param scopes OAuth scopes
	 */
	public async authenticateWithOAuth(providerId: string, scopes: string[]): Promise<boolean> {
		try {
			// This is a placeholder for OAuth authentication flow
			// In a real implementation, this would use the VS Code authentication API
			this.logger.info(`OAuth authentication for ${providerId} not implemented yet`);

			// For now, just display a message and return false
			vscode.window.showInformationMessage(`OAuth authentication for ${providerId} is not implemented yet. Please use API key authentication.`);

			return false;
		} catch (error) {
			this.logger.error(`Error authenticating with OAuth for ${providerId}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Validate API key format
	 * @param providerId Provider ID
	 * @param apiKey API key to validate
	 */
	public validateApiKeyFormat(providerId: string, apiKey: string): boolean {
		if (!apiKey) {
			return false;
		}

		// Basic format validation based on provider
		switch (providerId) {
			case 'openai':
				return apiKey.startsWith('sk-') && apiKey.length > 20;
			case 'anthropic':
				return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
			case 'azure':
				return apiKey.length > 10; // Very basic validation
			case 'huggingface':
				return apiKey.startsWith('hf_') && apiKey.length > 10;
			case 'mistral':
				return apiKey.length >= 32;
			default:
				// Generic validation - just ensure it's not empty and has reasonable length
				return apiKey.length >= 8;
		}
	}

	/**
	 * Dispose auth service
	 */
	public dispose(): void {
		this._onAuthStateChanged.dispose();
	}

	public async setCredentials(credentials: AuthCredentials): Promise<void> {
		try {
			await this.configService.setSecureValue(
				`auth.${credentials.providerId}`,
				JSON.stringify(credentials)
			);
			this.logger.info(`Stored credentials for provider: ${credentials.providerId}`);
		} catch (error) {
			this.logger.error(`Failed to store credentials: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public async getCredentials(providerId: string): Promise<AuthCredentials | null> {
		try {
			const stored = await this.configService.getSecureValue(`auth.${providerId}`);
			if (!stored) {
				return null;
			}
			return JSON.parse(stored) as AuthCredentials;
		} catch (error) {
			this.logger.error(`Failed to get credentials: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	public async removeCredentials(providerId: string): Promise<void> {
		try {
			await this.configService.deleteSecureValue(`auth.${providerId}`);
			this.logger.info(`Removed credentials for provider: ${providerId}`);
		} catch (error) {
			this.logger.error(`Failed to remove credentials: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public async validateCredentials(providerId: string): Promise<boolean> {
		const credentials = await this.getCredentials(providerId);
		if (!credentials) {
			return false;
		}

		// Implement provider-specific validation
		return true;
	}
}
