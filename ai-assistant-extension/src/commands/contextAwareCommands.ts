/**
 * Context-Aware Commands for AI Assistant VSCode Extension
 *
 * This file implements command handlers for context-aware code operations
 * such as code generation, refactoring, and completion.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
import { ContextManager } from '../context/contextManager';
import { ViewManager } from '../ui/viewManager';
import { Logger } from '../utils/logger';
import { ModelCapability } from '../ai/providers/baseProvider';
import { ConfigService } from '../services/configService';
import { TokenUsageTracker } from '../utils/tokenUsageTracker';
import { ModelManager } from '../ai/modelManager';
import { TaskResult } from '../ai/ensemble/ensembleLLM';

/**
 * Text encoder for file operations
 */
const TextEncoder = globalThis.TextEncoder;

/**
 * Context-Aware Commands
 *
 * Provides commands that leverage contextual understanding of the codebase.
 * These commands use the context manager to provide better AI assistance.
 */
export class ContextAwareCommands {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly contextManager: ContextManager;
	private readonly viewManager: ViewManager;
	private readonly tokenTracker: TokenUsageTracker;
	private readonly configService: ConfigService;
	private readonly codeGenerationEnsemble: CodeGenerationEnsemble;
	private readonly modelManager: ModelManager;

	/**
	 * Create new context-aware commands
	 * @param context Extension context
	 * @param logger Logger instance
	 * @param contextManager Context manager
	 * @param viewManager View manager
	 * @param configService Configuration service
	 */
	constructor(
		context: vscode.ExtensionContext,
		logger: Logger,
		contextManager: ContextManager,
		viewManager: ViewManager,
		configService: ConfigService,
		modelManager: ModelManager
	) {
		this.context = context;
		this.logger = logger;
		this.contextManager = contextManager;
		this.viewManager = viewManager;
		this.configService = configService;
		this.tokenTracker = new TokenUsageTracker(context);
		this.codeGenerationEnsemble = new CodeGenerationEnsemble(configService, logger, modelManager);
		this.modelManager = modelManager;
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
					vscode.ViewColumn.Beside,
					{ enableScripts: true }
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
					vscode.ViewColumn.Active,
					{ enableScripts: true }
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
Related files:
${context.relatedFiles.map(file => `- ${file.uri.fsPath} (${file.languageId})`).join('\n')}

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
					vscode.ViewColumn.Active,
					{ enableScripts: true }
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
Related files:
${context.relatedFiles.map(file => `- ${file.uri.fsPath} (${file.languageId})`).join('\n')}

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
	private async showCodeGenerationExplanation(
		code: string,
		explanation: string,
		language: string,
		metadata?: Record<string, unknown>
	): Promise<void> {
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
			vscode.ViewColumn.Active,
			{ enableScripts: true }
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
	private async createNewFile(
		language: string,
		code: string,
		options?: {
			directory?: string;
			name?: string;
			openAfterCreate?: boolean;
		}
	): Promise<void> {
		try {
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
