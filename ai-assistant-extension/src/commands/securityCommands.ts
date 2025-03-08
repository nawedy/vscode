/**
 * Security Commands for SuperCoderAI VSCode Extension
 *
 * This file implements command handlers for security-related operations
 * such as security scanning, vulnerability detection, and remediation. These
 * commands leverage the SecurityEnsemble and SecurityScanner to provide
 * comprehensive security analysis with privacy-first controls.
 *
 * Key features:
 * - Code security scanning
 * - Vulnerability remediation
 * - Security best practices recommendations
 * - Framework-specific security analysis
 * - Security report generation
 *
 * File path: src/commands/securityCommands.ts
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
// @ts-ignore: error TS2306: File '/Users/drgn003/vscode-fork/vscode/ai-assistant-extension/src/security/securityScanner.ts' is not a module.
import { SecurityEnsemble } from '../ai/ensemble/securityEnsemble';
import { SecurityScanner, RiskLevel } from '../security/securityScanner';
import { ViewManager } from '../ui/viewManager';
import { logger } from '../utils/logger';
import { ServiceDependencies } from './index';
import { ModelCapability } from '../ai/providers/baseProvider';
;
import { ApiKeyManager } from '../security/apiKeyManager';

/**
 * Security scan result structure
 */
interface SecurityScanResult {
	id: string;
	type: string;
	description: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	location: {
		file: string;
		line?: number;
		column?: number;
	};
	recommendation?: string;
}

/**
 * Register all security commands
 *
 * @param context Extension context
 * @param securityEnsemble Security ensemble
 * @param securityScanner Security scanner
 * @param viewManager View manager
 * @returns Array of disposable command registrations
 */
export function registerSecurityCommands(
	context: vscode.ExtensionContext,
	securityEnsemble: SecurityEnsemble,
	securityScanner: SecurityScanner,
	viewManager: ViewManager
): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];

	// Scan code for security issues command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.scanCodeSecurity',
			() => handleScanCodeSecurity(securityScanner, securityEnsemble, viewManager)
		)
	);

	// Fix security issues command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.fixSecurityIssues',
			() => handleFixSecurityIssues(securityScanner, securityEnsemble, viewManager)
		)
	);

	// Security report command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.generateSecurityReport',
			() => handleGenerateSecurityReport(securityScanner, securityEnsemble, viewManager)
		)
	);

	// Security best practices command
	disposables.push(
		vscode.commands.registerCommand(
			'supercoderAI.securityBestPractices',
			() => handleSecurityBestPractices(securityScanner, securityEnsemble, viewManager)
		)
	);

	logger.info('Security commands registered');

	return disposables;
}

/**
 * Handle scan code for security issues command
 *
 * @param securityScanner Security scanner
 * @param securityEnsemble Security ensemble
 * @param viewManager View manager
 */
