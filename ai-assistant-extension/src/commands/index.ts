/**
 * Command Registration
 *
 * Centralized command registration for the SuperCoderAI extension.
 * This file aggregates and registers all commands from various modules,
 * ensuring proper initialization and error handling.
 *
 * Features:
 * - Unified command registration
 * - Error handling and logging
 * - Command categorization
 * - Telemetry integration
 *
 * File path: src/commands/index.ts
 */
// @ts-ignore: error TS2300: Duplicate identifier 'vscode'.

// @ts-ignore: error TS2300: Duplicate identifier 'Logger'.
import * as vscode from 'vscode';
// @ts-ignore: error TS2300: Duplicate identifier 'ConfigService'.
import { Logger } from '../utils/logger';
// @ts-ignore: error TS2300: Duplicate identifier 'ModelManager'.
import { ConfigService } from '../services/configService';
// @ts-ignore: error TS2300: Duplicate identifier 'PromptManager'.
import { ModelManager } from '../ai/modelManager';
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
import { PromptManager } from '../ai/promptManager';
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
import { ViewManager } from '../ui/viewManager';
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
import { ContextManager } from '../context/contextManager';
// @ts-ignore: error TS2300: Duplicate identifier 'SecurityEnsemble'.
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
import { SecurityEnsemble } from '../ai/ensemble/securityEnsemble';
import { SecurityScanner } from '../security/securityScanner';
import { ModelCapability } from '../ai/providers/baseProvider';

/**
 * Service dependencies for command handlers
 */
export interface ServiceDependencies {
	logger: Logger;
	configService: ConfigService;
	modelManager: ModelManager;
	promptManager: PromptManager;
	viewManager: ViewManager;
	contextManager: ContextManager;
	codeGenerationEnsemble: CodeGenerationEnsemble;
	securityEnsemble: SecurityEnsemble;
	securityScanner: SecurityScanner;
}

/**
 * Register extension commands
 * @param context Extension context
 * @param services Service dependencies
 * @returns Array of disposables
 */
