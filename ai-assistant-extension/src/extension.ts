export const EXTENSION_ID = 'superCoderAI';

/**
 * Extension Entry Point
 *
 * Main entry point for the AI Assistant extension.
 * Handles activation, deactivation, and service initialization.
 */

import * as vscode from 'vscode';
import { Logger, LogLevel } from './utils/logger';
import { ConfigService } from './services/configService';
import { AuthService } from './services/authService';
import { TelemetryService } from './services/telemetryService';
import { ModelManager } from './ai/modelManager';
import { PromptManager } from './ai/promptManager';
import { ViewManager } from './ui/viewManager';
import { ContextManager } from './context/contextManager';
import { FileWatcher } from './context/fileWatcher';
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
import { InlineRefactorProvider } from './completions/inlineRefactorProvider';
import { SecurityScanner } from './security/securityScanner';
import { CodeGenerationEnsemble } from './ai/ensemble/codeGenerationEnsemble';
import { SecurityEnsemble } from './ai/ensemble/securityEnsemble';
import { RefactoringEnsemble } from './ai/ensemble/refactoringEnsemble';
import { TestingEnsemble } from './ai/ensemble/testingEnsemble';
import { registerAllCommands, ServiceDependencies } from './commands';
import { AICommands } from './commands/aiCommands';
import { ProviderManager } from './ai/providerManager';
import { TokenUsageStatusBarItem } from './ui/tokenUsageStatusBarItem';
import { WebviewManager } from './ui/webviewManager';
import { AIResponsePanel } from './ui/aiResponsePanel';
import { TokenUsageTracker } from './utils/tokenUsageTracker';
import { TokenUsageDashboard } from './ui/tokenUsageDashboard';
import { ApiKeyManager } from './security/apiKeyManager';
import { SecurityCommands } from './commands/securityCommands';
import { PromptCommands } from './commands/promptCommands';
import { ConfigManager } from './utils/configManager';

// Store disposables for cleanup on deactivation
let disposables: vscode.Disposable[] = [];

/**
 * Extension activation
 * @param context Extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Initialize logger
	const logger = new Logger('AI Assistant');

	// Set log level from configuration
	const config = vscode.workspace.getConfiguration('ai-assistant');
	const logLevel = config.get<string>('logLevel', 'info');
	logger.setLevel(getLogLevel(logLevel));

	logger.info('Activating AI Assistant extension');

	try {
		// Initialize services
		const configService = new ConfigService(context, logger);
		await configService.initialize();

		const fileWatcher = new FileWatcher(logger);
		context.subscriptions.push(fileWatcher);
		// @ts-ignore: error TS2554: Expected 3 arguments, but got 2.

		const webviewManager = new WebviewManager(context, logger);
		context.subscriptions.push(webviewManager);

		// Store webview manager in global state for access by other components
		context.globalState.update('webviewManager', webviewManager);

		// Initialize context manager
		const contextManager = new ContextManager(context, fileWatcher, logger, configService);
		context.subscriptions.push(contextManager);

		// Initialize provider manager
		const providerManager = new ProviderManager(configService, logger);
		await providerManager.initialize();
		context.subscriptions.push(providerManager);

		// Register commands
		const aiCommands = new AICommands(context, providerManager, logger);
		aiCommands.registerCommands();

		// Register status bar
		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		statusBarItem.text = "$(sparkle) AI Assistant";
		statusBarItem.command = 'aiAssistant.selectProvider';
		statusBarItem.tooltip = 'AI Assistant';
		statusBarItem.show();
		context.subscriptions.push(statusBarItem);

		logger.info('AI Assistant extension activated');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Error during extension activation: ${errorMessage}`);
		vscode.window.showErrorMessage(`Error activating AI Assistant: ${errorMessage}`);
	}
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
	// Dispose of disposables not added to context.subscriptions
	disposables.forEach(disposable => {
		try {
			disposable.dispose();
		} catch (error) {
			// Log but don't throw errors during deactivation
			console.error(`Error disposing resource: ${error instanceof Error ? error.message : String(error)}`);
		}
	});
	disposables = [];
}

/**
 * Convert log level string to LogLevel enum
 * @param level Log level string
 * @returns LogLevel enum value
 */
function getLogLevel(level: string): LogLevel {
	switch (level.toLowerCase()) {
		case 'debug': return LogLevel.DEBUG;
		case 'info': return LogLevel.INFO;
		case 'warn': return LogLevel.WARN;
		case 'error': return LogLevel.ERROR;
		default: return LogLevel.INFO;
	}
}

class Person {
	age: number;

	getAge() {
		return this.age;
	}
}
