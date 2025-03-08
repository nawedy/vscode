import * as vscode from 'vscode';
import { BaseModelProvider, ModelCapability } from '../ai/providers/baseProvider';
import { Logger } from '../utils/logger';
import { AIResponsePanel } from '../ui/aiResponsePanel';
import { ProviderManager } from '../ai/providerManager';
import { TokenUsageTracker } from '../utils/tokenUsageTracker';
import { WebviewManager } from '../ui/webviewManager';

/**
 * Registers and handles AI assistant commands
 */
export class AICommands {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly providerManager: ProviderManager;
	private readonly tokenTracker: TokenUsageTracker;
	private responsePanel: AIResponsePanel;

	/**
	 * Create a new AICommands instance
	 */
	constructor(
		context: vscode.ExtensionContext,
		providerManager: ProviderManager,
		logger: Logger
	) {
		this.context = context;
		this.providerManager = providerManager;
		this.logger = logger;
		this.tokenTracker = new TokenUsageTracker(context);
	}

	/**
	 * Register all AI assistant commands
	 */
	public registerCommands(): void {
		this.logger.info('Registering AI assistant commands');

		// Register core commands
		this.registerExplainCodeCommand();
		this.registerGenerateCodeCommand();
		this.registerRefactorCodeCommand();
		this.registerOptimizeCodeCommand();
		this.registerDocumentCodeCommand();
		this.registerProviderSelectorCommand();

		this.logger.info('AI assistant commands registered');
	}

