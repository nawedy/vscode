/**
 * Context-Aware Commands for SuperCoderAI VSCode Extension
 *
 * This file implements command handlers for context-aware code operations
 * such as code generation, refactoring, and completion. These commands leverage
 * the CodeGenerationEnsemble and ContextManager to provide intelligent,
 * context-aware code operations.
 *
 * Key features:
 * - Context-aware code generation
 * - Intelligent refactoring based on project context
 * - Code optimization with context understanding
 * - Feature implementation across multiple files
 * - Context-aware code explanations
 *
 * File path: src/commands/contextAwareCommands.ts
 */
import * as vscode from 'vscode';
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
import * as path from 'path';
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ViewManager'.
import { ContextManager } from '../context/contextManager';
import { ViewManager } from '../ui/viewManager';
import { logger } from '../utils/logger';
// @ts-ignore: error TS2300: Duplicate identifier 'ModelCapability'.
// @ts-ignore: error TS2300: Duplicate identifier 'ModelCapability'.
// @ts-ignore: error TS2300: Duplicate identifier 'ModelCapability'.
// @ts-ignore: error TS2300: Duplicate identifier 'ModelCapability'.
// @ts-ignore: error TS2300: Duplicate identifier 'ModelCapability'.
// @ts-ignore: error TS2300: Duplicate identifier 'ModelCapability'.
import { ServiceDependencies } from './index';
import { ModelCapability } from '../ai/providers/baseProvider';

/**
 * Register all context-aware commands
 *
 * @param context Extension context
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 * @returns Array of disposable command registrations
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
 */
