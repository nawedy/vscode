/**
 * Configuration Service
 *
 * Manages extension configuration, settings, and secrets storage.
 * Provides unified access to extension configuration and secure storage.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * Service for managing configuration and settings
 */
export interface ConfigChangeEvent<T = unknown> {
	key: string;
	oldValue: T | undefined;
	newValue: T | undefined;
}

interface ConfigState {
	[key: string]: unknown;
}

export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

interface ConfigurationOptions {
	section?: string;
	scope?: vscode.ConfigurationScope;
}

export class ConfigService implements vscode.Disposable {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly configSectionName: string = 'ai-assistant';
	private _isDevelopmentMode: boolean = false;
	private readonly secrets: vscode.SecretStorage;
	private configurationChangeListener: vscode.Disposable | undefined;
	private state: ConfigState = {};
	private listeners: Map<string, Set<ConfigChangeListener>> = new Map();
	private readonly changeEmitter = new vscode.EventEmitter<ConfigChangeEvent>();

	/**
	 * Create a new configuration service
	 * @param context Extension context
	 * @param logger Logger instance
	 */
	constructor(context: vscode.ExtensionContext, logger: Logger) {
		this.context = context;
		this.logger = logger;
		this.secrets = context.secrets;

		// Check if in development mode
		this._isDevelopmentMode = this.checkDevelopmentMode();
	}

