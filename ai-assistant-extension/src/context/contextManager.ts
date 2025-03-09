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
import { FileParser } from './fileParser';
import { DependencyGraph } from './dependencyGraph';
import { ProjectAnalyzer } from './projectAnalyzer';

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
 * File information
 */
export interface FileInfo {
	uri: vscode.Uri;
	content: string;
	language: string;
	version: number;
}

/**
 * Project information
 */
export interface ProjectInfo {
	name: string;
	languages: Set<string>;
	dependencies: Map<string, string>;
	devDependencies: Map<string, string>;
}

/**
 * Context information
 */
export interface ContextInfo {
	currentFile?: FileInfo;
	relatedFiles: FileInfo[];
	projectInfo?: ProjectInfo;
	gitInfo?: {
		branch: string;
		remotes: string[];
	};
}

/**
 * Manages contextual information about the project
 */
export class ContextManager {
	private readonly fileWatcher: FileWatcher;
	private readonly fileParser: FileParser;
	private readonly dependencyGraph: DependencyGraph;
	private readonly projectAnalyzer: ProjectAnalyzer;
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
		this.fileWatcher = new FileWatcher(logger);
		this.fileParser = new FileParser(logger);
		this.dependencyGraph = new DependencyGraph(logger);
		this.projectAnalyzer = new ProjectAnalyzer(logger);
	}

	// ...rest of implementation...
}