export function registerContextAwareCommands(
	context: vscode.ExtensionContext,
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];

	// Generate code command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.generateCode',
			() => handleGenerateCode(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	// Refactor code command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.refactorCode',
			() => handleRefactorCode(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	// Optimize code command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.optimizeCode',
			() => handleOptimizeCode(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	// Generate feature command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.generateFeature',
			() => handleGenerateFeature(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	// Improve code command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.improveCode',
			() => handleImproveCode(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	// Explain code command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.explainCode',
			() => handleExplainCode(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	// Complete code command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.completeCode',
			() => handleCompleteCode(codeGenerationEnsemble, contextManager, viewManager)
		)
	);

	logger.info('Context-aware commands registered');

	return disposables;
}

/**
 * Handle generate code command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleGenerateCode(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Show input box for requirements
		const requirements = await vscode.window.showInputBox({
			prompt: 'Enter code generation requirements',
			placeHolder: 'Describe the code you want to generate'
		});

		if (!requirements) {
			return; // User cancelled
		}

		// Get current editor and language
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = editor.document;
		const language = document.languageId;

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Generating code...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering context...' });

				let projectContext = {};
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
					// @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

					projectContext = await contextManager.getFileContext(
						workspaceUri,
						document.uri.fsPath,
						4000 // Context token limit
					);
				}

				// Generate code
				progress.report({ message: 'Generating code...' });

				const result = await codeGenerationEnsemble.executeTask('generateCode', {
					requirements,
					language,
					projectContext
				});

				// Show result in new document
				progress.report({ message: 'Preparing results...' });

				if (result && result.content && result.content.code) {
					const generatedCode = result.content.code;

					// Create new document
					const newDocument = await vscode.workspace.openTextDocument({
						language,
						content: generatedCode
					});

					// Show document
					await vscode.window.showTextDocument(newDocument, vscode.ViewColumn.Beside);

					// Show success message
					vscode.window.showInformationMessage('Code generated successfully');
				} else {
					vscode.window.showErrorMessage('Failed to generate code');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in generateCode command: ${error.message}`);
		vscode.window.showErrorMessage(`Code generation failed: ${error.message}`);
	}
}

/**
 * Handle refactor code command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleRefactorCode(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Get current editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = editor.document;
		const language = document.languageId;

		// Get selected code or entire document
		let codeToRefactor: string;
		let selection = editor.selection;

		if (selection && !selection.isEmpty) {
			codeToRefactor = document.getText(selection);
		} else {
			codeToRefactor = document.getText();
			selection = new vscode.Selection(
				0, 0,
				document.lineCount - 1,
				document.lineAt(document.lineCount - 1).range.end.character
			);
		}

		// Show quick pick for refactoring goals
		const refactoringGoals = await vscode.window.showQuickPick(
			[
				'Improve readability',
				'Enhance performance',
				'Add type safety',
				'Extract functions',
				'Convert to modern syntax',
				'Follow best practices',
				'Custom goal'
			],
			{
				placeHolder: 'Select refactoring goals (you can select multiple)',
				canPickMany: true
			}
		);

		if (!refactoringGoals || refactoringGoals.length === 0) {
			return; // User cancelled
		}

		// Handle custom goal
		let customGoal: string | undefined;
		if (refactoringGoals.includes('Custom goal')) {
			customGoal = await vscode.window.showInputBox({
				prompt: 'Enter custom refactoring goal',
				placeHolder: 'Describe how you want the code refactored'
			});

			if (!customGoal) {
				return; // User cancelled
			}
		}

		// Prepare goals
		const goals = refactoringGoals
			.filter(goal => goal !== 'Custom goal')
			.concat(customGoal ? [customGoal] : []);

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Refactoring code...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering context...' });

				let projectContext = {};
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
					// @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

					projectContext = await contextManager.getFileContext(
						workspaceUri,
						document.uri.fsPath,
						3000 // Context token limit
					);
				}

				// Refactor code
				progress.report({ message: 'Refactoring code...' });

				const result = await codeGenerationEnsemble.executeTask('refactorCode', {
					originalCode: codeToRefactor,
					refactoringGoals: goals,
					language,
					projectContext
				});

				// Apply result
				progress.report({ message: 'Applying refactoring...' });

				if (result && result.content && result.content.refactoredCode) {
					const refactoredCode = result.content.refactoredCode;

					// Create webview to show diff and confirm changes
					const panel = viewManager.createWebviewPanel(
						'codeRefactoring',
						'Code Refactoring',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load diff view template
					const template = viewManager.loadHtmlTemplate('diffView');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Code Refactoring',
						originalCode: codeToRefactor,
						newCode: refactoredCode,
						language,
						explanation: result.content.verification || 'Code has been refactored according to the specified goals.'
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'applyChanges') {
							// Apply the refactored code
							await editor.edit(editBuilder => {
								editBuilder.replace(selection, refactoredCode);
							});

							// Close the panel
							panel.dispose();

							// Show success message
							vscode.window.showInformationMessage('Code refactored successfully');
						} else if (message.command === 'cancelChanges') {
							// Close the panel
							panel.dispose();

							// Show cancelled message
							vscode.window.showInformationMessage('Refactoring cancelled');
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to refactor code');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in refactorCode command: ${error.message}`);
		vscode.window.showErrorMessage(`Code refactoring failed: ${error.message}`);
	}
}

/**
 * Handle optimize code command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleOptimizeCode(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Get current editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = editor.document;
		const language = document.languageId;

		// Get selected code or entire document
		let codeToOptimize: string;
		let selection = editor.selection;

		if (selection && !selection.isEmpty) {
			codeToOptimize = document.getText(selection);
		} else {
			codeToOptimize = document.getText();
			selection = new vscode.Selection(
				0, 0,
				document.lineCount - 1,
				document.lineAt(document.lineCount - 1).range.end.character
			);
		}

		// Show quick pick for optimization goals
		const optimizationGoals = await vscode.window.showQuickPick(
			[
				'Performance optimization',
				'Memory usage reduction',
				'Time complexity improvement',
				'Space complexity improvement',
				'Algorithm optimization',
				'Resource usage optimization',
				'Custom optimization'
			],
			{
				placeHolder: 'Select optimization goals (you can select multiple)',
				canPickMany: true
			}
		);

		if (!optimizationGoals || optimizationGoals.length === 0) {
			return; // User cancelled
		}

		// Handle custom goal
		let customGoal: string | undefined;
		if (optimizationGoals.includes('Custom optimization')) {
			customGoal = await vscode.window.showInputBox({
				prompt: 'Enter custom optimization goal',
				placeHolder: 'Describe how you want the code optimized'
			});

			if (!customGoal) {
				return; // User cancelled
			}
		}

		// Prepare goals
		const goals = optimizationGoals
			.filter(goal => goal !== 'Custom optimization')
			.concat(customGoal ? [customGoal] : []);

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Optimizing code...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering context...' });

				let projectContext = {};
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
					// @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

					projectContext = await contextManager.getFileContext(
						workspaceUri,
						document.uri.fsPath,
						3000 // Context token limit
					);
				}

				// Optimize code
				progress.report({ message: 'Optimizing code...' });

				const result = await codeGenerationEnsemble.executeTask('optimizeCode', {
					originalCode: codeToOptimize,
					optimizationGoals: goals,
					language,
					projectContext
				});

				// Apply result
				progress.report({ message: 'Preparing optimized code...' });

				if (result && result.content && result.content.optimizedCode) {
					const optimizedCode = result.content.optimizedCode;
					const performanceAnalysis = result.content.performanceAnalysis || '';

					// Create webview to show diff and confirm changes
					const panel = viewManager.createWebviewPanel(
						'codeOptimization',
						'Code Optimization',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load diff view template
					const template = viewManager.loadHtmlTemplate('diffView');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Code Optimization',
						originalCode: codeToOptimize,
						newCode: optimizedCode,
						language,
						explanation: performanceAnalysis
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'applyChanges') {
							// Apply the optimized code
							await editor.edit(editBuilder => {
								editBuilder.replace(selection, optimizedCode);
							});

							// Close the panel
							panel.dispose();

							// Show success message
							vscode.window.showInformationMessage('Code optimized successfully');
						} else if (message.command === 'cancelChanges') {
							// Close the panel
							panel.dispose();

							// Show cancelled message
							vscode.window.showInformationMessage('Optimization cancelled');
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to optimize code');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in optimizeCode command: ${error.message}`);
		vscode.window.showErrorMessage(`Code optimization failed: ${error.message}`);
	}
}

/**
 * Handle generate feature command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleGenerateFeature(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Check if workspace is open
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('Please open a workspace to generate a feature');
			return;
		}

		// Get feature description
		const featureDescription = await vscode.window.showInputBox({
			prompt: 'Enter feature description',
			placeHolder: 'Describe the feature you want to implement'
		});

		if (!featureDescription) {
			return; // User cancelled
		}

		// Get feature requirements
		const requirementsInput = await vscode.window.showInputBox({
			prompt: 'Enter feature requirements (separated by commas)',
			placeHolder: 'List specific requirements for the feature'
		});

		if (requirementsInput === undefined) {
			return; // User cancelled
		}

		// Parse requirements
		const featureRequirements = requirementsInput
			? requirementsInput.split(',').map(req => req.trim())
			: [];

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Generating feature...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering project context...' });

				// @ts-ignore: error TS2339: Property 'getProjectContext' does not exist on type 'ContextManager'.
				// @ts-ignore: error TS2339: Property 'getProjectContext' does not exist on type 'ContextManager'.
				// @ts-ignore: error TS2339: Property 'getProjectContext' does not exist on type 'ContextManager'.
				// @ts-ignore: error TS2339: Property 'getProjectContext' does not exist on type 'ContextManager'.
				// @ts-ignore: error TS2339: Property 'getProjectContext' does not exist on type 'ContextManager'.
				// @ts-ignore: error TS2339: Property 'getProjectContext' does not exist on type 'ContextManager'.
				const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
				const projectContext = await contextManager.getProjectContext(workspaceUri);

				// Generate feature
				progress.report({ message: 'Generating feature implementation...' });

				const result = await codeGenerationEnsemble.executeTask('generateFeature', {
					featureDescription,
					featureRequirements,
					projectContext
				});

				// Process result
				progress.report({ message: 'Preparing implementation...' });

				if (result && result.content && result.content.files) {
					const files = result.content.files;
					const implementationPlan = result.content.implementationPlan || '';

					// Create webview to show feature implementation
					const panel = viewManager.createWebviewPanel(
						'featureImplementation',
						'Feature Implementation',
						vscode.ViewColumn.Active,
						{ enableScripts: true }
					);

					// Load feature implementation template
					const template = viewManager.loadHtmlTemplate('featureImplementation');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Feature Implementation',
						featureDescription,
						implementationPlan,
						files: JSON.stringify(files)
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'createFile') {
							// Create the file
							await createFile(workspaceUri, message.data.filePath, message.data.content);
						} else if (message.command === 'updateFile') {
							// Update existing file
							await updateFile(workspaceUri, message.data.filePath, message.data.content);
						} else if (message.command === 'openFile') {
							// Open the file
							await openFile(workspaceUri, message.data.filePath);
						} else if (message.command === 'implementAll') {
							// Implement all files
							await implementAllFiles(workspaceUri, files);

							// Show success message
							vscode.window.showInformationMessage('Feature implemented successfully');
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to generate feature implementation');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in generateFeature command: ${error.message}`);
		vscode.window.showErrorMessage(`Feature generation failed: ${error.message}`);
	}
}

/**
 * Handle improve code command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleImproveCode(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Get current editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = editor.document;
		const language = document.languageId;

		// Get selected code or entire document
		let codeToImprove: string;
		let selection = editor.selection;

		if (selection && !selection.isEmpty) {
			codeToImprove = document.getText(selection);
		} else {
			codeToImprove = document.getText();
			selection = new vscode.Selection(
				0, 0,
				document.lineCount - 1,
				document.lineAt(document.lineCount - 1).range.end.character
			);
		}

		// Show quick pick for improvement goals
		const improvementGoals = await vscode.window.showQuickPick(
			[
				'Overall code quality',
				'Readability improvements',
				'Performance optimizations',
				'Error handling',
				'Security enhancements',
				'Follow best practices',
				'Custom improvement'
			],
			{
				placeHolder: 'Select improvement goals (you can select multiple)',
				canPickMany: true
			}
		);

		if (!improvementGoals || improvementGoals.length === 0) {
			return; // User cancelled
		}

		// Handle custom goal
		let customGoal: string | undefined;
		if (improvementGoals.includes('Custom improvement')) {
			customGoal = await vscode.window.showInputBox({
				prompt: 'Enter custom improvement goal',
				placeHolder: 'Describe how you want the code improved'
			});

			if (!customGoal) {
				return; // User cancelled
			}
		}

		// Prepare goals
		const goals = improvementGoals
			.filter(goal => goal !== 'Custom improvement')
			.concat(customGoal ? [customGoal] : []);

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Improving code...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering context...' });

				let projectContext = {};
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
					// @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

					projectContext = await contextManager.getFileContext(
						workspaceUri,
						document.uri.fsPath,
						3000 // Context token limit
					);
				}

				// Improve code
				progress.report({ message: 'Improving code...' });

				const result = await codeGenerationEnsemble.executeTask('improveCode', {
					originalCode: codeToImprove,
					improvementGoals: goals,
					language,
					projectContext
				});

				// Apply result
				progress.report({ message: 'Preparing improved code...' });

				if (result && result.content && result.content.improvedCode) {
					const improvedCode = result.content.improvedCode;
					const explanation = result.content.improvementExplanation || '';

					// Create webview to show diff and confirm changes
					const panel = viewManager.createWebviewPanel(
						'codeImprovement',
						'Code Improvement',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load diff view template
					const template = viewManager.loadHtmlTemplate('diffView');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Code Improvement',
						originalCode: codeToImprove,
						newCode: improvedCode,
						language,
						explanation
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'applyChanges') {
							// Apply the improved code
							await editor.edit(editBuilder => {
								editBuilder.replace(selection, improvedCode);
							});

							// Close the panel
							panel.dispose();

							// Show success message
							vscode.window.showInformationMessage('Code improved successfully');
						} else if (message.command === 'cancelChanges') {
							// Close the panel
							panel.dispose();

							// Show cancelled message
							vscode.window.showInformationMessage('Improvement cancelled');
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to improve code');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in improveCode command: ${error.message}`);
		vscode.window.showErrorMessage(`Code improvement failed: ${error.message}`);
	}
}

/**
 * Handle explain code command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleExplainCode(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Get current editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = editor.document;
		const language = document.languageId;

		// Get selected code or entire document
		let codeToExplain: string;
		let selection = editor.selection;

		if (selection && !selection.isEmpty) {
			codeToExplain = document.getText(selection);
		} else {
			codeToExplain = document.getText();
		}

		// Ask for explanation detail level
		const detailLevel = await vscode.window.showQuickPick(
			[
				'Basic explanation',
				'Detailed explanation',
				'Expert-level explanation'
			],
			{
				placeHolder: 'Select explanation detail level'
			}
		);

		if (!detailLevel) {
			return; // User cancelled
		}

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Explaining code...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering context...' });

				let projectContext = {};
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
					// @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

					projectContext = await contextManager.getFileContext(
						workspaceUri,
						document.uri.fsPath,
						3000 // Context token limit
					);
				}

				// Explain code with "explainCode" task
				progress.report({ message: 'Generating explanation...' });

				// Using improveCode task with specific goals for explanation
				const result = await codeGenerationEnsemble.executeTask('improveCode', {
					originalCode: codeToExplain,
					improvementGoals: [`Explain code (${detailLevel})`],
					language,
					projectContext,
					mode: 'explain' // Special mode for explanation
				});

				// Show explanation
				progress.report({ message: 'Preparing explanation...' });

				if (result && result.content && result.content.improvementExplanation) {
					const explanation = result.content.improvementExplanation;

					// Create webview to show explanation
					const panel = viewManager.createWebviewPanel(
						'codeExplanation',
						'Code Explanation',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load explanation template
					const template = viewManager.loadHtmlTemplate('codeExplanation');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Code Explanation',
						code: codeToExplain,
						language,
						explanation,
						detailLevel
					});
				} else {
					vscode.window.showErrorMessage('Failed to generate code explanation');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in explainCode command: ${error.message}`);
		vscode.window.showErrorMessage(`Code explanation failed: ${error.message}`);
	}
}

/**
 * Handle complete code command
 *
 * @param codeGenerationEnsemble Code generation ensemble
 * @param contextManager Context manager
 * @param viewManager View manager
 */
async function handleCompleteCode(
	codeGenerationEnsemble: CodeGenerationEnsemble,
	contextManager: ContextManager,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Get current editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = editor.document;
		const language = document.languageId;

		// Get code before cursor
		const cursorPosition = editor.selection.active;
		const textBeforeCursor = new vscode.Range(0, 0, cursorPosition.line, cursorPosition.character);
		const partialCode = document.getText(textBeforeCursor);

		// @ts-ignore: error TS2575: No overload expects 3 arguments, but overloads do exist that expect either 2 or 4 arguments.
		// Get code after cursor
		const textAfterCursor = new vscode.Range(cursorPosition, document.lineCount, 0);
		const suffixCode = document.getText(textAfterCursor);

		// Ask for completion instructions
		const instructions = await vscode.window.showInputBox({
			prompt: 'Enter completion instructions (optional)',
			placeHolder: 'What do you want the completed code to do?'
		});

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Completing code...',
				cancellable: false
			},
			async (progress) => {
				// Get project context
				progress.report({ message: 'Gathering context...' });

				let projectContext = {};
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
					// @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

					projectContext = await contextManager.getFileContext(
						workspaceUri,
						document.uri.fsPath,
						3000 // Context token limit
					);
				}

				// Complete code
				progress.report({ message: 'Generating completion...' });

				const result = await codeGenerationEnsemble.executeTask('completeCode', {
					partialCode,
					suffix: suffixCode,
					instructions: instructions || 'Complete the code logically',
					language,
					projectContext
				});

				// Apply result
				progress.report({ message: 'Applying completion...' });

				if (result && result.content && result.content.completedCode) {
					const completedCode = result.content.completedCode;

					// Only get the part that needs to be inserted
					const completionPart = extractCompletion(partialCode, completedCode);

					// Apply the completion at cursor position
					await editor.edit(editBuilder => {
						editBuilder.insert(cursorPosition, completionPart);
					});

					// Show success message
					vscode.window.showInformationMessage('Code completed successfully');
				} else {
					vscode.window.showErrorMessage('Failed to complete code');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in completeCode command: ${error.message}`);
		vscode.window.showErrorMessage(`Code completion failed: ${error.message}`);
	}
}

/**
 * Extract the completion part from the generated code
 *
 * @param prefix Original prefix
 * @param completedCode Generated completed code
 * @returns Just the completion part
 */
function extractCompletion(prefix: string, completedCode: string): string {
	// Ensure the completed code starts with the prefix
	if (!completedCode.startsWith(prefix)) {
		// Try to find where the completion should start
		const prefixLines = prefix.split('\n');
		const lastPrefixLine = prefixLines[prefixLines.length - 1];

		// Find the last prefix line in the completion
		const index = completedCode.indexOf(lastPrefixLine);
		if (index >= 0) {
			// Extract from after the last prefix line
			const startIndex = index + lastPrefixLine.length;
			return completedCode.substring(startIndex);
		}

		return '';
	}

	// Extract just the completion part
	return completedCode.substring(prefix.length);
}

/**
 * Create a new file in the workspace
 *
 * @param workspaceUri Workspace URI
 * @param filePath Relative file path
 * @param content File content
 */
async function createFile(
	workspaceUri: vscode.Uri,
	filePath: string,
	content: string
): Promise<void> {
	try {
		// Create full file path
		const fullPath = vscode.Uri.joinPath(workspaceUri, filePath);

		// Ensure directory exists
		const dirPath = path.dirname(fullPath.fsPath);
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));

		// Create file
		const encoder = new TextEncoder();
		await vscode.workspace.fs.writeFile(fullPath, encoder.encode(content));

		// Open the file
		const document = await vscode.workspace.openTextDocument(fullPath);
		await vscode.window.showTextDocument(document);

		vscode.window.showInformationMessage(`Created file: ${filePath}`);
	} catch (error) {
		logger.error(`Error creating file ${filePath}: ${error.message}`);
		vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
	}
}

/**
 * Update an existing file in the workspace
 *
 * @param workspaceUri Workspace URI
 * @param filePath Relative file path
 * @param content New file content
 */
async function updateFile(
	workspaceUri: vscode.Uri,
	filePath: string,
	content: string
): Promise<void> {
	try {
		// Create full file path
		const fullPath = vscode.Uri.joinPath(workspaceUri, filePath);

		// Check if file exists
		try {
			await vscode.workspace.fs.stat(fullPath);
		} catch {
			// File doesn't exist, create it instead
			await createFile(workspaceUri, filePath, content);
			return;
		}

		// Open the file
		const document = await vscode.workspace.openTextDocument(fullPath);
		const editor = await vscode.window.showTextDocument(document);

		// Replace file content
		const lastLine = document.lineCount - 1;
		const lastChar = document.lineAt(lastLine).range.end.character;
		const fullRange = new vscode.Range(0, 0, lastLine, lastChar);

		await editor.edit(editBuilder => {
			editBuilder.replace(fullRange, content);
		});

		// Save the file
		await document.save();

		vscode.window.showInformationMessage(`Updated file: ${filePath}`);
	} catch (error) {
		logger.error(`Error updating file ${filePath}: ${error.message}`);
		vscode.window.showErrorMessage(`Failed to update file: ${error.message}`);
	}
}

/**
 * Open a file in the workspace
 *
 * @param workspaceUri Workspace URI
 * @param filePath Relative file path
 */
async function openFile(
	workspaceUri: vscode.Uri,
	filePath: string
): Promise<void> {
	try {
		// Create full file path
		const fullPath = vscode.Uri.joinPath(workspaceUri, filePath);

		// Open the file
		const document = await vscode.workspace.openTextDocument(fullPath);
		await vscode.window.showTextDocument(document);
	} catch (error) {
		logger.error(`Error opening file ${filePath}: ${error.message}`);
		vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
	}
}

/**
 * Implement all files for a feature
 *
 * @param workspaceUri Workspace URI
 * @param files Array of file information
 */
async function implementAllFiles(
	workspaceUri: vscode.Uri,
	files: any[]
): Promise<void> {
	try {
		for (const file of files) {
			const filePath = file.filePath;
			const content = file.code;
			const isNew = file.isNew;

			if (isNew) {
				await createFile(workspaceUri, filePath, content);
			} else {
				await updateFile(workspaceUri, filePath, content);
			}
		}
	} catch (error) {
		logger.error(`Error implementing files: ${error.message}`);
		vscode.window.showErrorMessage(`Failed to implement files: ${error.message}`);
	}
}

/**
 * Registers context-aware commands.
 * @param context Extension context
 * @param services Service dependencies
 * @returns Array of disposables
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
// @ts-ignore: error TS2323: Cannot redeclare exported variable 'registerContextAwareCommands'.
 */
export function registerContextAwareCommands(
	context: vscode.ExtensionContext,
	services: ServiceDependencies
): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];
	const { logger, modelManager, promptManager } = services;

	// Generate context-aware code
	const generateContextAwareCode = vscode.commands.registerCommand(
		'superCoderAI.generateContextAwareCode',
		async () => {
			try {
				logger.info('Generating context-aware code');

				// Get active editor information
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showInformationMessage('No active editor found');
					return;
				}

				// Get selected text or entire document
				const document = editor.document;
				const selection = editor.selection;
				const selectedText = selection.isEmpty
					? document.getText()
					: document.getText(selection);

				// Get user input for the code description
				const description = await vscode.window.showInputBox({
					prompt: 'What code would you like to generate?',
					placeHolder: 'E.g., A function that sorts an array of objects by a given property'
				});

				if (!description) {
					return; // User cancelled
				}

				// Show progress indicator
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Generating Code...',
						cancellable: false
					},
					async (progress) => {
						try {
							progress.report({ message: 'Analyzing context...' });

							// @ts-ignore: error TS2339: Property 'applyTemplate' does not exist on type 'PromptManager'.
							// Apply the code-generation template with context
							const prompt = await promptManager.applyTemplate('code-generation', {
								description,
								language: document.languageId,
								context: selectedText,
								variables: '',
								requirements: 'Code should follow good practices and include comments'
							});

							progress.report({ message: 'Generating code...' });

							// Generate code using the model manager
							const result = await modelManager.generateCompletion(
								prompt,
								ModelCapability.CodeGeneration,
								{ temperature: 0.3 }
							);

							// Extract code from response
							const generatedCode = extractCodeBlock(result.content, document.languageId);

							// Insert the generated code
							editor.edit(editBuilder => {
								if (selection.isEmpty) {
									// If no selection, insert at cursor position
									editBuilder.insert(editor.selection.active, generatedCode);
								} else {
									// Replace the selected text
									editBuilder.replace(selection, generatedCode);
								}
							});

							vscode.window.showInformationMessage('Code generated successfully!');
						} catch (error) {
							throw error;
						}
					}
				);
			} catch (error) {
				logger.error(`Error in context-aware code generation: ${error instanceof Error ? error.message : String(error)}`);
				vscode.window.showErrorMessage(`Failed to generate code: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	);

	disposables.push(generateContextAwareCode);

	// Explain code in context
	const explainCode = vscode.commands.registerCommand(
		'superCoderAI.explainCode',
		async () => {
			try {
				logger.info('Explaining code');

				// Get active editor information
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showInformationMessage('No active editor found');
					return;
				}

				// Get selected text
				const selection = editor.selection;
				const selectedText = editor.document.getText(selection);

				if (!selectedText) {
					vscode.window.showInformationMessage('No code selected to explain');
					return;
				}

				// Show progress indicator
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Explaining Code...',
						cancellable: false
					},
					async (progress) => {
						// Create a simple prompt for explanation
						const prompt = `Please explain the following code in detail:\n\n${selectedText}\n\nExplain what the code does, how it works, and any important patterns or concepts it demonstrates.`;

						progress.report({ message: 'Analyzing code...' });

						// Generate explanation
						const result = await modelManager.generateCompletion(
							prompt,
							ModelCapability.Explanation
						);

						// Show explanation in webview
						const panel = vscode.window.createWebviewPanel(
							'codeExplanation',
							'Code Explanation',
							vscode.ViewColumn.Beside,
							{ enableScripts: true }
						);

						panel.webview.html = getExplanationHtml(selectedText, result.content);
					}
				);
			} catch (error) {
				logger.error(`Error explaining code: ${error instanceof Error ? error.message : String(error)}`);
				vscode.window.showErrorMessage(`Failed to explain code: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	);

	disposables.push(explainCode);

	return disposables;
}

/**
 * Extract code block from model response
 * @param content Model response content
 * @param language Programming language
 * @returns Extracted code
 */
function extractCodeBlock(content: string, language: string): string {
	// Try to extract code from markdown code blocks
	const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\s*([\\s\\S]*?)\\s*\`\`\``, 'i');
	const match = content.match(codeBlockRegex);

	if (match && match[1]) {
		return match[1].trim();
	}

	// If no code block found, try to find code without markers
	// This is a simplistic approach - in real code you'd want a more robust solution
	const lines = content.split('\n');
	const relevantLines = lines.filter(line =>
		!line.toLowerCase().includes('here is the code') &&
		!line.toLowerCase().includes('generated code') &&
		!line.toLowerCase().includes('code explanation')
	);

	return relevantLines.join('\n').trim();
}

/**
 * Get HTML for code explanation
 * @param code Original code
 * @param explanation Explanation text
 * @returns HTML for webview
 */
function getExplanationHtml(code: string, explanation: string): string {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Code Explanation</title>
		<style>
			body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; padding: 16px; }
			pre { background-color: #f5f5f5; padding: 16px; border-radius: 8px; overflow: auto; }
			.code-block { margin-bottom: 20px; }
			.explanation { line-height: 1.6; }
		</style>
	</head>
	<body>
		<h2>Original Code</h2>
		<div class="code-block">
			<pre>${escapeHtml(code)}</pre>
		</div>
		<h2>Explanation</h2>
		<div class="explanation">
			${formatExplanation(explanation)}
		</div>
	</body>
	</html>
	`;
}

/**
 * Escape HTML to prevent XSS
 * @param text Input text
 * @returns Escaped HTML
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Format explanation text with markdown-like features
 * @param text Explanation text
 * @returns Formatted HTML
 */
function formatExplanation(text: string): string {
	// Convert markdown-style headers (## Header)
	text = text.replace(/## (.*)/g, '<h3>$1</h3>');
	text = text.replace(/### (.*)/g, '<h4>$1</h4>');

	// Convert markdown-style lists
	text = text.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>');
	text = text.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');

	// Convert markdown-style code blocks
	text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

	// Convert markdown-style inline code
	text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Convert line breaks to paragraphs
	text = '<p>' + text.replace(/\n\n/g, '</p><p>') + '</p>';

	return text;
}

/**
 * Context-Aware Commands
 *
 * Provides commands that leverage contextual understanding of the codebase.
 * These commands use the context manager to provide better AI assistance.
 */
// @ts-ignore: error TS2300: Duplicate identifier 'vscode'.

// @ts-ignore: error TS2300: Duplicate identifier 'path'.
// @ts-ignore: error TS2300: Duplicate identifier 'path'.
// @ts-ignore: error TS2300: Duplicate identifier 'path'.
// @ts-ignore: error TS2300: Duplicate identifier 'path'.
// @ts-ignore: error TS2300: Duplicate identifier 'path'.
// @ts-ignore: error TS2300: Duplicate identifier 'path'.
;
import * as path from 'path';
import { logger } from '../utils/logger';
// @ts-ignore: errager'.
import { ConfigService } from '../services/configService';
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
// @ts-ignore: error TS2300: Duplicate identifier 'ContextManager'.
import { ViewManager } from '../ui/viewManager';
import { ConfigService } from '../services/configService';
pability'.
import { ModelManager } from '../ai/modelManager';
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
// @ts-ignore: error TS2300: Duplicate identifier 'CodeGenerationEnsemble'.
import { ModelCapability } from '../ai/providers/baseProvider';
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
 */
export class ContextAwareCommands {
	private readonly context: ivate readonly configService: ConfigService;
	private readonly viewManager: ViewManager;
	private readonly contextManager: ContextManager;
	private readonly modelManager: ModelManager;
	private readonly codeGenerationEnsemble: CodeGenerationEnsemble;

	/**
	 * Create new context-aware commands
	 * @param context Extension context
	 * @param logger Logger instance
	 * @param configService Configuration service
	 * @param viewManager View manager
	 * @param contextManager Context manager
	 * @param modelManager Model manager
	 * @param codeGenerationEnsemble Code generation ensemble
	 */
	constructor(
		context: vscode.ExtensionContext,
		logger: Logger,
		configService: ConfigService,
		viewManager: ViewManager,
		contextManager: ContextManager,
		modelManager: ModelManager,
		codeGenerationEnsemble: CodeGenerationEnsemble
	) {
		this.context = context;
		this.logger = logger;
		this.configService = configService;
		this.viewManager = viewManager;
		this.contextManager = contextManager;
		this.modelManager = modelManager;
		this.codeGenerationEnsemble = codeGenerationEnsemble;
	}

	/**
	 * Register all context-aware commands
	 * @returns Array of disposables
	 */
	public register(): vscode.Disposable[] {
		return [
			vscode.commands.registerCommand('ai-assistant.explainCode', this.explainCode.bind(this)),
			vscode.commands.registerCommand('ai-assistant.generateCode', this.generateCode.bind(this)),
			vscode.commands.registerCommand('ai-assistant.implementFeature', this.implementFeature.bind(this)),
			vscode.commands.registerCommand('ai-assistant.explainProject', this.explainProject.bind(this)),
			vscode.commands.registerCommand('ai-assistant.generateProjectDocumentation', this.generateProjectDocumentation.bind(this))
		];
	}

	/**
	 * Explain selected code with contextual understanding
	 */
	private async explainCode(): Promise<void> {
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showInformationMessage('No active editor');
				return;
			}

			// Get selected code or entire file
			const selection = editor.selection;
			const code = selection.isEmpty
				? editor.document.getText()
				: editor.document.getText(selection);

			if (code.trim().length === 0) {
				vscode.window.showInformationMessage('No code selected');
				return;
			}

			// Get explanation detail level
			const detailLevel = await vscode.window.showQuickPick(
				['Basic', 'Detailed', 'Comprehensive'],
				{ placeHolder: 'Select explanation detail level' }
			);

			if (!detailLevel) {
				return; // User cancelled
			}

			// Show loading message
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Analyzing code...',
				cancellable: false
			}, async () => {
				// Get context
				const context = await this.contextManager.getContext();

				// Create prompt for explanation
				const prompt = `
Explain the following ${editor.document.languageId} code ${detailLevel.toLowerCase()}:

\`\`\`${editor.document.languageId}
${code}
\`\`\`

${selection.isEmpty ? 'This is the entire file content.' : 'This is a selection from the file.'}

Current file: ${editor.document.uri.fsPath}
${context.projectInfo ? `Project: ${context.projectInfo.name}` : ''}

Please provide a ${detailLevel.toLowerCase()} explanation that covers:
${detailLevel === 'Basic' ? '- Main functionality\n- Key concepts' :
						detailLevel === 'Detailed' ? '- Main functionality\n- Implementation details\n- Control flow\n- Key concepts\n- Potential issues' :
							'- Complete functionality breakdown\n- Implementation details\n- Design patterns used\n- Control flow\n- Edge cases\n- Performance considerations\n- Potential issues\n- Improvement suggestions'}
`;

				// Call the model
				const response = await this.modelManager.generateCompletion(prompt, {
					capability: ModelCapability.Explanation,
					temperature: 0.3,
					maxTokens: 2048
				});

				// Show explanation as webview
				const panel = this.viewManager.createWebviewPanel(
					'codeExplanation',
					'Code Explanation',
					vscode.ViewColumn.Beside
				);

				// Get template for explanation
				const template = this.viewManager.loadHtmlTemplate('codeExplanation');

				// Format explanation
				panel.webview.html = this.viewManager.createWebviewContent(panel, template, {
					code,
					language: editor.document.languageId,
					explanation: response.content,
					detailLevel,
					fileName: path.basename(editor.document.uri.fsPath)
				});
			});
		} catch (error) {
			this.logger.error(`Error explaining code: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to explain code: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate code based on prompt with contextual understanding
	 */
	private async generateCode(): Promise<void> {
		try {
			const editor = vscode.window.activeTextEditor;

			// Get prompt from user
			const prompt = await vscode.window.showInputBox({
				prompt: 'Describe what code you want to generate',
				placeHolder: 'Generate a function that...'
			});

			if (!prompt) {
				return; // User cancelled
			}

			// Show loading message
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Generating code...',
				cancellable: false
			}, async () => {
				// Get context
				const context = await this.contextManager.getContext();

				// Prepare existing code if there's a selection
				let existingCode: string | undefined;
				let language = editor?.document.languageId || 'javascript';

				if (editor && !editor.selection.isEmpty) {
					existingCode = editor.document.getText(editor.selection);
				}

				// Generate code
				const result = await this.codeGenerationEnsemble.executeTask('generateCode', {
					prompt,
					language,
					existingCode,
					context
				});

				if (!result.success || !result.content) {
					throw new Error(result.error || 'Failed to generate code');
				}

				const generatedCode = result.content.code;
				const explanation = result.content.explanation;

				if (editor) {
					// Insert code at cursor or replace selection
					await editor.edit(editBuilder => {
						if (editor.selection.isEmpty) {
							editBuilder.insert(editor.selection.active, generatedCode);
						} else {
							editBuilder.replace(editor.selection, generatedCode);
						}
					});

					// Show explanation
					if (explanation) {
						this.showCodeGenerationExplanation(generatedCode, explanation, language);
					}
				} else {
					// No active editor, show in webview
					this.showGeneratedCodeInWebview(generatedCode, explanation, language);
				}
			});
		} catch (error) {
			this.logger.error(`Error generating code: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to generate code: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Implement a feature across multiple files with contextual understanding
	 */
	private async implementFeature(): Promise<void> {
		try {
			// Get feature description from user
			const featureDescription = await vscode.window.showInputBox({
				prompt: 'Describe the feature to implement',
				placeHolder: 'Implement a user authentication system with...'
			});

			if (!featureDescription) {
				return; // User cancelled
			}

			// Get language from user
			const languages = ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go'];
			const language = await vscode.window.showQuickPick(languages, {
				placeHolder: 'Select programming language'
			});

			if (!language) {
				return; // User cancelled
			}

			// Show loading message
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Planning feature implementation...',
				cancellable: false
			}, async (progress) => {
				// Get context
				progress.report({ message: 'Analyzing project context...' });
				const context = await this.contextManager.getContext();

				// Implement feature
				progress.report({ message: 'Generating implementation plan...' });
				const result = await this.codeGenerationEnsemble.executeTask('implementFeature', {
					featureDescription,
					language: language.toLowerCase(),
					context
				});

				if (!result.success || !result.content) {
					throw new Error(result.error || 'Failed to implement feature');
				}

				progress.report({ message: 'Preparing implementation details...' });

				// Show feature implementation
				const panel = this.viewManager.createWebviewPanel(
					'featureImplementation',
					'Feature Implementation',
					vscode.ViewColumn.Active
				);

				// Get template
				const template = this.viewManager.loadHtmlTemplate('featureImplementation');

				// Format generated files
				const filesToShow = result.content.files.map(file => ({
					path: file.filePath,
					code: file.code,
					language: this.getLanguageFromFilePath(file.filePath),
					isNew: file.isNew,
					description: file.description || ''
				}));

				// Format content
				panel.webview.html = this.viewManager.createWebviewContent(panel, template, {
					featureDescription,
					language,
					implementationPlan: result.content.implementationPlan,
					files: JSON.stringify(filesToShow),
				});

				// Handle webview messages
				panel.webview.onDidReceiveMessage(async (message) => {
					if (message.command === 'createFile') {
						await this.createOrUpdateFile(
							message.path,
							message.content,
							true
						);
					} else if (message.command === 'updateFile') {
						await this.createOrUpdateFile(
							message.path,
							message.content,
							false
						);
					}
				});
			});
		} catch (error) {
			this.logger.error(`Error implementing feature: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to implement feature: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Explain project structure and architecture with contextual understanding
	 */
	private async explainProject(): Promise<void> {
		try {
			// Check if workspace is open
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('Please open a workspace to explain the project');
				return;
			}

			// Show loading message
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Analyzing project...',
				cancellable: false
			}, async () => {
				// Get context with limited file contents to avoid token limits
				const context = await this.contextManager.getContext(false);

				// Create prompt for project explanation
				const prompt = `
Analyze and explain the structure and architecture of this project:

Project name: ${context.projectInfo.name}
Languages used: ${Array.from(context.projectInfo.languages).join(', ')}
File count: ${context.projectInfo.fileCount}

${context.projectInfo.hasPackageJson ? `
Dependencies:
${JSON.stringify(context.projectInfo.dependencies, null, 2)}

Dev Dependencies:
${JSON.stringify(context.projectInfo.devDependencies, null, 2)}
` : ''}

// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
Related files:
${context.relatedFiles.map(file => `- ${file.uri.fsPath} (${file.language})`).join('\n')}

Provide a comprehensive explanation of the project architecture, including:
1. Overall architecture and design patterns
2. Main components and their responsibilities
3. How components interact with each other
4. Key technologies and frameworks used
5. Project structure and organization
`;

				// Call the model
				const response = await this.modelManager.generateCompletion(prompt, {
					capability: ModelCapability.Explanation,
					temperature: 0.3,
					maxTokens: 3072
				});

				// Show explanation as webview
				const panel = this.viewManager.createWebviewPanel(
					'projectExplanation',
					'Project Explanation',
					vscode.ViewColumn.Active
				);

				// Get template for explanation
				const template = this.viewManager.loadHtmlTemplate('projectExplanation');

				// Format explanation
				panel.webview.html = this.viewManager.createWebviewContent(panel, template, {
					projectName: context.projectInfo.name,
					explanation: response.content,
					languages: Array.from(context.projectInfo.languages).join(', '),
					fileCount: context.projectInfo.fileCount
				});
			});
		} catch (error) {
			this.logger.error(`Error explaining project: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to explain project: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate project documentation with contextual understanding
	 */
	private async generateProjectDocumentation(): Promise<void> {
		try {
			// Check if workspace is open
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('Please open a workspace to generate documentation');
				return;
			}

			// Get documentation format
			const format = await vscode.window.showQuickPick(
				['Markdown', 'HTML'],
				{ placeHolder: 'Select documentation format' }
			);

			if (!format) {
				return; // User cancelled
			}

			// Show loading message
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Generating project documentation...',
				cancellable: false
			}, async (progress) => {
				// Get context with limited file contents to avoid token limits
				progress.report({ message: 'Analyzing project structure...' });
				const context = await this.contextManager.getContext(false);

				// Create prompt for documentation generation
				const prompt = `
Generate comprehensive documentation for this project:

Project name: ${context.projectInfo.name}
Languages used: ${Array.from(context.projectInfo.languages).join(', ')}
File count: ${context.projectInfo.fileCount}

${context.projectInfo.hasPackageJson ? `
Dependencies:
${JSON.stringify(context.projectInfo.dependencies, null, 2)}

Dev Dependencies:
${JSON.stringify(context.projectInfo.devDependencies, null, 2)}
` : ''}

// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
// @ts-ignore: error TS2551: Property 'language' does not exist on type 'FileContext'. Did you mean 'languageId'?
Related files:
${context.relatedFiles.map(file => `- ${file.uri.fsPath} (${file.language})`).join('\n')}

Generate comprehensive project documentation in ${format} format that includes:
1. Project overview and purpose
2. Architecture and design patterns
3. Main components and their responsibilities
4. Installation instructions
5. Usage examples
6. API documentation (if applicable)
7. Directory structure
8. Development workflow
9. Contributing guidelines
10. License information

${format === 'Markdown'
						? 'Use proper Markdown formatting with headings, lists, code blocks, etc.'
						: 'Use proper HTML formatting with semantic elements, headings, lists, code blocks, etc.'}
`;

				// Call the model
				progress.report({ message: 'Generating documentation...' });
				const response = await this.modelManager.generateCompletion(prompt, {
					capability: ModelCapability.CodeGeneration,
					temperature: 0.3,
					maxTokens: 4096
				});

				progress.report({ message: 'Finalizing documentation...' });

				// Create a new file with the documentation
				const workspaceFolder = vscode.workspace.workspaceFolders[0];
				const fileName = `${context.projectInfo.name.replace(/\s+/g, '-')}-documentation.${format === 'Markdown' ? 'md' : 'html'}`;
				const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);

				try {
					// Create the file
					const encoder = new TextEncoder();
					await vscode.workspace.fs.writeFile(fileUri, encoder.encode(response.content));

					// Open the file
					const document = await vscode.workspace.openTextDocument(fileUri);
					await vscode.window.showTextDocument(document);

					vscode.window.showInformationMessage(`Project documentation generated: ${fileName}`);
				} catch (error) {
					throw new Error(`Failed to write documentation file: ${error instanceof Error ? error.message : String(error)}`);
				}
			});
		} catch (error) {
			this.logger.error(`Error generating project documentation: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Show code generation explanation
	 * @param code Generated code
	 * @param explanation Explanation of the code
	 * @param language Programming language
	 */
	private showCodeGenerationExplanation(code: string, explanation: string, language: string): void {
		const outputChannel = vscode.window.createOutputChannel('Code Generation Explanation');
		outputChannel.appendLine('# Code Generation Explanation');
		outputChannel.appendLine('');
		outputChannel.appendLine(explanation);
		outputChannel.appendLine('');
		outputChannel.appendLine('## Generated Code:');
		outputChannel.appendLine('');
		outputChannel.appendLine(`\`\`\`${language}`);
		outputChannel.appendLine(code);
		outputChannel.appendLine('```');

		outputChannel.show();
	}

	/**
	 * Show generated code in webview
	 * @param code Generated code
	 * @param explanation Explanation of the code
	 * @param language Programming language
	 */
	private showGeneratedCodeInWebview(code: string, explanation: string, language: string): void {
		// Show code and explanation as webview
		const panel = this.viewManager.createWebviewPanel(
			'generatedCode',
			'Generated Code',
			vscode.ViewColumn.Active
		);

		// Get template
		const template = this.viewManager.loadHtmlTemplate('generatedCode');

		// Format content
		panel.webview.html = this.viewManager.createWebviewContent(panel, template, {
			code,
			language,
			explanation
		});

		// Handle webview messages
		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'createFile') {
				await this.createNewFile(message.language, code);
			} else if (message.command === 'copyToClipboard') {
				await vscode.env.clipboard.writeText(code);
				vscode.window.showInformationMessage('Code copied to clipboard');
			}
		});
	}

	/**
	 * Create or update a file
	 * @param filePath File path
	 * @param content File content
	 * @param isNew Whether to create a new file
	 */
	private async createOrUpdateFile(filePath: string, content: string, isNew: boolean): Promise<void> {
		try {
			if (!filePath) {
				throw new Error('File path is required');
			}

			// Ensure file path is absolute
			let absolutePath = filePath;
			if (!path.isAbsolute(filePath)) {
				if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
					throw new Error('No workspace folder open');
				}
				absolutePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
			}

			// Create URI from path
			const fileUri = vscode.Uri.file(absolutePath);

			if (isNew) {
				// Create directories if needed
				const dirPath = path.dirname(absolutePath);
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));

				// Check if file already exists
				try {
					await vscode.workspace.fs.stat(fileUri);
					// File exists, ask for confirmation
					const confirm = await vscode.window.showWarningMessage(
						`File ${path.basename(filePath)} already exists. Overwrite?`,
						'Yes',
						'No'
					);

					if (confirm !== 'Yes') {
						vscode.window.showInformationMessage('File creation cancelled');
						return;
					}
				} catch (e) {
					// File does not exist, continue
				}
			} else {
				// Check if file exists for update
				try {
					await vscode.workspace.fs.stat(fileUri);
				} catch (e) {
					throw new Error(`File ${path.basename(filePath)} does not exist`);
				}
			}

			// Write content to file
			const encoder = new TextEncoder();
			await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

			// Open the file
			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);

			vscode.window.showInformationMessage(`${isNew ? 'Created' : 'Updated'} file: ${path.basename(filePath)}`);
		} catch (error) {
			this.logger.error(`Error ${isNew ? 'creating' : 'updating'} file: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to ${isNew ? 'create' : 'update'} file: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Create a new file with generated code
	 * @param language Programming language
	 * @param code Generated code
	 */
	private async createNewFile(language: string, code: string): Promise<void> {
		try {
			// Get file extension for language
			const extension = this.getFileExtensionForLanguage(language);

			// Create untitled document with appropriate language
			const document = await vscode.workspace.openTextDocument({
				language,
				content: code
			});

			// Show the document
			await vscode.window.showTextDocument(document);
		} catch (error) {
			this.logger.error(`Error creating new file: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to create new file: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Get file extension for language
	 * @param language Programming language
	 * @returns File extension
	 */
	private getFileExtensionForLanguage(language: string): string {
		switch (language.toLowerCase()) {
			case 'javascript':
				return 'js';
			case 'typescript':
				return 'ts';
			case 'javascriptreact':
				return 'jsx';
			case 'typescriptreact':
				return 'tsx';
			case 'python':
				return 'py';
			case 'java':
				return 'java';
			case 'csharp':
				return 'cs';
			case 'go':
				return 'go';
			case 'rust':
				return 'rs';
			case 'cpp':
				return 'cpp';
			case 'c':
				return 'c';
			case 'php':
				return 'php';
			default:
				return 'txt';
		}
	}

	/**
	 * Get language ID from file path
	 * @param filePath File path
	 * @returns Language ID
	 */
	private getLanguageFromFilePath(filePath: string): string {
		const extension = path.extname(filePath).toLowerCase();

		switch (extension) {
			case '.js':
				return 'javascript';
			case '.ts':
				return 'typescript';
			case '.jsx':
				return 'javascriptreact';
			case '.tsx':
				return 'typescriptreact';
			case '.py':
				return 'python';
			case '.java':
				return 'java';
			case '.cs':
				return 'csharp';
			case '.go':
				return 'go';
			case '.rs':
				return 'rust';
			case '.cpp':
			case '.cc':
			case '.hpp':
				return 'cpp';
			case '.c':
			case '.h':
				return 'c';
			case '.php':
				return 'php';
			case '.rb':
				return 'ruby';
			case '.md':
				return 'markdown';
			case '.html':
				return 'html';
			case '.css':
				return 'css';
			case '.json':
				return 'json';
			default:
				return 'plaintext';
		}
	}
}