async function handleScanCodeSecurity(
	securityScanner: SecurityScanner,
	securityEnsemble: SecurityEnsemble,
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
		let codeToScan: string;

		if (!editor.selection.isEmpty) {
			codeToScan = document.getText(editor.selection);
		} else {
			codeToScan = document.getText();
		}

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Scanning code for security issues...',
				cancellable: false
			},
			async (progress) => {
				// Scan code
				progress.report({ message: 'Analyzing security...' });

				const scanResult = await securityScanner.scanCode(codeToScan, language);

				// Show results
				progress.report({ message: 'Preparing results...' });

				if (scanResult) {
					// Create webview to show security issues
					const panel = viewManager.createWebviewPanel(
						'securityScan',
						'Security Scan Results',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load security scan template
					const template = viewManager.loadHtmlTemplate('securityScan');

					// Highlight risk level with color
					const riskLevelColor = getRiskLevelColor(scanResult.riskLevel);

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Security Scan Results',
						code: codeToScan,
						language,
						issues: JSON.stringify(scanResult.issues),
						summary: scanResult.summary,
						riskLevel: scanResult.riskLevel,
						riskLevelColor,
						fileName: path.basename(document.fileName),
						scanTime: scanResult.scanTime
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'fixSecurityIssues') {
							// Fix security issues
							await handleFixSpecificSecurityIssues(
								securityEnsemble,
								viewManager,
								document,
								scanResult.issues
							);
						} else if (message.command === 'highlightIssue') {
							// Highlight the issue in the editor
							highlightIssueInEditor(editor, message.data.startLine, message.data.endLine);
						}
					});

					// Show notification based on risk level
					showRiskLevelNotification(scanResult.riskLevel);
				} else {
					vscode.window.showErrorMessage('Failed to scan code for security issues');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in scanCodeSecurity command: ${error.message}`);
		vscode.window.showErrorMessage(`Security scan failed: ${error.message}`);
	}
}

/**
 * Handle fix security issues command
 *
 * @param securityScanner Security scanner
 * @param securityEnsemble Security ensemble
 * @param viewManager View manager
 */
async function handleFixSecurityIssues(
	securityScanner: SecurityScanner,
	securityEnsemble: SecurityEnsemble,
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
		let codeToFix: string;
		let selection: vscode.Selection;

		if (!editor.selection.isEmpty) {
			codeToFix = document.getText(editor.selection);
			selection = editor.selection;
		} else {
			codeToFix = document.getText();
			selection = new vscode.Selection(
				0, 0,
				document.lineCount - 1,
				document.lineAt(document.lineCount - 1).range.end.character
			);
		}

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Fixing security issues...',
				cancellable: false
			},
			async (progress) => {
				// First scan the code
				progress.report({ message: 'Scanning code for security issues...' });

				const scanResult = await securityScanner.scanCode(codeToFix, language);

				if (!scanResult || scanResult.issues.length === 0) {
					vscode.window.showInformationMessage('No security issues found to fix');
					return;
				}

				// Fix the issues
				progress.report({ message: 'Fixing security issues...' });

				const result = await securityEnsemble.executeTask('implementSecurityFixes', {
					originalCode: codeToFix,
					recommendations: {
						issues: scanResult.issues,
						description: scanResult.summary
					},
					language
				});

				// Apply fixes
				progress.report({ message: 'Applying security fixes...' });

				if (result && result.content && result.content.fixedCode) {
					const fixedCode = result.content.fixedCode;

					// Create webview to show diff and confirm changes
					const panel = viewManager.createWebviewPanel(
						'securityFixes',
						'Security Fixes',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load diff view template
					const template = viewManager.loadHtmlTemplate('diffView');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Security Fixes',
						originalCode: codeToFix,
						newCode: fixedCode,
						language,
						explanation: result.content.verification || 'Security issues have been fixed automatically.',
						issues: JSON.stringify(scanResult.issues)
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'applyChanges') {
							// Apply the fixed code
							await editor.edit(editBuilder => {
								editBuilder.replace(selection, fixedCode);
							});

							// Close the panel
							panel.dispose();

							// Show success message
							vscode.window.showInformationMessage('Security issues fixed successfully');
						} else if (message.command === 'cancelChanges') {
							// Close the panel
							panel.dispose();

							// Show cancelled message
							vscode.window.showInformationMessage('Security fixes cancelled');
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to fix security issues');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in fixSecurityIssues command: ${error.message}`);
		vscode.window.showErrorMessage(`Security fix failed: ${error.message}`);
	}
}

/**
 * Handle fix specific security issues command
 *
 * @param securityEnsemble Security ensemble
 * @param viewManager View manager
 * @param document Current document
 * @param issues Security issues to fix
 */
