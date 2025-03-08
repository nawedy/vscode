/**
 * Context Manager
 *
 * Gathers and manages context about the codebase to provide to AI models.
 * Tracks file relationships, symbols, and project structure.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileWatcher, FileChangeEvent, FileChangeType } from './fileWatcher';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/configService';

/**
 * File content information
 */
export interface FileContent {
	/** Relative path of the file */
	path: string;
	/** Content of the file */
	content: string;
	/** Language of the file based on extension */
	language: string;
	/** Last modified time in milliseconds */
	lastModified: number;
	/** Content hash for change detection */
	hash: string;
}

/**
 * File context information
 */
export interface FileContext {
	/** File URI */
	uri: vscode.Uri;
	/** File content */
	content: string;
	/** Language ID */
	languageId: string;
	/** Selection range if any */
	selection?: vscode.Range;
	/** Last modified timestamp */
	lastModified?: number;
	/** Document symbols */
	symbols?: vscode.DocumentSymbol[];
	/** Imported modules */
	imports?: string[];
	/** Exported items */
	exports?: string[];
}

/**
 * Code context
 */
export interface CodeContext {
	currentFile?: FileContext;
	relatedFiles: FileContext[];
	projectInfo: ProjectInfo;
	selection?: string;
}

/**
 * Project information
 */
export interface ProjectInfo {
	name: string;
	rootPath: string;
	hasPackageJson: boolean;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	languages: Set<string>;
	fileCount: number;
}

/**
 * Manages contextual information about the project
 */
export class ContextManager {
	private context: vscode.ExtensionContext;
	private fileWatcher: FileWatcher;
	private logger: Logger;
	private configService: ConfigService;

	private fileContextCache: Map<string, FileContext> = new Map();
	private relatedFilesCache: Map<string, string[]> = new Map();
	private projectInfo: ProjectInfo | undefined;

	private readonly onContextChangedEmitter = new vscode.EventEmitter<void>();
	public readonly onContextChanged = this.onContextChangedEmitter.event;

	private readonly disposables: vscode.Disposable[] = [];

	/**
	 * Create a new context manager
	 * @param context Extension context
	 * @param fileWatcher File watcher
	 * @param logger Logger instance
	 * @param configService Configuration service
	 */
	constructor(
		context: vscode.ExtensionContext,
		fileWatcher: FileWatcher,
		logger: Logger,
		configService: ConfigService
	) {
		this.context = context;
		this.fileWatcher = fileWatcher;
		this.logger = logger;
		this.configService = configService;

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize context manager
	 */
	private initialize(): void {
		// Listen for file changes - using correct event name
		this.disposables.push(
			this.fileWatcher.onFileChanged(this.handleFileChange.bind(this))
		);

		// Listen for editor changes
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(this.handleActiveEditorChanged.bind(this))
		);

		// Listen for document changes
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument(this.handleDocumentChanged.bind(this))
		);

		// Initialize project info
		this.initializeProjectInfo();

