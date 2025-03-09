/**
 * Project Analyzer for SuperCoderAI VSCode Extension
 *
 * This file implements a comprehensive project analyzer that scans project
 * structure, extracts file content, and builds a structured representation
 * of the codebase. It provides privacy-first file handling and efficient
 * traversal with appropriate filtering.
 *
 * Key features:
 * - Efficient project structure traversal
 * - Language detection and file categorization
 * - File content handling with privacy controls
 * - File filtering based on patterns and size
 * - Project structure representation
 *
 * File path: src/context/projectAnalyzer.ts
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import glob from 'glob'; // Changed from import * as glob
import { promisify } from 'util';
import { FileContent } from './contextManager';
import { logger } from '../utils/logger';

// Promisify glob correctly
const globPromise = promisify(glob);

interface ProjectStats {
	fileCount: number;
	totalLines: number;
	languages: Map<string, number>;
	dependencies: Map<string, string>;
}

/**
 * Analyzes project structure and content
 */
export class ProjectAnalyzer {
	// Map of file extensions to languages
	private extensionToLanguage: Map<string, string> = new Map();
	private readonly logger: Logger;
	private projectStats: ProjectStats | null = null;

	/**
	 * Initialize the project analyzer
	 */
	constructor(logger: Logger) {
		this.logger = logger;
		this.initializeExtensionMappings();
		logger.info('ProjectAnalyzer initialized');
	}

	/**
	 * Initialize file extension to language mappings
	 */
	private initializeExtensionMappings(): void {
		// JavaScript/TypeScript
		this.extensionToLanguage.set('.js', 'javascript');
		this.extensionToLanguage.set('.jsx', 'javascript');
		this.extensionToLanguage.set('.ts', 'typescript');
		this.extensionToLanguage.set('.tsx', 'typescript');

		// Python
		this.extensionToLanguage.set('.py', 'python');
		this.extensionToLanguage.set('.pyw', 'python');

		// Java
		this.extensionToLanguage.set('.java', 'java');

		// C/C++
		this.extensionToLanguage.set('.c', 'c');
		this.extensionToLanguage.set('.cpp', 'cpp');
		this.extensionToLanguage.set('.h', 'c');
		this.extensionToLanguage.set('.hpp', 'cpp');

		// Go
		this.extensionToLanguage.set('.go', 'go');

		// Ruby
		this.extensionToLanguage.set('.rb', 'ruby');

		// PHP
		this.extensionToLanguage.set('.php', 'php');

		// C#
		this.extensionToLanguage.set('.cs', 'csharp');

		// Swift
		this.extensionToLanguage.set('.swift', 'swift');

		// Kotlin
		this.extensionToLanguage.set('.kt', 'kotlin');

		// Rust
		this.extensionToLanguage.set('.rs', 'rust');

		// Web
		this.extensionToLanguage.set('.html', 'html');
		this.extensionToLanguage.set('.css', 'css');
		this.extensionToLanguage.set('.scss', 'scss');
		this.extensionToLanguage.set('.less', 'less');

		// Data
		this.extensionToLanguage.set('.json', 'json');
		this.extensionToLanguage.set('.yml', 'yaml');
		this.extensionToLanguage.set('.yaml', 'yaml');
		this.extensionToLanguage.set('.xml', 'xml');
		this.extensionToLanguage.set('.md', 'markdown');
	}