async function handleFixSpecificSecurityIssues(
	securityEnsemble: SecurityEnsemble,
	viewManager: ViewManager,
	document: vscode.TextDocument,
	issues: any[]
): Promise<void> {
	try {
		// Get editor for this document
		const editor = await vscode.window.showTextDocument(document);
		const language = document.languageId;

		// Get document text
		const codeToFix = document.getText();
		const selection = new vscode.Selection(
			0, 0,
			document.lineCount - 1,
			document.lineAt(document.lineCount - 1).range.end.character
		);

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Fixing selected security issues...',
				cancellable: false
			},
			async (progress) => {
				// Fix the issues
				progress.report({ message: 'Fixing security issues...' });

				const result = await securityEnsemble.executeTask('implementSecurityFixes', {
					originalCode: codeToFix,
					recommendations: {
						issues,
						description: `Fixing ${issues.length} security issues`
					},
					language
				});

				// Apply fixes
				progress.report({ message: 'Applying security fixes...' });

				if (result && result.content && result.content.fixedCode) {
					const fixedCode = result.content.fixedCode;

					// Create webview to show diff and confirm changes
					const panel = viewManager.createWebviewPanel(
						'securityFixes',
						'Security Fixes',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load diff view template
					const template = viewManager.loadHtmlTemplate('diffView');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Security Fixes',
						originalCode: codeToFix,
						newCode: fixedCode,
						language,
						explanation: result.content.verification || 'Security issues have been fixed automatically.',
						issues: JSON.stringify(issues)
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'applyChanges') {
							// Apply the fixed code
							await editor.edit(editBuilder => {
								editBuilder.replace(selection, fixedCode);
							});

							// Close the panel
							panel.dispose();

							// Show success message
							vscode.window.showInformationMessage('Security issues fixed successfully');
						} else if (message.command === 'cancelChanges') {
							// Close the panel
							panel.dispose();

							// Show cancelled message
							vscode.window.showInformationMessage('Security fixes cancelled');
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to fix security issues');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in fixSpecificSecurityIssues: ${error.message}`);
		vscode.window.showErrorMessage(`Security fix failed: ${error.message}`);
	}
}

/**
 * Handle generate security report command
 *
 * @param securityScanner Security scanner
 * @param securityEnsemble Security ensemble
 * @param viewManager View manager
 */
async function handleGenerateSecurityReport(
	securityScanner: SecurityScanner,
	securityEnsemble: SecurityEnsemble,
	viewManager: ViewManager
): Promise<void> {
	try {
		// Check if workspace is open
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('Please open a workspace to generate a security report');
			return;
		}

		// Ask for files to include
		const includeOptions = await vscode.window.showQuickPick(
			[
				'Scan current file',
				'Scan open files',
				'Scan entire project'
			],
			{
				placeHolder: 'Select files to include in security report'
			}
		);

		if (!includeOptions) {
			return; // User cancelled
		}

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Generating security report...',
				cancellable: false
			},
			async (progress) => {
				// Collect files to scan
				progress.report({ message: 'Collecting files...' });

				const filesToScan = await collectFilesToScan(includeOptions);

				if (filesToScan.length === 0) {
					vscode.window.showInformationMessage('No files found to scan');
					return;
				}

				// Scan files
				progress.report({ message: `Scanning ${filesToScan.length} files...` });

				const scanResults = [];
				let totalIssues = 0;
				let highestRiskLevel = RiskLevel.SECURE;

				for (let i = 0; i < filesToScan.length; i++) {
					const file = filesToScan[i];

					progress.report({
						message: `Scanning file ${i + 1}/${filesToScan.length}: ${path.basename(file.uri.fsPath)}`,
						increment: (100 / filesToScan.length)
					});

					const result = await securityScanner.scanCode(
						file.content,
						file.language
					);

					if (result) {
						result.filePath = file.uri.fsPath;
						scanResults.push(result);

						totalIssues += result.issues.length;

						// Update highest risk level
						if (getRiskLevelScore(result.riskLevel) > getRiskLevelScore(highestRiskLevel)) {
							highestRiskLevel = result.riskLevel;
						}
					}
				}

				// Generate report
				progress.report({ message: 'Generating report...' });

				// Create webview to show report
				const panel = viewManager.createWebviewPanel(
					'securityReport',
					'Security Report',
					vscode.ViewColumn.Active,
					{ enableScripts: true }
				);

				// Load security report template
				const template = viewManager.loadHtmlTemplate('securityReport');

				// Create content
				panel.webview.html = viewManager.createWebviewContent(panel, template, {
					title: 'Security Report',
					scanResults: JSON.stringify(scanResults),
					totalFiles: filesToScan.length,
					totalIssues,
					highestRiskLevel,
					riskLevelColor: getRiskLevelColor(highestRiskLevel),
					workspaceName: vscode.workspace.name || 'Workspace',
					timestamp: new Date().toISOString()
				});

				// Handle webview messages
				panel.webview.onDidReceiveMessage(async (message) => {
					if (message.command === 'openFile') {
						// Open the file
						const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.data.filePath));
						await vscode.window.showTextDocument(document);
					} else if (message.command === 'fixIssuesInFile') {
						// Fix issues in specific file
						const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.data.filePath));
						await handleFixSpecificSecurityIssues(
							securityEnsemble,
							viewManager,
							document,
							message.data.issues
						);
					} else if (message.command === 'exportReport') {
						// Export report to file
						await exportSecurityReport(
							scanResults,
							totalIssues,
							highestRiskLevel,
							message.data.format || 'markdown'
						);
					}
				});
			}
		);
	} catch (error) {
		logger.error(`Error in generateSecurityReport command: ${error.message}`);
		vscode.window.showErrorMessage(`Security report generation failed: ${error.message}`);
	}
}

/**
 * Handle security best practices command
 *
 * @param securityScanner Security scanner
 * @param securityEnsemble Security ensemble
 * @param viewManager View manager
 */
async function handleSecurityBestPractices(
	securityScanner: SecurityScanner,
	securityEnsemble: SecurityEnsemble,
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

		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Generating security best practices...',
				cancellable: false
			},
			async (progress) => {
				// Get security best practices
				progress.report({ message: 'Analyzing code...' });

				const result = await securityEnsemble.executeTask('securityBestPractices', {
					language,
					code: document.getText(),
					filePath: document.fileName
				});

				// Show best practices
				progress.report({ message: 'Preparing results...' });

				if (result && result.content && result.content.bestPractices) {
					const bestPractices = result.content.bestPractices;
					const frameworks = result.content.detectedFrameworks || [];

					// Create webview to show best practices
					const panel = viewManager.createWebviewPanel(
						'securityBestPractices',
						'Security Best Practices',
						vscode.ViewColumn.Beside,
						{ enableScripts: true }
					);

					// Load best practices template
					const template = viewManager.loadHtmlTemplate('securityBestPractices');

					// Create content
					panel.webview.html = viewManager.createWebviewContent(panel, template, {
						title: 'Security Best Practices',
						language,
						frameworks: JSON.stringify(frameworks),
						bestPractices: JSON.stringify(bestPractices),
						fileName: path.basename(document.fileName)
					});

					// Handle webview messages
					panel.webview.onDidReceiveMessage(async (message) => {
						if (message.command === 'applyPractice') {
							// Apply the best practice
							const practice = message.data.practice;

							if (practice.codeSnippet) {
								// Insert code snippet at cursor position
								const position = editor.selection.active;

								await editor.edit(editBuilder => {
									editBuilder.insert(position, practice.codeSnippet);
								});

								// Show success message
								vscode.window.showInformationMessage('Code snippet inserted successfully');
							}
						}
					});
				} else {
					vscode.window.showErrorMessage('Failed to generate security best practices');
				}
			}
		);
	} catch (error) {
		logger.error(`Error in securityBestPractices command: ${error.message}`);
		vscode.window.showErrorMessage(`Security best practices failed: ${error.message}`);
	}
}