	/**
	 * Register command to explain selected code
	 */
	private registerExplainCodeCommand(): void {
		const command = vscode.commands.registerCommand('aiAssistant.explainCode', async () => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showWarningMessage('Open a file to explain code');
					return;
				}

				const selection = editor.selection;
				const selectedCode = editor.document.getText(selection);

				if (!selectedCode) {
					vscode.window.showWarningMessage('Please select code to explain');
					return;
				}

				const language = editor.document.languageId;
				const provider = await this.providerManager.getProviderForCapability(ModelCapability.Explanation);

				if (!provider) {
					vscode.window.showErrorMessage('No provider available for code explanation');
					return;
				}

				const prompt = `Explain the following ${language} code:\n\n${selectedCode}`;

				// Show progress indicator
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Generating explanation...',
					cancellable: true
				}, async (progress, token) => {
					const responsePanel = this.createResponsePanel();
					await responsePanel.showResponse('code-explanation', 'Code Explanation', async (updateCallback) => {
						updateCallback('Loading...');
						await this.sendStreamingRequest(provider, prompt, responsePanel, token);
						return { content: 'Explanation complete' };
					});

					return new Promise<void>(resolve => {
						// Resolve when complete
						resolve();
					});
				});
			} catch (error) {
				this.handleError('Failed to explain code', error);
			}
		});

		this.context.subscriptions.push(command);
	}

	/**
	 * Register command to generate code based on description
	 */
	private registerGenerateCodeCommand(): void {
		const command = vscode.commands.registerCommand('aiAssistant.generateCode', async () => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showWarningMessage('Open a file to generate code');
					return;
				}

				const language = editor.document.languageId;
				const description = await vscode.window.showInputBox({
					prompt: 'Describe the code you want to generate',
					placeHolder: 'E.g., A function that sorts an array of objects by a property'
				});

				if (!description) {
					return;
				}

				const provider = await this.providerManager.getProviderForCapability(ModelCapability.CodeGeneration);

				if (!provider) {
					vscode.window.showErrorMessage('No provider available for code generation');
					return;
				}

				const prompt = `Generate ${language} code for: ${description}`;

				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Generating code...',
					cancellable: true
				}, async (progress, token) => {
					const responsePanel = this.createResponsePanel();
					await responsePanel.showResponse('code-generation', 'Generated Code', async (updateCallback) => {
						updateCallback('Loading...');
						await this.sendStreamingRequest(provider, prompt, responsePanel, token);
						return { content: 'Code generation complete' };
					});

					return new Promise<void>(resolve => {
						resolve();
					});
				});
			} catch (error) {
				this.handleError('Failed to generate code', error);
			}
		});

		this.context.subscriptions.push(command);
	}

	/**
	 * Register command to refactor selected code
	 */
	private registerRefactorCodeCommand(): void {
		const command = vscode.commands.registerCommand('aiAssistant.refactorCode', async () => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showWarningMessage('Open a file to refactor code');
					return;
				}

				const selection = editor.selection;
				const selectedCode = editor.document.getText(selection);

				if (!selectedCode) {
					vscode.window.showWarningMessage('Please select code to refactor');
					return;
				}

				const language = editor.document.languageId;
				const provider = await this.providerManager.getProviderForCapability(ModelCapability.Refactoring);

				if (!provider) {
					vscode.window.showErrorMessage('No provider available for code refactoring');
					return;
				}

				const prompt = `Refactor the following ${language} code to improve its readability, performance, and maintainability:\n\n${selectedCode}`;

				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Refactoring code...',
					cancellable: true
				}, async (progress, token) => {
					const responsePanel = this.createResponsePanel();
					await responsePanel.showResponse('code-refactoring', 'Refactored Code', async (updateCallback) => {
						updateCallback('Loading...');
						await this.sendStreamingRequest(provider, prompt, responsePanel, token);
						return { content: 'Refactoring complete' };
					});

					return new Promise<void>(resolve => {
						resolve();
					});
				});
			} catch (error) {
				this.handleError('Failed to refactor code', error);
			}
		});

		this.context.subscriptions.push(command);
	}

	/**
	 * Register command to optimize selected code
	 */
	private registerOptimizeCodeCommand(): void {
		const command = vscode.commands.registerCommand('aiAssistant.optimizeCode', async () => {
			try {
				// Implementation similar to refactor command but with optimization focus
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showWarningMessage('Open a file to optimize code');
					return;
				}

				const selection = editor.selection;
				const selectedCode = editor.document.getText(selection);

				if (!selectedCode) {
					vscode.window.showWarningMessage('Please select code to optimize');
					return;
				}

				const language = editor.document.languageId;
				const provider = await this.providerManager.getProviderForCapability(ModelCapability.Explanation);

				if (!provider) {
					vscode.window.showErrorMessage('No provider available for code optimization');
					return;
				}

				const prompt = `Optimize the following ${language} code for better performance:\n\n${selectedCode}`;

				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Optimizing code...',
					cancellable: true
				}, async (progress, token) => {
					const responsePanel = this.createResponsePanel();
					await responsePanel.showResponse('code-optimization', 'Optimized Code', async (updateCallback) => {
						updateCallback('Loading...');
						await this.sendStreamingRequest(provider, prompt, responsePanel, token);
						return { content: 'Optimization complete' };
					});

					return new Promise<void>(resolve => {
						resolve();
					});
				});
			} catch (error) {
				this.handleError('Failed to optimize code', error);
			}
		});

		this.context.subscriptions.push(command);
	}

	/**
	 * Register command to document selected code
	 */
	private registerDocumentCodeCommand(): void {
		const command = vscode.commands.registerCommand('aiAssistant.documentCode', async () => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showWarningMessage('Open a file to document code');
					return;
				}

				const selection = editor.selection;
				const selectedCode = editor.document.getText(selection);

				if (!selectedCode) {
					vscode.window.showWarningMessage('Please select code to document');
					return;
				}

				const language = editor.document.languageId;
				const provider = await this.providerManager.getProviderForCapability(ModelCapability.Explanation);

				if (!provider) {
					vscode.window.showErrorMessage('No provider available for code documentation');
					return;
				}

				const prompt = `Add comprehensive documentation comments to this ${language} code:\n\n${selectedCode}`;

				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Documenting code...',
					cancellable: true
				}, async (progress, token) => {
					const responsePanel = this.createResponsePanel();
					await responsePanel.showResponse('code-documentation', 'Documented Code', async (updateCallback) => {
						updateCallback('Loading...');
						await this.sendStreamingRequest(provider, prompt, responsePanel, token);
						return { content: 'Documentation complete' };
					});

					return new Promise<void>(resolve => {
						resolve();
					});
				});
			} catch (error) {
				this.handleError('Failed to document code', error);
			}
		});

		this.context.subscriptions.push(command);
	}

	/**
	 * Register command to select AI provider
	 */
	private registerProviderSelectorCommand(): void {
		const command = vscode.commands.registerCommand('aiAssistant.selectProvider', async () => {
			try {
				const providers = this.providerManager.getAvailableProviders();

				if (providers.length === 0) {
					vscode.window.showErrorMessage('No AI providers available');
					return;
				}

				const items = providers.map(provider => ({
					label: provider.name,
					description: provider.id,
					provider
				}));

				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: 'Select AI provider'
				});

				if (selected) {
					await this.providerManager.setActiveProvider(selected.provider.id);
					vscode.window.showInformationMessage(`Using ${selected.label} as the active AI provider`);
				}
			} catch (error) {
				this.handleError('Failed to select provider', error);
			}
		});

		this.context.subscriptions.push(command);
	}

	/**
	 * Send streaming request to provider and handle response
	 * @param provider The model provider
	 * @param prompt The prompt text
	 * @param responsePanel Panel to display the response
	 * @param cancelToken Cancellation token
	 */
	private async sendStreamingRequest(
		provider: BaseModelProvider,
		prompt: string,
		responsePanel: AIResponsePanel,
		cancelToken?: vscode.CancellationToken
	): Promise<void> {
		try {
			// Track token usage
			const estimatedPromptTokens = await provider.countTokens(prompt);
			this.tokenTracker.recordPromptTokens(provider.id, estimatedPromptTokens);

			await provider.generateCompletionStream(prompt, {
				onContent: (content: string) => {
					// Check if response panel has the method
					if (typeof responsePanel.appendContent === 'function') {
						responsePanel.appendContent(content);
					}
				},
				onComplete: (response) => {
					// Check if response panel has the method
					if (typeof responsePanel.finishContent === 'function') {
						responsePanel.finishContent();
					}

					// Track completion tokens
					this.tokenTracker.recordCompletionTokens(
						provider.id,
						response.completionTokens || 0
					);
				},
				onError: (error) => {
					// Check if response panel has the method
					if (typeof responsePanel.showError === 'function') {
						responsePanel.showError(`Error: ${error.message}`);
					}
					this.logger.error(`Streaming request error: ${error.message}`);
				}
			});
		} catch (error) {
			this.handleError('Error in streaming request', error);
		}
	}

	/**
	 * Create response panel if needed
	 * @returns AIResponsePanel instance
	 */
	private createResponsePanel(): AIResponsePanel {
		if (!this.responsePanel) {
			const webviewManager = this.context.globalState.get<WebviewManager>('webviewManager');

			if (!webviewManager) {
				throw new Error('WebviewManager not available');
			}

			this.responsePanel = new AIResponsePanel(this.context, webviewManager, this.logger);
		}
		return this.responsePanel;
	}

	/**
	 * Handle errors with standardized approach
	 * @param message User-facing error message
	 * @param error The actual error
	 */
	private handleError(message: string, error: unknown): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		this.logger.error(`${message}: ${errorMessage}`);
		vscode.window.showErrorMessage(`${message}: ${errorMessage}`);
	}
}
