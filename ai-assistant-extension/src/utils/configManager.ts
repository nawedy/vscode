import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Configuration key for the extension
 */
const CONFIG_KEY = 'aiAssistant';

/**
 * Configuration interface
 */
interface AIAssistantConfig {
	maxTokens: number;
	useMarkdown: boolean;
	responseFormat: 'simple' | 'detailed';
	customStyles: boolean;
}

/**
 * Manages extension configuration
 */
export class ConfigManager {
	private config: AIAssistantConfig;
	private readonly logger: Logger;

	/**
	 * Create a new ConfigManager
	 * @param logger Logger instance
	 */
	constructor(logger: Logger) {
		this.logger = logger;
		this.config = this.loadConfig();
	}

	/**
	 * Load configuration from workspace settings
	 */
	private loadConfig(): AIAssistantConfig {
		const config = vscode.workspace.getConfiguration(CONFIG_KEY);

		return {
			maxTokens: config.get<number>('maxTokens', 2048),
			useMarkdown: config.get<boolean>('useMarkdown', true),
			responseFormat: config.get<'simple' | 'detailed'>('responseFormat', 'detailed'),
			customStyles: config.get<boolean>('customStyles', false)
		};
	}

	/**
	 * Refresh configuration
	 */
	public refreshConfig(): void {
		this.config = this.loadConfig();
		this.logger.info('Configuration refreshed');
	}

	/**
	 * Get configuration value
	 */
	public getConfig(): Readonly<AIAssistantConfig> {
		return this.config;
	}

	/**
	 * Update a configuration value
	 * @param key Configuration key
	 * @param value New value
	 */
	public async updateConfig<K extends keyof AIAssistantConfig>(
		key: K,
		value: AIAssistantConfig[K]
	): Promise<void> {
		// Update workspace configuration
		await vscode.workspace.getConfiguration(CONFIG_KEY).update(key, value, vscode.ConfigurationTarget.Global);

		// Refresh local config
		this.refreshConfig();
	}
}