		// Initialize context for current file if any
		if (vscode.window.activeTextEditor) {
			this.updateFileContext(vscode.window.activeTextEditor.document.uri);
		}
	}

	/**
	 * Handle file changes from file watcher
	 * @param event File change event
	 */
	private handleFileChange(event: FileChangeEvent): void {
		switch (event.type) {
			case FileChangeType.Created:
			case FileChangeType.Changed:
				this.updateFileContext(event.uri);
				break;
			case FileChangeType.Deleted:
				this.fileContextCache.delete(event.uri.toString());
				break;
		}

		// Clear related files cache as relationships might have changed
		this.relatedFilesCache.clear();
	}

	/**
	 * Handle active editor changes
	 * @param editor New active editor
	 */
	private handleActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
		if (editor) {
			this.updateFileContext(editor.document.uri);
		}
	}

	/**
	 * Handle document changes
	 * @param event Document change event
	 */
	private handleDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
		// Only update if it's a file scheme (not output or debug console)
		if (event.document.uri.scheme === 'file') {
			this.updateFileContext(event.document.uri);
		}
	}

	/**
	 * Update context for a file
	 * @param uri File URI
	 */
	private async updateFileContext(uri: vscode.Uri): Promise<void> {
		if (uri.scheme !== 'file') {
			return;
		}

		try {
			const document = await this.getTextDocument(uri);

			if (!document) {
				return;
			}

			// Parse symbols if supported
			let symbols: vscode.DocumentSymbol[] | undefined;
			try {
				symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					'vscode.executeDocumentSymbolProvider',
					uri
				);
			} catch (e) {
				// Symbols not supported for this file type
			}

			// Parse imports/exports if this is a code file
			let imports: string[] | undefined;
			let exports: string[] | undefined;

			if (this.isCodeFile(document)) {
				imports = this.parseImports(document);
				exports = this.parseExports(document);
			}

			// Create file context
			const fileContext: FileContext = {
				uri,
				content: document.getText(),
				languageId: document.languageId,
				lastModified: Date.now(),
				symbols,
				imports,
				exports
			};

			// Update cache
			this.fileContextCache.set(uri.toString(), fileContext);

			// Emit context changed event
			this.onContextChangedEmitter.fire();
		} catch (error) {
			this.logger.error(`Error updating file context: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Get text document for a URI
	 * @param uri Document URI
	 * @returns TextDocument or undefined
	 */
	private async getTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
		try {
			// Check if document is already open
			const openDocuments = vscode.workspace.textDocuments;
			const existingDocument = openDocuments.find(doc => doc.uri.toString() === uri.toString());

			if (existingDocument) {
				return existingDocument;
			}

			// Try to open the document
			return await vscode.workspace.openTextDocument(uri);
		} catch (error) {
			this.logger.error(`Error getting text document ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}

	/**
	 * Initialize project information
	 */
	private async initializeProjectInfo(): Promise<void> {
		try {
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				return;
			}

			const rootFolder = vscode.workspace.workspaceFolders[0];
			const rootPath = rootFolder.uri.fsPath;

			// Check for package.json
			let hasPackageJson = false;
			let dependencies: Record<string, string> | undefined;
			let devDependencies: Record<string, string> | undefined;

			const packageJsonUri = vscode.Uri.file(path.join(rootPath, 'package.json'));
			try {
				const packageJsonDoc = await vscode.workspace.openTextDocument(packageJsonUri);
				hasPackageJson = true;

				const packageJson = JSON.parse(packageJsonDoc.getText());
				dependencies = packageJson.dependencies;
				devDependencies = packageJson.devDependencies;
			} catch (e) {
				// No package.json or unable to parse it
			}

			// Get basic stats about the project
			const languages = new Set<string>();
			let fileCount = 0;

			const documents = vscode.workspace.textDocuments;
			documents.forEach(doc => {
				if (doc.uri.scheme === 'file' && doc.languageId) {
					languages.add(doc.languageId);
				}
				fileCount++;
			});

			// Create project info
			this.projectInfo = {
				name: path.basename(rootPath),
				rootPath,
				hasPackageJson,
				dependencies,
				devDependencies,
				languages,
				fileCount
			};

		} catch (error) {
			this.logger.error(`Error initializing project info: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Parse imports from a document
	 * @param document Text document
	 * @returns Array of import paths
	 */
	private parseImports(document: vscode.TextDocument): string[] {
		const text = document.getText();
		const imports: string[] = [];

		try {
			switch (document.languageId) {
				case 'javascript':
				case 'typescript':
				case 'javascriptreact':
				case 'typescriptreact':
					// ES Modules and CommonJS
					const importRegex = /import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g;
					const requireRegex = /(?:const|let|var)\s+.+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

					let match;
					while ((match = importRegex.exec(text)) !== null) {
						imports.push(match[1]);
					}
					while ((match = requireRegex.exec(text)) !== null) {
						imports.push(match[1]);
					}
					break;

				case 'python':
					// Python imports
					const pyImportRegex = /(?:from\s+([^\s]+)\s+import|import\s+([^\s]+))/g;
					while ((match = pyImportRegex.exec(text)) !== null) {
						imports.push(match[1] || match[2]);
					}
					break;

				case 'java':
					// Java imports
					const javaImportRegex = /import\s+([^;]+);/g;
					while ((match = javaImportRegex.exec(text)) !== null) {
						imports.push(match[1]);
					}
					break;

				case 'go':
					// Go imports
					const goImportRegex = /import\s+\(\s*([^)]+)\s*\)/g;
					const goSingleImportRegex = /import\s+"([^"]+)"/g;

					while ((match = goSingleImportRegex.exec(text)) !== null) {
						imports.push(match[1]);
					}

					const importBlockMatch = goImportRegex.exec(text);
					if (importBlockMatch) {
						const importBlock = importBlockMatch[1];
						const blockImportRegex = /"([^"]+)"/g;
						let blockMatch;
						while ((blockMatch = blockImportRegex.exec(importBlock)) !== null) {
							imports.push(blockMatch[1]);
						}
					}
					break;
			}
		} catch (e) {
			// Error parsing imports
		}

		return imports;
	}

	/**
	 * Parse exports from a document
	 * @param document Text document
	 * @returns Array of exported names
	 */
	private parseExports(document: vscode.TextDocument): string[] {
		const text = document.getText();
		const exports: string[] = [];

		try {
			switch (document.languageId) {
				case 'javascript':
				case 'typescript':
				case 'javascriptreact':
				case 'typescriptreact':
					// ES Modules and CommonJS
					const exportRegex = /export\s+(const|let|var|function|class|interface|type|enum)\s+([a-zA-Z0-9_]+)/g;
					const exportDefaultRegex = /export\s+default\s+(const|let|var|function|class)?\s*([a-zA-Z0-9_]+)/g;
					const moduleExportsRegex = /module\.exports\s*=\s*{([^}]+)}/g;

					let match;
					while ((match = exportRegex.exec(text)) !== null) {
						exports.push(match[2]);
					}
					while ((match = exportDefaultRegex.exec(text)) !== null) {
						if (match[2]) {
							exports.push(match[2]);
						}
					}

					const moduleExportsMatch = moduleExportsRegex.exec(text);
					if (moduleExportsMatch) {
						const exportItems = moduleExportsMatch[1].split(',').map(item => {
							const itemMatch = item.match(/\s*([a-zA-Z0-9_]+)\s*/);
							return itemMatch ? itemMatch[1] : null;
						}).filter(Boolean);
						exports.push(...exportItems as string[]);
					}
					break;
			}
		} catch (e) {
			// Error parsing exports
		}

		return exports;
	}

	/**
	 * Check if a document is a code file
	 * @param document Text document
	 * @returns Whether this is a code file
	 */
	private isCodeFile(document: vscode.TextDocument): boolean {
		const codeLanguages = [
			'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
			'python', 'java', 'go', 'c', 'cpp', 'csharp', 'php', 'ruby'
		];

		return codeLanguages.includes(document.languageId);
	}

	/**
	 * Find files related to a given file
	 * @param fileUri File URI
	 * @param maxDepth Maximum recursion depth
	 * @returns Array of related file URIs
	 */
	public async findRelatedFiles(fileUri: vscode.Uri, maxDepth: number = 2): Promise<vscode.Uri[]> {
		const visited = new Set<string>();
		const result: vscode.Uri[] = [];

		// Check cache first
		const cacheKey = `${fileUri.toString()}_${maxDepth}`;
		if (this.relatedFilesCache.has(cacheKey)) {
			return this.relatedFilesCache.get(cacheKey)!.map(uri => vscode.Uri.parse(uri));
		}

		// BFS to find related files
		const queue: { uri: vscode.Uri; depth: number }[] = [{ uri: fileUri, depth: 0 }];

		while (queue.length > 0) {
			const { uri, depth } = queue.shift()!;
			const uriStr = uri.toString();

			if (visited.has(uriStr) || depth > maxDepth) {
				continue;
			}

			visited.add(uriStr);

			if (uri.toString() !== fileUri.toString()) {
				result.push(uri);
			}

			if (depth === maxDepth) {
				continue;
			}

			// Get this file's context
			let fileContext = this.fileContextCache.get(uriStr);

			if (!fileContext) {
				// Try to load it
				await this.updateFileContext(uri);
				fileContext = this.fileContextCache.get(uriStr);
			}

			if (!fileContext || !fileContext.imports) {
				continue;
			}

			// Find all imports
			for (const importPath of fileContext.imports) {
				try {
					const importedFiles = await this.resolveImportPath(uri, importPath);
					for (const importedFile of importedFiles) {
						queue.push({ uri: importedFile, depth: depth + 1 });
					}
				} catch (e) {
					// Skip failed import resolution
				}
			}

			// Find files that import this file (simple approach)
			for (const [otherUriStr, otherContext] of this.fileContextCache.entries()) {
				if (otherContext.imports && this.importsFile(otherContext, uri)) {
					queue.push({ uri: vscode.Uri.parse(otherUriStr), depth: depth + 1 });
				}
			}
		}

		// Cache the result
		this.relatedFilesCache.set(
			cacheKey,
			result.map(uri => uri.toString())
		);

		return result;
	}

	/**
	 * Resolve an import path to actual files
	 * @param baseUri Base URI of the importing file
	 * @param importPath Import path
	 * @returns Array of resolved URIs
	 */
	private async resolveImportPath(baseUri: vscode.Uri, importPath: string): Promise<vscode.Uri[]> {
		const result: vscode.Uri[] = [];

		// Skip built-in and node_modules imports
		if (importPath.startsWith('node:') || !importPath.startsWith('.')) {
			return result;
		}

		try {
			// Get the base directory
			const baseDir = path.dirname(baseUri.fsPath);

			// Resolve relative path
			let resolvedPath = path.resolve(baseDir, importPath);

			// Check if the path exists
			if (fs.existsSync(resolvedPath)) {
				// If it's a directory, look for index files
				if (fs.statSync(resolvedPath).isDirectory()) {
					const indexFiles = ['index.js', 'index.ts', 'index.jsx', 'index.tsx'];
					for (const indexFile of indexFiles) {
						const indexPath = path.join(resolvedPath, indexFile);
						if (fs.existsSync(indexPath)) {
							result.push(vscode.Uri.file(indexPath));
						}
					}
				} else {
					// It's a file
					result.push(vscode.Uri.file(resolvedPath));
				}
			} else {
				// Try adding extensions
				const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
				for (const ext of extensions) {
					const pathWithExt = resolvedPath + ext;
					if (fs.existsSync(pathWithExt)) {
						result.push(vscode.Uri.file(pathWithExt));
					}
				}
			}
		} catch (error) {
			this.logger.error(
				`Error resolving import path ${importPath} from ${baseUri.fsPath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		return result;
	}

	/**
	 * Check if a file imports another file
	 * @param fileContext File context to check
	 * @param importedUri URI of potentially imported file
	 * @returns Whether the file imports the other file
	 */
	private importsFile(fileContext: FileContext, importedUri: vscode.Uri): boolean {
		if (!fileContext.imports || fileContext.imports.length === 0) {
			return false;
		}

		const importedPath = importedUri.fsPath;
		const baseDir = path.dirname(fileContext.uri.fsPath);

		for (const importPath of fileContext.imports) {
			// Skip built-in and node_modules imports
			if (importPath.startsWith('node:') || !importPath.startsWith('.')) {
				continue;
			}

			try {
				const resolvedPath = path.resolve(baseDir, importPath);

				if (resolvedPath === importedPath) {
					return true;
				}

				// Check with extensions
				const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
				for (const ext of extensions) {
					if (resolvedPath + ext === importedPath) {
						return true;
					}
				}

				// Check for index files
				if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
					const indexFiles = ['index.js', 'index.ts', 'index.jsx', 'index.tsx'];
					for (const indexFile of indexFiles) {
						const indexPath = path.join(resolvedPath, indexFile);
						if (indexPath === importedPath) {
							return true;
						}
					}
				}
			} catch (e) {
				// Skip failed import resolution
			}
		}

		return false;
	}

	/**
	 * Get current context
	 * @param includeFileContents Whether to include full file contents
	 * @returns Current code context
	 */
	public async getContext(includeFileContents: boolean = true): Promise<CodeContext> {
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return {
					relatedFiles: [],
					projectInfo: this.projectInfo || this.createDefaultProjectInfo()
				};
			}

			const uri = editor.document.uri;

			// Get current file context
			await this.updateFileContext(uri);
			const currentFileContext = this.fileContextCache.get(uri.toString());

			if (!currentFileContext) {
				return {
					relatedFiles: [],
					projectInfo: this.projectInfo || this.createDefaultProjectInfo()
				};
			}

			// Get related files
			const contextDepth = this.configService.getContextDepth();
			const relatedFileUris = await this.findRelatedFiles(uri, contextDepth);
			const relatedFiles: FileContext[] = [];

			for (const relatedUri of relatedFileUris) {
				const relatedContext = this.fileContextCache.get(relatedUri.toString());

				if (relatedContext) {
					if (!includeFileContents) {
						// Create a copy without full content
						const { content, ...contextWithoutContent } = relatedContext;
						relatedFiles.push({
							...contextWithoutContent,
							content: '' // Empty content
						});
					} else {
						relatedFiles.push(relatedContext);
					}
				}
			}

			// Get selected text
			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);

			// Create full context
			return {
				currentFile: includeFileContents ? currentFileContext : {
					...currentFileContext,
					content: ''
				},
				relatedFiles,
				projectInfo: this.projectInfo || this.createDefaultProjectInfo(),
				selection: selectedText || undefined
			};
		} catch (error) {
			this.logger.error(`Error getting context: ${error instanceof Error ? error.message : String(error)}`);

			return {
				relatedFiles: [],
				projectInfo: this.projectInfo || this.createDefaultProjectInfo()
			};
		}
	}

	/**
	 * Create default project info
	 * @returns Default project info
	 */
	private createDefaultProjectInfo(): ProjectInfo {
		return {
			name: 'Unknown Project',
			rootPath: '',
			hasPackageJson: false,
			languages: new Set<string>(),
			fileCount: 0
		};
	}

	/**
	 * Dispose all resources
	 */
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
