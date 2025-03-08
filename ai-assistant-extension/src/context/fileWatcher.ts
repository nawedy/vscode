/**
 * File Watcher
 *
 * Watches for file changes in the workspace and emits events.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * File change event type
 */
export enum FileChangeType {
	Created = 1,
	Changed = 2,
	Deleted = 3
}

/**
 * File change event
 */
export interface FileChangeEvent {
	/**
	 * The URI of the file that changed
	 */
	uri: vscode.Uri;

	/**
	 * The type of change
	 */
	type: FileChangeType;
}

/**
 * Watches for file changes in the workspace
 */
export class FileWatcher implements vscode.Disposable {
	private readonly logger: Logger;
	private readonly watcher: vscode.FileSystemWatcher;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly onFileChangedEmitter = new vscode.EventEmitter<FileChangeEvent>();

	/**
	 * Event that fires when a file is changed
	 * @note This was renamed from onFileChange to onFileChanged to match implementation
	 */
	public readonly onFileChanged = this.onFileChangedEmitter.event;

	/**
	 * Create a new file watcher
	 * @param logger Logger instance
	 * @param globPatterns Glob patterns to watch, defaults to all files
	 * @param ignorePatterns Patterns to ignore
	 */
	constructor(
		logger: Logger,
		globPatterns: string[] = ['**/*'],
		ignorePatterns: string[] = ['**/node_modules/**', '**/dist/**', '**/out/**']
	) {
		this.logger = logger;
		this.logger.info('Initializing file watcher');

		// Create file system watcher
		this.watcher = vscode.workspace.createFileSystemWatcher(
			`{${globPatterns.join(',')}}`,
			false, // Don't ignore create events
			false, // Don't ignore change events
			false  // Don't ignore delete events
		);

		// Handle file events
		this.disposables.push(
			this.watcher.onDidCreate(uri => this.handleFileChange(uri, FileChangeType.Created)),
			this.watcher.onDidChange(uri => this.handleFileChange(uri, FileChangeType.Changed)),
			this.watcher.onDidDelete(uri => this.handleFileChange(uri, FileChangeType.Deleted))
		);
	}

	/**
	 * Handle a file change event
	 * @param uri File URI
	 * @param type Change type
	 */
	private handleFileChange(uri: vscode.Uri, type: FileChangeType): void {
		try {
			// Check if file matches ignore patterns
			if (this.shouldIgnore(uri)) {
				return;
			}

			// Log and emit event
			const fileName = path.basename(uri.fsPath);
			this.logger.debug(`File ${fileName} ${FileChangeType[type].toLowerCase()}`);

			this.onFileChangedEmitter.fire({
				uri,
				type
			});
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error handling file change: ${errorMessage}`);
		}
	}

	/**
	 * Check if a file should be ignored
	 * @param uri File URI
	 * @returns Whether the file should be ignored
	 */
	private shouldIgnore(uri: vscode.Uri): boolean {
		// Ignore non-file schemes
		if (uri.scheme !== 'file') {
			return true;
		}

		// Implement pattern matching for ignores as needed
		// For now, just ignore dot files/folders
		const fileName = path.basename(uri.fsPath);
		if (fileName.startsWith('.')) {
			return true;
		}

		return false;
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.watcher.dispose();
	}
}
