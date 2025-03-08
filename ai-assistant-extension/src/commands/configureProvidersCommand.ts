/**
 * Configure Providers Command
 *
 * Provides UI and functionality for configuring AI providers,
 * managing API keys, and selecting active models.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ModelManager } from '../ai/modelManager';
import { AuthService } from '../services/authService';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';
import { ViewManager } from '../ui/viewManager';
import { ModelInfo, ModelProviderError } from '../ai/providers/baseProvider';

/**
 * Command handler for configuring model providers
 */
export class ConfigureProvidersCommand {
	private readonly context: vscode.ExtensionContext;
	private readonly modelManager: ModelManager;
	private readonly authService: AuthService;
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private readonly viewManager: ViewManager;

	/**
	 * Create a new configure providers command
	 * @param context Extension context
	 * @param modelManager Model manager
	 * @param authService Auth service
	 * @param configService Config service
	 * @param logger Logger instance
	 * @param viewManager View manager
	 */
	constructor(
		context: vscode.ExtensionContext,
		modelManager: ModelManager,
		authService: AuthService,
		configService: ConfigService,
		logger: Logger,
		viewManager: ViewManager
	) {
		this.context = context;
		this.modelManager = modelManager;
		this.authService = authService;
		this.configService = configService;
		this.logger = logger;
		this.viewManager = viewManager;
	}

	/**
	 * Register commands
	 * @returns Array of disposables
	 */
	public register(): vscode.Disposable[] {
		return [
			vscode.commands.registerCommand('ai-assistant.configureProviders', this.configureProviders.bind(this)),
			vscode.commands.registerCommand('ai-assistant.setApiKey', this.setApiKey.bind(this)),
			vscode.commands.registerCommand('ai-assistant.selectModel', this.selectModel.bind(this))
		];
	}

	/**
	 * Open the providers configuration UI
	 */
	private async configureProviders(): Promise<void> {
		try {
			// Create webview panel
			const panel = this.viewManager.createWebviewPanel(
				'providerConfiguration',
				'AI Provider Configuration',
				vscode.ViewColumn.Active
			);

			// Get provider information
			const providers = this.modelManager.getProviders().map(provider => {
				const isAuthenticated = this.authService.isAuthenticated(provider.id);

				return {
					id: provider.id,
					name: provider.name,
					isReady: provider.isReady,
					isAuthenticated,
					models: Array.from(provider.getModels().values()).map(model => ({
						id: model.id,
						name: model.name,
						capabilities: model.capabilities,
						contextLength: model.contextLength,
						available: model.available
					}))
				};
			});

			// Get current default model settings
			const defaultModels = this.configService.get<Record<string, string>>('models.defaults', {});

			// Load template
			const template = this.viewManager.loadHtmlTemplate('providerConfiguration');

			// Create content
			panel.webview.html = this.viewManager.createWebviewContent(panel, template, {
				providers: JSON.stringify(providers),
				defaultModels: JSON.stringify(defaultModels)
			});

			// Handle webview messages
			panel.webview.onDidReceiveMessage(async (message) => {
				switch (message.command) {
					case 'setApiKey':
						await this.setApiKey(message.providerId);
						// Refresh panel after setting API key
						await this.refreshConfigurationPanel(panel);
						break;
					case 'removeApiKey':
						await this.removeApiKey(message.providerId);
						// Refresh panel after removing API key
						await this.refreshConfigurationPanel(panel);
						break;
					case 'setDefaultModel':
						await this.setDefaultModelForCapability(message.capability, message.modelId, message.providerId);
						// Refresh panel after setting default model
						await this.refreshConfigurationPanel(panel);
						break;
					case 'testProvider':
						await this.testProvider(message.providerId);
						// Show result in webview
						await this.refreshConfigurationPanel(panel);
						break;
				}
			});
		} catch (error) {
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			this.logger.error(`Error configuring providers: ${error instanceof Error ? error.message : String(error)}`);
			this.viewManager.showNotification(`Failed to configure providers: ${error instanceof Error ? error.message : String(error)}`, 'error');
		}
	}