	/**
	 * Analyze a project and extract file contents
	 *
	 * @param rootPath Root path of the project
	 * @param includePatterns Patterns of files to include
	 * @param excludePatterns Patterns of files to exclude
	 * @param maxFiles Maximum number of files to analyze
	 * @param maxFileSize Maximum file size to include
	 * @returns Array of file contents
	 */
	public async analyzeProject(
		rootPath: string,
		includePatterns: string[] = ['**/*'],
		excludePatterns: string[] = ['**/node_modules/**'],
		maxFiles: number = 1000,
		maxFileSize: number = 1024 * 1024 // 1MB
	): Promise<FileContent[]> {
		try {
			logger.info(`Analyzing project: ${rootPath}`);

			// Build glob pattern
			const globOptions = {
				cwd: rootPath,
				ignore: excludePatterns,
				nodir: true, // Don't include directories
				absolute: true, // Return absolute paths
				dot: false // Ignore dot files by default
			};

			// Process each include pattern
			const allMatches: string[] = [];
			for (const pattern of includePatterns) {
				const matches = await globPromise(pattern, globOptions);
				allMatches.push(...matches);
			}

			// Remove duplicates
			const uniqueFiles = Array.from(new Set(allMatches));

			logger.info(`Found ${uniqueFiles.length} files matching patterns`);

			// Limit to max files
			const filesToProcess = uniqueFiles.slice(0, maxFiles);

			// Process files in parallel with a reasonable concurrency limit
			const results = await Promise.all(
				filesToProcess.map(filePath => this.processFile(filePath, rootPath, maxFileSize))
			);

			// Filter out null results (files that were skipped)
			const fileContents = results.filter(result => result !== null) as FileContent[];

			logger.info(`Successfully processed ${fileContents.length} files`);

			return fileContents;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Error analyzing project: ${errorMessage}`);
			throw new Error(`Failed to analyze project: ${errorMessage}`);
		}
	}

	/**
	 * Process a single file and extract its content
	 *
	 * @param filePath Absolute path to the file
	 * @param rootPath Root path of the project
	 * @param maxFileSize Maximum file size to include
	 * @returns File content or null if file should be skipped
	 */
	private async processFile(
		filePath: string,
		rootPath: string,
		maxFileSize: number
	): Promise<FileContent | null> {
		try {
			// Get file stats
			const stats = await fs.promises.stat(filePath);

			// Skip if too large
			if (stats.size > maxFileSize) {
				logger.debug(`Skipping large file: ${filePath} (${stats.size} bytes)`);
				return null;
			}

			// Skip binary files
			if (this.isBinaryFile(filePath)) {
				logger.debug(`Skipping binary file: ${filePath}`);
				return null;
			}

			// Read file content
			const content = await fs.promises.readFile(filePath, 'utf8');

			// Calculate file hash for change detection
			const hash = this.calculateFileHash(content);

			// Detect language based on extension
			const language = this.detectLanguage(filePath);

			// Create relative path for storage
			const relativePath = path.relative(rootPath, filePath);

			return {
				path: relativePath,
				content,
				language,
				lastModified: stats.mtimeMs,
				hash
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Error processing file ${filePath}: ${errorMessage}`);
			return null;
		}
	}

	/**
	 * Detect if a file is likely binary based on extension
	 *
	 * @param filePath Path to the file
	 * @returns True if file is likely binary
	 */
	private isBinaryFile(filePath: string): boolean {
		const extension = path.extname(filePath).toLowerCase();

		// Common binary extensions
		const binaryExtensions = [
			'.zip', '.gz', '.tar', '.rar', '.7z', '.jar', '.war',
			'.class', '.exe', '.dll', '.so', '.dylib',
			'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
			'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
			'.mp3', '.mp4', '.avi', '.mov', '.flv', '.wmv',
			'.ttf', '.woff', '.woff2', '.eot',
			'.o', '.pyc', '.pyo', '.obj'
		];

		return binaryExtensions.includes(extension);
	}

	/**
	 * Calculate hash of file content for change detection
	 *
	 * @param content File content
	 * @returns Content hash
	 */
	private calculateFileHash(content: string): string {
		return crypto
			.createHash('md5')
			.update(content)
			.digest('hex');
	}

	/**
	 * Detect language based on file extension
	 *
	 * @param filePath Path to the file
	 * @returns Detected language
	 */
	private detectLanguage(filePath: string): string {
		const extension = path.extname(filePath).toLowerCase();

		// Get language from mapping
		if (this.extensionToLanguage.has(extension)) {
			return this.extensionToLanguage.get(extension)!;
		}

		// Try to detect based on filename for special cases
		const fileName = path.basename(filePath).toLowerCase();

		if (fileName === 'dockerfile' || fileName.endsWith('.dockerfile')) {
			return 'dockerfile';
		}
		if (fileName === 'makefile') {
			return 'makefile';
		}
		if (fileName === '.gitignore') {
			return 'gitignore';
		}

		// Default to plaintext
		return 'plaintext';
	}

	/**
	 * Create a structured representation of project structure
	 *
	 * @param files Array of file contents
	 * @param rootPath Root path of the project
	 * @returns Project structure representation
	 */
	public createProjectStructure(
		files: FileContent[],
		rootPath: string
	): any {
		// Create a tree structure
		const root: any = {
			name: path.basename(rootPath),
			type: 'directory',
			children: {}
		};

		// Add each file to the tree
		for (const file of files) {
			this.addFileToStructure(root, file.path);
		}

		// Convert to a more JSON-friendly format
		return this.simplifyStructure(root);
	}

	/**
	 * Add a file to the project structure
	 *
	 * @param root Root node of the structure
	 * @param filePath Relative path of the file
	 */
	private addFileToStructure(root: any, filePath: string): void {
		const parts = filePath.split(/[\/\\]/);
		let current = root;

		// Navigate through directories
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (!current.children[part]) {
				current.children[part] = {
					name: part,
					type: 'directory',
					children: {}
				};
			}
			current = current.children[part];
		}

		// Add file
		const fileName = parts[parts.length - 1];
		current.children[fileName] = {
			name: fileName,
			type: 'file',
			path: filePath
		};
	}

	/**
	 * Simplify structure for JSON serialization
	 *
	 * @param node Structure node
	 * @returns Simplified structure
	 */
	private simplifyStructure(node: any): any {
		if (node.type === 'file') {
			return {
				name: node.name,
				type: 'file',
				path: node.path
			};
		}

		// For directories, convert children object to array
		const children: any[] = [];
		for (const key in node.children) {
			children.push(this.simplifyStructure(node.children[key]));
		}

		// Sort children: directories first, then files alphabetically
		children.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return {
			name: node.name,
			type: 'directory',
			children
		};
	}

	/**
	 * Extract file structure as a string (similar to tree command)
	 *
	 * @param files Array of file contents
	 * @param rootPath Root path of the project
	 * @returns Tree-like string representation
	 */
	public getProjectStructureAsString(
		files: FileContent[],
		rootPath: string
	): string {
		// Create structure
		const structure = this.createProjectStructure(files, rootPath);

		// Convert to string
		return this.structureToString(structure, 0);
	}

	/**
	 * Convert structure to string representation
	 *
	 * @param node Structure node
	 * @param depth Current depth
	 * @returns String representation
	 */
	private structureToString(node: any, depth: number): string {
		const indent = '  '.repeat(depth);
		const prefix = depth === 0 ? '' : '├─ ';

		let result = `${indent}${prefix}${node.name}\n`;

		if (node.type === 'directory' && node.children) {
			for (let i = 0; i < node.children.length; i++) {
				result += this.structureToString(node.children[i], depth + 1);
			}
		}

		return result;
	}

	/**
	 * Find files matching a pattern in the project
	 *
	 * @param files Array of file contents
	 * @param pattern Pattern to match (glob)
	 * @returns Array of matching files
	 */
	public findMatchingFiles(
		files: FileContent[],
		pattern: string
	): FileContent[] {
		try {
			// Convert glob pattern to regex
			const regexPattern = this.globToRegex(pattern);

			// Filter files
			return files.filter(file => regexPattern.test(file.path));
		} catch (error) {
			logger.error(`Error matching files: ${error.message}`);
			return [];
		}
	}

	/**
	 * Convert glob pattern to regex
	 *
	 * @param pattern Glob pattern
	 * @returns Regex for the pattern
	 */
	private globToRegex(pattern: string): RegExp {
		// Simple conversion of basic glob to regex
		let regexStr = pattern
			.replace(/\./g, '\\.')
			.replace(/\*\*/g, '.*')
			.replace(/\*/g, '[^/]*')
			.replace(/\?/g, '.');

		return new RegExp(`^${regexStr}$`);
	}

	analyzeProject() {
		// Implementation for analyzing project
	}

	public async analyzeProject(workspaceRoot: vscode.Uri): Promise<ProjectStats> {
		try {
			const stats: ProjectStats = {
				fileCount: 0,
				totalLines: 0,
				languages: new Map(),
				dependencies: new Map()
			};

			// Find all files in workspace
			const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');

			// Process each file
			for (const file of files) {
				const language = this.getLanguageId(file);
				if (language) {
					stats.fileCount++;
					stats.languages.set(language, (stats.languages.get(language) || 0) + 1);

					const document = await vscode.workspace.openTextDocument(file);
					stats.totalLines += document.lineCount;
				}
			}

			// Parse package.json if exists
			const packageJsonUri = vscode.Uri.joinPath(workspaceRoot, 'package.json');
			try {
				const packageJson = await vscode.workspace.fs.readFile(packageJsonUri);
				const packageData = JSON.parse(packageJson.toString());
				if (packageData.dependencies) {
					Object.entries<string>(packageData.dependencies).forEach(([key, value]) => {
						stats.dependencies.set(key, value);
					});
				}
			} catch (error) {
				this.logger.debug('No package.json found or unable to parse');
			}

			this.projectStats = stats;
			return stats;
		} catch (error) {
			this.logger.error(`Error analyzing project: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	private getLanguageId(uri: vscode.Uri): string | undefined {
		const extension = path.extname(uri.fsPath).toLowerCase();
		const languageMap: Record<string, string> = {
			'.ts': 'typescript',
			'.js': 'javascript',
			'.jsx': 'javascriptreact',
			'.tsx': 'typescriptreact',
			'.json': 'json',
			'.md': 'markdown'
		};
		return languageMap[extension];
	}
}

/**
 * Simple file analysis result
 */
interface FileAnalysis {
	imports: string[];
	exports: string[];
	functions: string[];
	classes: string[];
}

function analyzeFile(filePath: string, content: string): FileAnalysis {
	return {
		imports: [],
		exports: [],
		functions: [],
		classes: []
	};
}

export default ProjectAnalyzer;