/**
 * Collect files to scan based on user selection
 *
 * @param includeOption User-selected option for files to include
 * @returns Array of file information
 */
async function collectFilesToScan(includeOption: string): Promise<Array<{
	uri: vscode.Uri;
	content: string;
	language: string;
}>> {
	const filesToScan = [];

	try {
		if (includeOption === 'Scan current file') {
			// Add only the current file
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				filesToScan.push({
					uri: editor.document.uri,
					content: editor.document.getText(),
					language: editor.document.languageId
				});
			}
		} else if (includeOption === 'Scan open files') {
			// Add all open files
			for (const document of vscode.workspace.textDocuments) {
				// Skip non-file documents (e.g., output panels)
				if (document.uri.scheme !== 'file') {
					continue;
				}

				filesToScan.push({
					uri: document.uri,
					content: document.getText(),
					language: document.languageId
				});
			}
		} else if (includeOption === 'Scan entire project') {
			// Add files from the workspace (with limits)
			const workspaceFolder = vscode.workspace.workspaceFolders![0];

			// Find files matching patterns
			const includePatterns = [
				'**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx',
				'**/*.py', '**/*.java', '**/*.go', '**/*.rb',
				'**/*.php', '**/*.c', '**/*.cpp', '**/*.cs'
			];

			const excludePatterns = [
				'**/node_modules/**', '**/dist/**', '**/build/**',
				'**/.git/**', '**/venv/**', '**/__pycache__/**'
			];

			const files = await vscode.workspace.findFiles(
				`{${includePatterns.join(',')}}`,
				`{${excludePatterns.join(',')}}`,
				100 // Limit to 100 files for performance
			);

			// Read file contents
			for (const fileUri of files) {
				try {
					const document = await vscode.workspace.openTextDocument(fileUri);

					filesToScan.push({
						uri: fileUri,
						content: document.getText(),
						language: document.languageId
					});
				} catch (error) {
					logger.error(`Error reading file ${fileUri.fsPath}: ${error.message}`);
					// Continue with other files
				}
			}
		}
	} catch (error) {
		logger.error(`Error collecting files to scan: ${error.message}`);
		vscode.window.showErrorMessage(`Error collecting files: ${error.message}`);
	}

	return filesToScan;
}

/**
 * Export security report to a file
 *
 * @param scanResults Security scan results
 * @param totalIssues Total number of issues
 * @param highestRiskLevel Highest risk level
 * @param format Export format (markdown, html, json)
 */
async function exportSecurityReport(
	scanResults: any[],
	totalIssues: number,
	highestRiskLevel: RiskLevel,
	format: string = 'markdown'
): Promise<void> {
	try {
		// Ask for file path
		const workspaceFolder = vscode.workspace.workspaceFolders![0];
		const defaultUri = vscode.Uri.joinPath(
			workspaceFolder.uri,
			`security-report.${format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'json'}`
		);

		const fileUri = await vscode.window.showSaveDialog({
			defaultUri,
			filters: {
				[format === 'markdown' ? 'Markdown' : format === 'html' ? 'HTML' : 'JSON']: [
					format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'json'
				]
			}
		});

		if (!fileUri) {
			return; // User cancelled
		}

		// Generate report content
		let content = '';

		if (format === 'markdown') {
			content = generateMarkdownReport(scanResults, totalIssues, highestRiskLevel);
		} else if (format === 'html') {
			content = generateHtmlReport(scanResults, totalIssues, highestRiskLevel);
		} else {
			// JSON format
			content = JSON.stringify({
				timestamp: new Date().toISOString(),
				workspaceName: vscode.workspace.name || 'Workspace',
				totalFiles: scanResults.length,
				totalIssues,
				highestRiskLevel,
				results: scanResults
			}, null, 2);
		}

		// Write to file
		const encoder = new TextEncoder();
		await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

		// Show success message
		vscode.window.showInformationMessage(`Security report exported to ${fileUri.fsPath}`);

		// Open the file
		const document = await vscode.workspace.openTextDocument(fileUri);
		await vscode.window.showTextDocument(document);
	} catch (error) {
		logger.error(`Error exporting security report: ${error.message}`);
		vscode.window.showErrorMessage(`Failed to export security report: ${error.message}`);
	}
}