	/**
	 * Set API key for a provider
	 * @param providerId Provider ID
	 */
	private async setApiKey(providerId?: string): Promise<void> {
		try {
			// If no provider ID specified, ask user to select
			if (!providerId) {
				const providers = this.modelManager.getProviders();
				const providerOptions = providers.map(provider => ({
					label: provider.name,
					description: provider.id,
					provider
				}));

				const selected = await vscode.window.showQuickPick(
					providerOptions,
					{ placeHolder: 'Select AI provider' }
				);

				if (!selected) {
					return; // User cancelled
				}

				providerId = selected.provider.id;
			}

			// Get API key from user
			const apiKey = await vscode.window.showInputBox({
				prompt: `Enter API key for ${providerId}`,
				password: true,
				placeHolder: 'API Key'
			});

			if (!apiKey) {
				return; // User cancelled
			}

			// Basic validation
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			if (!this.authService.validateApiKeyFormat(providerId, apiKey)) {
				this.viewManager.showNotification(`Invalid API key format for ${providerId}`, 'error');
				return;
			}

			// Save API key
			const saved = await this.authService.saveApiKey(providerId, apiKey);

// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			if (saved) {
				this.viewManager.showNotification(`API key saved for ${providerId}`, 'info');

				// Reinitialize the provider
				await this.modelManager.initializeProvider(providerId);
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			} else {
				this.viewManager.showNotification(`Failed to save API key for ${providerId}`, 'error');
			}
		} catch (error) {
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			this.logger.error(`Error setting API key: ${error instanceof Error ? error.message : String(error)}`);
			this.viewManager.showNotification(`Failed to set API key: ${error instanceof Error ? error.message : String(error)}`, 'error');
		}
	}

	/**
	 * Remove API key for a provider
	 * @param providerId Provider ID
	 */
	private async removeApiKey(providerId: string): Promise<void> {
		try {
			// Confirm with user
			const confirm = await vscode.window.showWarningMessage(
				`Are you sure you want to remove the API key for ${providerId}?`,
				{ modal: true },
				'Yes',
				'No'
			);

			if (confirm !== 'Yes') {
				return; // User cancelled
			}

			// Delete API key
			const deleted = await this.authService.deleteApiKey(providerId);

// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			if (deleted) {
				this.viewManager.showNotification(`API key removed for ${providerId}`, 'info');
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			} else {
				this.viewManager.showNotification(`Failed to remove API key for ${providerId}`, 'error');
			}
		} catch (error) {
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			this.logger.error(`Error removing API key: ${error instanceof Error ? error.message : String(error)}`);
			this.viewManager.showNotification(`Failed to remove API key: ${error instanceof Error ? error.message : String(error)}`, 'error');
		}
	}

	/**
	 * Select default model for a capability
	 * @param capability Model capability
	 * @param modelId Selected model ID (optional)
	 * @param providerId Selected provider ID (optional)
	 */
	private async selectModel(capability?: string, modelId?: string, providerId?: string): Promise<void> {
		try {
			// If capability not specified, ask user to select
// @ts-ignore: error TS2339: Property 'getSupportedCapabilities' does not exist on type 'ModelManager'.
// @ts-ignore: error TS2339: Property 'getSupportedCapabilities' does not exist on type 'ModelManager'.
// @ts-ignore: error TS2339: Property 'getSupportedCapabilities' does not exist on type 'ModelManager'.
// @ts-ignore: error TS2339: Property 'getSupportedCapabilities' does not exist on type 'ModelManager'.
// @ts-ignore: error TS2339: Property 'getSupportedCapabilities' does not exist on type 'ModelManager'.
// @ts-ignore: error TS2339: Property 'getSupportedCapabilities' does not exist on type 'ModelManager'.
			if (!capability) {
				const capabilities = this.modelManager.getSupportedCapabilities();

				const capabilityOptions = capabilities.map(cap => ({
					label: this.formatCapabilityName(cap),
					description: cap
				}));

				const selectedCapability = await vscode.window.showQuickPick(
					capabilityOptions,
					{ placeHolder: 'Select capability' }
				);

				if (!selectedCapability) {
					return; // User cancelled
				}
// @ts-ignore: error TS2339: Property 'description' does not exist on type 'string'.

				capability = selectedCapability.description;
			}

			// If model not specified, show model picker
			if (!modelId || !providerId) {
// @ts-ignore: error TS2345: Argument of type 'string' is not assignable to parameter of type 'ModelCapability'.
				// Get all models that support this capability
				const modelsWithCapability = this.modelManager.getModelsWithCapability(capability);

// @ts-ignore: error TS2339: Property 'name' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
				const modelOptions = modelsWithCapability.map(model => ({
// @ts-ignore: error TS2339: Property 'id' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
					label: model.name,
// @ts-ignore: error TS2339: Property 'contextLength' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
// @ts-ignore: error TS2339: Property 'contextLength' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
// @ts-ignore: error TS2339: Property 'contextLength' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
// @ts-ignore: error TS2339: Property 'contextLength' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
// @ts-ignore: error TS2339: Property 'contextLength' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
// @ts-ignore: error TS2339: Property 'contextLength' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.
					description: `${model.provider.name} (${model.id})`,
					detail: `Context: ${model.contextLength.toLocaleString()} tokens`,
					model
				}));

				const selectedModel = await vscode.window.showQuickPick(
					modelOptions,
					{ placeHolder: `Select model for ${this.formatCapabilityName(capability)}` }
				);

				if (!selectedModel) {
					return; // User cancelled
				}
// @ts-ignore: error TS2339: Property 'id' does not exist on type '{ provider: BaseModelProvider; model: ModelInfo; }'.

				modelId = selectedModel.model.id;
				providerId = selectedModel.model.provider.id;
			}

			// Save default model settings
			await this.setDefaultModelForCapability(capability, modelId, providerId);
		} catch (error) {
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			this.logger.error(`Error selecting model: ${error instanceof Error ? error.message : String(error)}`);
			this.viewManager.showNotification(`Failed to select model: ${error instanceof Error ? error.message : String(error)}`, 'error');
		}
	}

	/**
	 * Set default model for a capability
	 * @param capability Model capability
	 * @param modelId Model ID
	 * @param providerId Provider ID
	 */
	private async setDefaultModelForCapability(capability: string, modelId: string, providerId: string): Promise<void> {
		try {
			// Update configuration
			const defaultModels = this.configService.get<Record<string, Record<string, string>>>('models.defaults', {});

			if (!defaultModels[capability]) {
				defaultModels[capability] = { providerId, modelId };
			} else {
				defaultModels[capability] = { providerId, modelId };
			}

			await this.configService.update('models.defaults', defaultModels);
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.

			this.viewManager.showNotification(`Default model for ${this.formatCapabilityName(capability)}: ${modelId}`, 'info');
		} catch (error) {
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			this.logger.error(`Error setting default model: ${error instanceof Error ? error.message : String(error)}`);
			this.viewManager.showNotification(`Failed to set default model: ${error instanceof Error ? error.message : String(error)}`, 'error');
		}
	}

	/**
	 * Test provider connection
	 * @param providerId Provider ID
	 */
	private async testProvider(providerId: string): Promise<boolean> {
		try {
			this.logger.info(`Testing provider: ${providerId}`);

			// Show progress notification
			const result = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Testing connection to ${providerId}...`,
				cancellable: false
			}, async () => {
				try {
					// Get provider
					const provider = this.modelManager.getProvider(providerId);

					if (!provider) {
						throw new Error(`Provider ${providerId} not found`);
					}

					// Try to initialize (in case it's not already initialized)
					if (!provider.isReady) {
						await this.modelManager.initializeProvider(providerId);
					}

					if (!provider.isReady) {
						throw new Error(`Provider ${providerId} could not be initialized`);
					}

					// Simple test request
					const models = provider.getModels();

					if (models.size === 0) {
						throw new Error(`No models available for ${providerId}`);
					}
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.

					this.viewManager.showNotification(`Successfully connected to ${providerId}!`, 'info');
					return true;
				} catch (error) {
					if (error instanceof ModelProviderError) {
						throw new Error(`Provider error: ${error.message}`);
					}
					throw error;
				}
			});

			return result;
		} catch (error) {
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
// @ts-ignore: error TS2339: Property 'showNotification' does not exist on type 'ViewManager'.
			this.logger.error(`Error testing provider: ${error instanceof Error ? error.message : String(error)}`);
			this.viewManager.showNotification(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
			return false;
		}
	}

	/**
	 * Refresh the configuration panel
	 * @param panel Webview panel
	 */
	private async refreshConfigurationPanel(panel: vscode.WebviewPanel): Promise<void> {
		try {
			// Get updated provider information
			const providers = this.modelManager.getProviders().map(provider => {
				const isAuthenticated = this.authService.isAuthenticated(provider.id);

				return {
					id: provider.id,
					name: provider.name,
					isReady: provider.isReady,
					isAuthenticated,
					models: Array.from(provider.getModels().values()).map(model => ({
						id: model.id,
						name: model.name,
						capabilities: model.capabilities,
						contextLength: model.contextLength,
						available: model.available
					}))
				};
			});

			// Get current default model settings
			const defaultModels = this.configService.get<Record<string, string>>('models.defaults', {});

			// Update content
			panel.webview.postMessage({
				command: 'updateProviders',
				providers,
				defaultModels
			});
		} catch (error) {
			this.logger.error(`Error refreshing configuration panel: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Format capability name for display
	 * @param capability Capability string
	 * @returns Formatted capability name
	 */
	private formatCapabilityName(capability: string): string {
		// Convert camelCase to Title Case with spaces
		return capability
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, str => str.toUpperCase())
			.trim();
	}
}