	/**
	 * Initialize the config service
	 */
	public async initialize(): Promise<void> {
		this.logger.info('Initializing configuration service');

		// Register configuration change listener
		this.configurationChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(this.configSectionName)) {
				this.logger.info('Configuration changed');
			}
		});
	}

	/**
	 * Get extension context
	 */
	public getExtensionContext(): vscode.ExtensionContext {
		return this.context;
	}

	/**
	 * Get a configuration value
	 * @param key Configuration key
	 * @param defaultValue Default value if not found
	 * @returns Configuration value or default
	 */
	public get<T>(key: string, defaultValue?: T): T | undefined {
		const config = vscode.workspace.getConfiguration('aiAssistant');
		return config.get<T>(key, defaultValue as T);
	}

	/**
	 * Update a configuration value
	 * @param key Configuration key
	 * @param value Value to set
	 * @param target Configuration target
	 * @returns Promise that resolves when update is complete
	 */
	public async update<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
		const config = vscode.workspace.getConfiguration('aiAssistant');
		await config.update(key, value, target);
	}

	/**
	 * Get a secret from secure storage
	 * @param key Secret key
	 * @returns Secret value or empty string if not found
	 */
	public async getSecret(key: string): Promise<string | undefined> {
		try {
			return await this.secrets.get(key);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error getting secret ${key}: ${errorMessage}`);
			return undefined;
		}
	}

	/**
	 * Store a secret in secure storage
	 * @param key Secret key
	 * @param value Secret value
	 */
	public async setSecret(key: string, value: string): Promise<void> {
		try {
			await this.secrets.store(key, value);
			this.logger.debug(`Secret stored: ${key}`);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error setting secret ${key}: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Delete a secret from secure storage
	 * @param key Secret key
	 */
	public async deleteSecret(key: string): Promise<void> {
		try {
			await this.secrets.delete(key);
			this.logger.debug(`Secret deleted: ${key}`);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error deleting secret ${key}: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Get a secure configuration value from extension secrets storage
	 * @param key Secret key
	 * @returns Secret value or empty string if not found
	 */
	public async getSecureValue(key: string): Promise<string | undefined> {
		return await this.context.secrets.get(key);
	}

	/**
	 * Store a secure configuration value in extension secrets storage
	 * @param key Secret key
	 * @param value Secret value
	 */
	public async setSecureValue(key: string, value: string): Promise<void> {
		await this.context.secrets.store(key, value);
	}

	/**
	 * Delete a secure configuration value from extension secrets storage
	 * @param key Secret key
	 */
	public async deleteSecureValue(key: string): Promise<void> {
		await this.context.secrets.delete(key);
	}

	/**
	 * Load a JSON file from the extension directory
	 * @param relativePath Path relative to extension directory
	 * @returns Parsed JSON object or null if file not found
	 */
	public loadJsonFile<T>(relativePath: string): T | null {
		try {
			const fullPath = path.join(this.context.extensionPath, relativePath);
			if (!fs.existsSync(fullPath)) {
				this.logger.warn(`File not found: ${fullPath}`);
				return null;
			}

			const content = fs.readFileSync(fullPath, 'utf8');
			return JSON.parse(content) as T;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error loading JSON file ${relativePath}: ${errorMessage}`);
			return null;
		}
	}

	/**
	 * Load a text file from the extension directory
	 * @param relativePath Path relative to extension directory
	 * @returns File content or null if file not found
	 */
	public loadTextFile(relativePath: string): string | null {
		try {
			const fullPath = path.join(this.context.extensionPath, relativePath);
			if (!fs.existsSync(fullPath)) {
				this.logger.warn(`File not found: ${fullPath}`);
				return null;
			}

			return fs.readFileSync(fullPath, 'utf8');
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error loading text file ${relativePath}: ${errorMessage}`);
			return null;
		}
	}

	/**
	 * Get the extension version
	 * @returns Extension version string
	 */
	public getExtensionVersion(): string {
		try {
			const packageJson = this.loadJsonFile<{ version: string }>('package.json');
			return packageJson?.version || 'unknown';
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error getting extension version: ${errorMessage}`);
			return 'unknown';
		}
	}

	/**
	 * Check if running in development mode
	 */
	private checkDevelopmentMode(): boolean {
		// Check for debug mode
		const isDebugMode = !!process.env.VSCODE_DEBUG_MODE;

		// Check for non-packed extension (typical during development)
		const packageJson = this.context.extensionPath.includes('node_modules') === false;

		return isDebugMode || packageJson;
	}

	/**
	 * Check if in development mode
	 */
	public isDevelopmentMode(): boolean {
		return this._isDevelopmentMode;
	}

	/**
	 * Store data in global state
	 * @param key State key
	 * @param value State value
	 */
	public async storeState<T>(key: string, value: T): Promise<void> {
		await this.context.globalState.update(key, value);
	}

	/**
	 * Get data from global state
	 * @param key State key
	 * @param defaultValue Default value if not found
	 * @returns State value or default
	 */
	public getState<T>(key: string, defaultValue?: T): T | undefined {
		return this.context.globalState.get<T>(key, defaultValue);
	}

	/**
	 * Clear a state value
	 * @param key State key
	 */
	public async clearState(key: string): Promise<void> {
		await this.context.globalState.update(key, undefined);
	}

	/**
	 * Reload configuration after changes
	 */
	public async reloadConfiguration(): Promise<void> {
		this.logger.info('Reloading configuration');
	}

	/**
	 * Get all available provider IDs from configuration
	 * @returns Array of provider IDs
	 */
	public getProviderIds(): string[] {
		const providers = this.get<string[]>('providers', []);
		return providers;
	}

	/**
	 * Get the maximum depth for related file context
	 * @returns The maximum context depth
	 */
	public getContextDepth(): number {
		return this.get<number>('context.maxDepth', 2);
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		if (this.configurationChangeListener) {
			this.configurationChangeListener.dispose();
		}
	}

	/**
	 * Get config service
	 */
	public getConfigService() {
		// Implementation for getting config service
	}

	/**
	 * Add a configuration change listener
	 * @param key Configuration key
	 * @param listener Listener function
	 */
	public addChangeListener(key: string, listener: ConfigChangeListener): void {
		if (!this.listeners.has(key)) {
			this.listeners.set(key, new Set());
		}
		this.listeners.get(key)?.add(listener);
	}

	/**
	 * Remove a configuration change listener
	 * @param key Configuration key
	 * @param listener Listener function
	 */
	public removeChangeListener(key: string, listener: ConfigChangeListener): void {
		this.listeners.get(key)?.delete(listener);
	}
}