/**
 * Generate markdown report
 *
 * @param scanResults Security scan results
 * @param totalIssues Total number of issues
 * @param highestRiskLevel Highest risk level
 * @returns Markdown content
 */
function generateMarkdownReport(
	scanResults: any[],
	totalIssues: number,
	highestRiskLevel: RiskLevel
): string {
	const timestamp = new Date().toISOString();
	const workspaceName = vscode.workspace.name || 'Workspace';

	let markdown = `# Security Report: ${workspaceName}\n\n`;
	markdown += `Generated on: ${new Date(timestamp).toLocaleString()}\n\n`;
	markdown += `## Summary\n\n`;
	markdown += `- **Files Scanned**: ${scanResults.length}\n`;
	markdown += `- **Total Issues**: ${totalIssues}\n`;
	markdown += `- **Risk Level**: ${highestRiskLevel}\n\n`;

	// Add issues by file
	markdown += `## Issues by File\n\n`;

	for (const result of scanResults) {
		const fileName = path.basename(result.filePath);
		const issues = result.issues;

		if (issues.length === 0) {
			continue; // Skip files with no issues
		}

		markdown += `### ${fileName}\n\n`;
		markdown += `- **Risk Level**: ${result.riskLevel}\n`;
		markdown += `- **Issues**: ${issues.length}\n\n`;

		// List issues
		issues.forEach((issue: any, index: number) => {
			markdown += `#### Issue ${index + 1}: ${issue.type}\n\n`;
			markdown += `- **Severity**: ${issue.severity}\n`;
			markdown += `- **Description**: ${issue.description}\n`;
			markdown += `- **Location**: Lines ${issue.location.startLine}-${issue.location.endLine}\n`;
			markdown += `- **Recommendation**: ${issue.recommendation}\n`;

			if (issue.cwe) {
				markdown += `- **CWE**: ${issue.cwe}\n`;
			}

			markdown += `\n\`\`\`${result.language}\n${issue.location.code}\n\`\`\`\n\n`;
		});

		markdown += `---\n\n`;
	}

	// Add summary section
	markdown += `## Risk Assessment\n\n`;
	markdown += getRiskAssessmentMarkdown(highestRiskLevel);

	markdown += `\n\n---\n\n`;
	markdown += `Generated by SuperCoderAI Security Scanner\n`;

	return markdown;
}

/**
 * Generate HTML report
 *
 * @param scanResults Security scan results
 * @param totalIssues Total number of issues
 * @param highestRiskLevel Highest risk level
 * @returns HTML content
 */