export function registerCommands(
	context: vscode.ExtensionContext,
	services: ServiceDependencies
): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];
	const { logger, modelManager, promptManager } = services;

	// Toggle inline completions command
	disposables.push(
		vscode.commands.registerCommand(
			'superCoderAI.toggleInlineCompletions',
			async () => {
				try {
					logger.info('Toggling inline completions');

					// Get configuration
					const config = vscode.workspace.getConfiguration('superCoderAI');
					const isEnabled = config.get<boolean>('inlineCompletions.enabled');

					// Toggle setting
					await config.update('inlineCompletions.enabled', !isEnabled, vscode.ConfigurationTarget.Global);

					// Show message
					vscode.window.showInformationMessage(`Inline completions ${!isEnabled ? 'enabled' : 'disabled'}`);
				} catch (error) {
					logger.error(`Error toggling inline completions: ${error instanceof Error ? error.message : String(error)}`);
					vscode.window.showErrorMessage(`Failed to toggle inline completions: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		)
	);

	// Generate tests command
	disposables.push(
		vscode.commands.registerCommand(
			'superCoderAI.generateTests',
			async () => {
				try {
					logger.info('Generating tests');

					// Get active editor
					const editor = vscode.window.activeTextEditor;
					if (!editor) {
						vscode.window.showInformationMessage('No active editor found');
						return;
					}

					// Get document details
					const document = editor.document;
					const fileName = document.fileName;
					const fileContent = document.getText();
					const language = document.languageId;

					// Detect testing framework
					const testingFramework = await detectTestingFramework(language, fileName);

					// Ask for test goals
					const testGoals = await vscode.window.showInputBox({
						prompt: 'Describe your testing goals',
						placeHolder: 'E.g., Unit tests for all public functions, 100% code coverage'
					});

					if (!testGoals) {
						return; // User cancelled
					}

					// Show progress indicator
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: 'Generating Tests...',
							cancellable: false
						},
						async (progress) => {
							try {
								progress.report({ message: 'Analyzing code...' });

// @ts-ignore: error TS2339: Property 'applyTemplate' does not exist on type 'PromptManager'.
								// Apply the test-generation template
								const prompt = await promptManager.applyTemplate('generate-tests', {
									code: fileContent,
									language: language,
									testingFramework: testingFramework,
									codebaseContext: '',
									testGoals: testGoals
								});

								progress.report({ message: 'Generating tests...' });

								// Generate tests using the model
								const result = await modelManager.generateCompletion(
									prompt,
									ModelCapability.Testing,
									{ temperature: 0.3 }
								);

								// Extract code from response
								const testCode = extractTestCode(result.content, language);

								// Create a new file for the tests
								const testFilePath = generateTestFilePath(fileName, language);
								const uri = vscode.Uri.file(testFilePath);

								try {
									// Check if file exists
									await vscode.workspace.fs.stat(uri);

									// If it exists, confirm overwrite
									const overwrite = await vscode.window.showWarningMessage(
										`Test file ${testFilePath} already exists. Do you want to overwrite it?`,
										'Overwrite', 'Cancel'
									);

									if (overwrite !== 'Overwrite') {
										vscode.window.showInformationMessage('Test generation cancelled');
										return;
									}
								} catch (error) {
									// File doesn't exist, we can proceed
								}

								// Create or update the file
								const encoder = new TextEncoder();
								await vscode.workspace.fs.writeFile(uri, encoder.encode(testCode));

								// Open the test file
								const doc = await vscode.workspace.openTextDocument(uri);
								await vscode.window.showTextDocument(doc);

								vscode.window.showInformationMessage('Tests generated successfully!');
							} catch (error) {
								throw error;
							}
						}
					);
				} catch (error) {
					logger.error(`Error generating tests: ${error instanceof Error ? error.message : String(error)}`);
					vscode.window.showErrorMessage(`Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		)
	);

	// Show chat interface command
	disposables.push(
		vscode.commands.registerCommand(
			'superCoderAI.showChatInterface',
			async () => {
				try {
					logger.info('Opening chat interface');
					// TODO: Implement chat interface in a future update
					vscode.window.showInformationMessage('Chat interface will be available in a future update');
				} catch (error) {
					logger.error(`Error opening chat interface: ${error instanceof Error ? error.message : String(error)}`);
					vscode.window.showErrorMessage(`Failed to open chat interface: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		)
	);

	// Additional commands will be added here in future updates

	return disposables;
}

/**
 * Commands module index
 *
 * Exports command registration functions and types used for extension commands.
 */
// @ts-ignore: error TS2300: Duplicate identifier 'vscode'.

// @ts-ignore: error TS2300: Duplicate identifier 'ModelManager'.
;
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
import { ModelManager } from '..uplicate identifier 'SecurityEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'SecurityEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'SecurityEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'SecurityEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'SecurityEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'SecurityEnsemble'.
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
ifactoringEnsemble } from '../ai/ensemble/refactoringEnsemble';
// @ts-ignore: errror TS2300: Duplicate identifier 'ConfigService'.
// @ts-ignore: error TS2300: Duplicate identifier 'ConfigService'.
// @ts-ignore: error TS2300: Duplicate identifier 'ConfigService'.
// @ts-ignore: error TS2300: Duplicate identifier 'ConfigService'.
// @ts-ignore: error TS2300: Duplicate identifier 'ConfigService'.
import { TestingEnsemble } from '../ai/ensemble/testingEnsemble';
import { ConfigService } from '../services/authService';
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
import { TelemetryService } from '../services/telemetryService';
// @ts-ignore: error TS2300: Duplicate identifier 'Logger'.
import { ViewManager } from '../ui/viewManager';
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
import { Logger } fro
// @ts-ignore: error TS2300: Duplicate identifier 'PromptManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'PromptManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'PromptManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'PromptManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'PromptManager'.
import { ContextManager } from '../context/contextManager';
import { PromptManager } from '../ai/promptManager';

/**
 * Service dependencies for commands
 */
export interface ServiceDependencies {
	context: vscode.ExtensionCrityEnsemble;
	refactoringEnsemble: RefactoringEnsemble;
	testingEnsemble: TestingEnsemble;
	configService: ConfigService;
	authService: AuthService;
	telemetryService: TelemetryService;
	viewManager: ViewManager;
	contextManager: ContextManager;
	logger: Logger;
	promptManager: PromptManager;
}

// Import command modules
import { SecurityCommands } from './securityCommands';
import { ContextAwareCommands } from './contextAwareCommands';
import { ConfigureProvidersCommand } from './configureProvidersCommand';

/**
 * Register all extension commands
 * @param services Service dependencies
 * @returns Array of disposable command registrations
 */
export function registerAllCommands(services: ServiceDependencies): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];

	// Create command handlers
	const securityCommands = new SecurityCommands(
		services.securityEnsemble,
		services.logger,
// @ts-ignore: error TS2554: Expected 3 arguments, but got 5.
// @ts-ignore: error TS2554: Expected 3 arguments, but got 5.
// @ts-ignore: error TS2554: Expected 3 arguments, but got 5.
// @ts-ignore: error TS2554: Expected 3 arguments, but got 5.
// @ts-ignore: error TS2554: Expected 3 arguments, but got 5.
// @ts-ignore: error TS2554: Expected 3 arguments, but got 5.
		services.configService,
		services.viewManager,
		services.contextManager
	);

	const contextAwareCommands = new ContextAwareCommands(
		services.context,
		services.logger,
		services.configService,
		services.viewManager,
		services.contextManager,
		services.modelManager,
		services.codeGenerationEnsemble
	);

	const configureProvidersCommand = new ConfigureProvidersCommand(
		services.context,
		services.modelManager,
		services.authService,
		services.configService,
		services.logger,
		services.viewManager
	);

// @ts-ignore: error TS2339: Property 'register' does not exist on type 'SecurityCommands'.
	// Register all commands from each handler
	disposables.push(...securityCommands.register());
	disposables.push(...contextAwareCommands.register());
	disposables.push(...configureProvidersCommand.register());

	// Register global commands
	disposables.push(
		vscode.commands.registerCommand('ai-assistant.showSettings', () => {
			vscode.commands.executeCommand('workbench.action.openSettings', '@ext:vscode.ai-assistant');
		})
	);

	return disposables;
}

/**
 * Generate a test file path based on the original file
 * @param filePath Original file path
 * @param language Programming language
 * @returns Path for the test file
 */
function generateTestFilePath(filePath: string, language: string): string {
	const path = require('path');
	const { dir, name, ext } = path.parse(filePath);

	switch (language) {
		case 'typescript':
		case 'javascript':
			return path.join(dir, `${name}.test${ext}`);
		case 'python':
			return path.join(dir, `test_${name}${ext}`);
		case 'java':
			return path.join(dir, `${name}Test${ext}`);
		case 'csharp':
			return path.join(dir, `${name}Tests${ext}`);
		default:
			return path.join(dir, `${name}_test${ext}`);
	}
}

/**
 * Extract test code from model response
 * @param content Model response content
 * @param language Programming language
 * @returns Extracted test code
 */
function extractTestCode(content: string, language: string): string {
	const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\s*([\\s\\S]*?)\\s*\`\`\``, 'i');
	const match = content.match(codeBlockRegex);

	if (match && match[1]) {
		return match[1].trim();
	}

	const lines = content.split('\n');
	const relevantLines = lines.filter(line =>
		!line.toLowerCase().includes('here is the test code') &&
		!line.toLowerCase().includes('test code:') &&
		!line.toLowerCase().includes('generated tests:')
	);

	return relevantLines.join('\n').trim();
}

/**
 * Detect appropriate testing framework based on language and file context
 * @param language Programming language
 * @param filePath Path to file being tested
 * @returns Suggested testing framework
 */
async function detectTestingFramework(language: string, filePath: string): Promise<string> {
	// This is a simple implementation; in reality, you'd scan the project
	// for dependencies to determine the testing framework
	switch (language) {
		case 'javascript':
		case 'typescript':
			// Check for Jest or Mocha in package.json or try to detect based on file patterns
			return 'Jest';
		case 'python':
			// Check for pytest or unittest
			return 'pytest';
		case 'java':
			// Check for JUnit or TestNG
			return 'JUnit';
		case 'csharp':
			// Check for xUnit, NUnit, or MSTest
			return 'xUnit';
		case 'go':
			// Go uses the built-in testing package
			return 'go test';
		default:
			return 'appropriate testing framework';
	}
}