function generateHtmlReport(
	scanResults: any[],
	totalIssues: number,
	highestRiskLevel: RiskLevel
): string {
	const timestamp = new Date().toISOString();
	const workspaceName = vscode.workspace.name || 'Workspace';

	let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Report: ${workspaceName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3, h4 { margin-top: 24px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .issue { margin-bottom: 20px; border-left: 4px solid #ccc; padding-left: 16px; }
        .issue.critical { border-left-color: #d32f2f; }
        .issue.high { border-left-color: #f57c00; }
        .issue.medium { border-left-color: #fbc02d; }
        .issue.low { border-left-color: #0288d1; }
        .issue.info { border-left-color: #4caf50; }
        .severity { font-weight: bold; }
        .severity.critical { color: #d32f2f; }
        .severity.high { color: #f57c00; }
        .severity.medium { color: #fbc02d; }
        .severity.low { color: #0288d1; }
        .severity.info { color: #4caf50; }
        .summary { background-color: #f5f5f5; padding: 16px; border-radius: 4px; margin-bottom: 24px; }
        .file-heading { background-color: #e0e0e0; padding: 8px 16px; border-radius: 4px; margin-top: 24px; }
        .code { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', Courier, monospace; }
    </style>
</head>
<body>
    <h1>Security Report: ${workspaceName}</h1>
    <p>Generated on: ${new Date(timestamp).toLocaleString()}</p>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Files Scanned</strong>: ${scanResults.length}</p>
        <p><strong>Total Issues</strong>: ${totalIssues}</p>
        <p><strong>Risk Level</strong>: <span class="severity ${highestRiskLevel.toLowerCase()}">${highestRiskLevel}</span></p>
    </div>

    <h2>Issues by File</h2>`;

	for (const result of scanResults) {
		const fileName = path.basename(result.filePath);
		const issues = result.issues;

		if (issues.length === 0) {
			continue; // Skip files with no issues
		}

		html += `
    <div class="file-section">
        <h3 class="file-heading">${fileName}</h3>
        <p><strong>Risk Level</strong>: <span class="severity ${result.riskLevel.toLowerCase()}">${result.riskLevel}</span></p>
        <p><strong>Issues</strong>: ${issues.length}</p>
        `;

		// List issues
		issues.forEach((issue: any, index: number) => {
			html += `
        <div class="issue ${issue.severity.toLowerCase()}">
            <h4>Issue ${index + 1}: ${issue.type}</h4>
            <p><strong>Severity</strong>: <span class="severity ${issue.severity.toLowerCase()}">${issue.severity}</span></p>
            <p><strong>Description</strong>: ${issue.description}</p>
            <p><strong>Location</strong>: Lines ${issue.location.startLine}-${issue.location.endLine}</p>
            <p><strong>Recommendation</strong>: ${issue.recommendation}</p>
            `;

			if (issue.cwe) {
				html += `<p><strong>CWE</strong>: ${issue.cwe}</p>`;
			}

			html += `
            <pre class="code">${escapeHtml(issue.location.code)}</pre>
        </div>
            `;
		});

		html += `
    </div>
    <hr>`;
	}

	// Add risk assessment
	html += `
    <h2>Risk Assessment</h2>
    ${getRiskAssessmentHtml(highestRiskLevel)}

    <hr>
    <footer>
        <p>Generated by SuperCoderAI Security Scanner</p>
    </footer>
</body>
</html>`;

	return html;
}

/**
 * Escape HTML special characters
 *
 * @param text Text to escape
 * @returns Escaped text
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
 * Get risk assessment text for markdown
 *
 * @param riskLevel Risk level
 * @returns Markdown risk assessment
 */
function getRiskAssessmentMarkdown(riskLevel: RiskLevel): string {
	switch (riskLevel) {
		case RiskLevel.CRITICAL:
			return 'The code has **critical security vulnerabilities** that must be addressed immediately. These issues could lead to severe security breaches, data loss, or system compromise.';
		case RiskLevel.HIGH:
			return 'The code has **high-risk security vulnerabilities** that should be addressed as soon as possible. These issues present significant security concerns that could potentially be exploited.';
		case RiskLevel.MEDIUM:
			return 'The code has **medium-risk security vulnerabilities** that should be addressed. While not as severe as critical or high-risk issues, these vulnerabilities still represent security weaknesses.';
		case RiskLevel.LOW:
			return 'The code has **low-risk security vulnerabilities**. These issues represent minor security concerns but should still be addressed during normal development cycles.';
		case RiskLevel.SECURE:
		default:
			return 'No security issues were detected in the scanned code. However, this does not guarantee that the code is completely secure, as automated scans may not detect all types of vulnerabilities.';
	}
}

/**
 * Get risk assessment text for HTML
 *
 * @param riskLevel Risk level
 * @returns HTML risk assessment
 */
function getRiskAssessmentHtml(riskLevel: RiskLevel): string {
	switch (riskLevel) {
		case RiskLevel.CRITICAL:
			return '<p>The code has <strong class="severity critical">critical security vulnerabilities</strong> that must be addressed immediately. These issues could lead to severe security breaches, data loss, or system compromise.</p>';
		case RiskLevel.HIGH:
			return '<p>The code has <strong class="severity high">high-risk security vulnerabilities</strong> that should be addressed as soon as possible. These issues present significant security concerns that could potentially be exploited.</p>';
		case RiskLevel.MEDIUM:
			return '<p>The code has <strong class="severity medium">medium-risk security vulnerabilities</strong> that should be addressed. While not as severe as critical or high-risk issues, these vulnerabilities still represent security weaknesses.</p>';
		case RiskLevel.LOW:
			return '<p>The code has <strong class="severity low">low-risk security vulnerabilities</strong>. These issues represent minor security concerns but should still be addressed during normal development cycles.</p>';
		case RiskLevel.SECURE:
		default:
			return '<p>No security issues were detected in the scanned code. However, this does not guarantee that the code is completely secure, as automated scans may not detect all types of vulnerabilities.</p>';
	}
}

/**
 * Get color for risk level
 *
 * @param riskLevel Risk level
 * @returns CSS color for the risk level
 */
function getRiskLevelColor(riskLevel: RiskLevel): string {
	switch (riskLevel) {
		case RiskLevel.CRITICAL:
			return '#d32f2f'; // Red
		case RiskLevel.HIGH:
			return '#f57c00'; // Orange
		case RiskLevel.MEDIUM:
			return '#fbc02d'; // Yellow
		case RiskLevel.LOW:
			return '#0288d1'; // Blue
		case RiskLevel.SECURE:
		default:
			return '#4caf50'; // Green
	}
}

/**
 * Get numerical score for risk level (for comparison)
 *
 * @param riskLevel Risk level
 * @returns Numerical score
 */
function getRiskLevelScore(riskLevel: RiskLevel): number {
	switch (riskLevel) {
		case RiskLevel.CRITICAL:
			return 4;
		case RiskLevel.HIGH:
			return 3;
		case RiskLevel.MEDIUM:
			return 2;
		case RiskLevel.LOW:
			return 1;
		case RiskLevel.SECURE:
		default:
			return 0;
	}
}

/**
 * Show notification based on risk level
 *
 * @param riskLevel Risk level
 */
function showRiskLevelNotification(riskLevel: RiskLevel): void {
	switch (riskLevel) {
		case RiskLevel.CRITICAL:
			vscode.window.showErrorMessage('Critical security vulnerabilities detected!');
			break;
		case RiskLevel.HIGH:
			vscode.window.showErrorMessage('High-risk security vulnerabilities detected!');
			break;
		case RiskLevel.MEDIUM:
			vscode.window.showWarningMessage('Medium-risk security vulnerabilities detected.');
			break;
		case RiskLevel.LOW:
			vscode.window.showInformationMessage('Low-risk security issues detected.');
			break;
		case RiskLevel.SECURE:
			vscode.window.showInformationMessage('No security issues detected.');
			break;
	}
}

/**
 * Highlight an issue in the editor
 *
 * @param editor Text editor
 * @param startLine Start line (1-based)
 * @param endLine End line (1-based)
 */
function highlightIssueInEditor(
	editor: vscode.TextEditor,
	startLine: number,
	endLine: number
): void {
	try {
		// Convert to 0-based line numbers
		const start = Math.max(0, startLine - 1);
		const end = Math.min(editor.document.lineCount - 1, endLine - 1);

		// Create range for the issue
		const range = new vscode.Range(
			start, 0,
			end, editor.document.lineAt(end).range.end.character
		);

		// Reveal the range
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

		// Select the range
		editor.selection = new vscode.Selection(range.start, range.end);

		// Add decoration
		const decoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: 'rgba(255, 0, 0, 0.2)',
			isWholeLine: true
		});

		editor.setDecorations(decoration, [range]);

		// Remove decoration after a few seconds
		setTimeout(() => {
			decoration.dispose();
		}, 3000);
	} catch (error) {
		logger.error(`Error highlighting issue: ${error.message}`);
	}
}

/**
 * Commands related to security and API key management
 */
export class SecurityCommands {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly apiKeyManager: ApiKeyManager;

	/**
	 * Create a new SecurityCommands instance
	 * @param context Extension context
	 * @param apiKeyManager API key manager
	 * @param logger Logger
	 */
	constructor(
		context: vscode.ExtensionContext,
		apiKeyManager: ApiKeyManager,
		logger: Logger
	) {
		this.context = context;
		this.apiKeyManager = apiKeyManager;
		this.logger = logger;
	}

	/**
	 * Register security-related commands
	 * @returns Array of disposables
	 */
	public registerCommands(): vscode.Disposable[] {
		this.logger.info('Registering security commands');

		return [
			vscode.commands.registerCommand('aiAssistant.configureProvider', this.configureProvider.bind(this)),
			vscode.commands.registerCommand('aiAssistant.rotateApiKeys', this.rotateApiKeys.bind(this)),
			vscode.commands.registerCommand('aiAssistant.checkSecuritySettings', this.checkSecuritySettings.bind(this)),
			vscode.commands.registerCommand('aiAssistant.openSecurityGuide', this.openSecurityGuide.bind(this))
		];
	}

	/**
	 * Command to configure a provider's API key
	 */
	private async configureProvider(): Promise<void> {
		try {
			// Get list of available providers
			const providerIds = this.apiKeyManager.getProviderIds();

			// Create QuickPick items
			const items = await Promise.all(providerIds.map(async id => {
				const hasKey = await this.apiKeyManager.hasApiKey(id);
				return {
					label: this.apiKeyManager.getProviderDisplayName(id),
					description: hasKey ? '$(check) Configured' : '$(circle-slash) Not configured',
					detail: `Configure API key for ${this.apiKeyManager.getProviderDisplayName(id)}`,
					id: id
				};
			}));

			// Show quick pick
			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select a provider to configure',
				ignoreFocusOut: true
			});

			if (!selected) {
				return;
			}

			// Configure selected provider
			const success = await this.apiKeyManager.configureApiKey(selected.id);

			if (success) {
				vscode.window.showInformationMessage(`${selected.label} API key configured successfully.`);
			}
		} catch (error) {
			this.logger.error(`Error configuring provider: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to configure provider: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Command to rotate API keys
	 */
	private async rotateApiKeys(): Promise<void> {
		try {
			// Get providers with configured keys
			const providerIds = this.apiKeyManager.getProviderIds();
			const configuredProviders = [];

			for (const id of providerIds) {
				if (await this.apiKeyManager.hasApiKey(id)) {
					configuredProviders.push({
						id,
						name: this.apiKeyManager.getProviderDisplayName(id)
					});
				}
			}

			if (configuredProviders.length === 0) {
				vscode.window.showInformationMessage('No API keys are currently configured.');
				return;
			}

			// Show information dialog
			const result = await vscode.window.showInformationMessage(
				'Key rotation improves security. To rotate a key, first generate a new API key on the provider\'s website, ' +
				'then update it here. Would you like to continue?',
				'Configure Provider', 'Open Documentation', 'Cancel'
			);

			if (result === 'Configure Provider') {
				await vscode.commands.executeCommand('aiAssistant.configureProvider');
			} else if (result === 'Open Documentation') {
				await vscode.commands.executeCommand('aiAssistant.openSecurityGuide');
			}
		} catch (error) {
			this.logger.error(`Error in rotateApiKeys: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Command to check security settings
	 */
	private async checkSecuritySettings(): Promise<void> {
		try {
			// Get current security settings
			const securityChecks = [];

			// Check for API keys stored
			const providerIds = this.apiKeyManager.getProviderIds();
			let configuredKeys = 0;

			for (const id of providerIds) {
				if (await this.apiKeyManager.hasApiKey(id)) {
					configuredKeys++;
				}
			}

			securityChecks.push({
				name: 'API Keys',
				status: configuredKeys > 0 ? '$(check) Configured' : '$(warning) Not configured',
				description: `${configuredKeys} provider(s) configured`,
				action: configuredKeys > 0 ? 'Rotate Keys' : 'Configure Keys',
				command: 'aiAssistant.configureProvider'
			});

			// Show security check results
			this.showSecurityChecksPanel(securityChecks);
		} catch (error) {
			this.logger.error(`Error checking security settings: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Show security checks in a webview panel
	 * @param securityChecks Array of security check results
	 */
	private showSecurityChecksPanel(securityChecks: Array<{
		name: string;
		status: string;
		description: string;
		action: string;
		command: string;
	}>): void {
		// Create webview panel
		const panel = vscode.window.createWebviewPanel(
			'securityCheck',
			'AI Assistant Security Check',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		// Create HTML content
		const checkItems = securityChecks.map(check => {
			return `
				<div class="security-check">
					<div class="check-header">
						<span class="check-name">${check.name}</span>
						<span class="check-status">${check.status}</span>
					</div>
					<div class="check-description">${check.description}</div>
					<button class="action-button" data-command="${check.command}">${check.action}</button>
				</div>
			`;
		}).join('');

		// Set HTML content
		panel.webview.html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Security Check</title>
				<style>
					body {
						padding: 20px;
						font-family: var(--vscode-font-family);
						color: var(--vscode-foreground);
					}
					h1 {
						font-size: 1.5em;
						border-bottom: 1px solid var(--vscode-panel-border);
						padding-bottom: 10px;
					}
					.security-check {
						margin-bottom: 20px;
						padding: 15px;
						background-color: var(--vscode-editor-background);
						border: 1px solid var(--vscode-panel-border);
						border-radius: 4px;
					}
					.check-header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 10px;
					}
					.check-name {
						font-weight: bold;
						font-size: 1.1em;
					}
					.check-description {
						margin-bottom: 15px;
						color: var(--vscode-descriptionForeground);
					}
					.action-button {
						background-color: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
						border: none;
						padding: 6px 14px;
						border-radius: 2px;
						cursor: pointer;
					}
					.action-button:hover {
						background-color: var(--vscode-button-hoverBackground);
					}
					.security-tips {
						margin-top: 30px;
						padding: 15px;
						background-color: var(--vscode-inputValidation-infoBackground);
						border: 1px solid var(--vscode-inputValidation-infoBorder);
						border-radius: 4px;
					}
				</style>
			</head>
			<body>
				<h1>AI Assistant Security Check</h1>

				<div class="security-checks">
					${checkItems}
				</div>

				<div class="security-tips">
					<h2>Security Tips</h2>
					<ul>
						<li>Rotate your API keys regularly</li>
						<li>Use unique API keys for different applications</li>
						<li>Monitor your API usage for unexpected activity</li>
						<li>Be cautious of screen sharing when API keys are visible</li>
					</ul>
				</div>

				<script>
					(function() {
						const vscode = acquireVsCodeApi();

						// Add event listeners to all action buttons
						document.querySelectorAll('.action-button').forEach(button => {
							button.addEventListener('click', () => {
								const command = button.getAttribute('data-command');
								if (command) {
									vscode.postMessage({
										command: 'executeCommand',
										value: command
									});
								}
							});
						});
					})();
				</script>
			</body>
			</html>
		`;

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(message => {
			if (message.command === 'executeCommand' && message.value) {
				vscode.commands.executeCommand(message.value);
			}
		});
	}

	/**
	 * Open the security guide documentation
	 */
	private async openSecurityGuide(): Promise<void> {
		try {
			// Open the security markdown document
			const securityDoc = vscode.Uri.joinPath(
				this.context.extensionUri,
				'docs',
				'API_KEYS_SECURITY.md'
			);

			await vscode.commands.executeCommand('markdown.showPreview', securityDoc);
		} catch (error) {
			this.logger.error(`Error opening security guide: ${error instanceof Error ? error.message : String(error)}`);
			vscode.window.showErrorMessage(`Failed to open security guide: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
