/**
 * File Watcher
 *
 * Watches for file changes in the workspace and emits events.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';

interface FileEvent {
	type: 'create' | 'change' | 'delete';
	uri: vscode.Uri;
	timestamp: number;
}

type FileEventHandler = (event: FileEvent) => void;

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
	private readonly watchers: vscode.FileSystemWatcher[] = [];
	private readonly eventHandlers: Set<FileEventHandler> = new Set();
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
	 * Watch a specific pattern
	 * @param globPattern Glob pattern to watch
	 * @param ignoreCreate Whether to ignore create events
	 * @param ignoreChange Whether to ignore change events
	 * @param ignoreDelete Whether to ignore delete events
	 * @returns The file system watcher
	 */
	public watchPattern(
		globPattern: string,
		ignoreCreate?: boolean,
		ignoreChange?: boolean,
		ignoreDelete?: boolean
	): vscode.FileSystemWatcher {
		const watcher = vscode.workspace.createFileSystemWatcher(
			globPattern,
			!!ignoreCreate,
			!!ignoreChange,
			!!ignoreDelete
		);

		this.watchers.push(watcher);

		watcher.onDidCreate(uri => this.notifyHandlers({ type: 'create', uri, timestamp: Date.now() }));
		watcher.onDidChange(uri => this.notifyHandlers({ type: 'change', uri, timestamp: Date.now() }));
		watcher.onDidDelete(uri => this.notifyHandlers({ type: 'delete', uri, timestamp: Date.now() }));

		return watcher;
	}

	/**
	 * Register a file event handler
	 * @param handler File event handler
	 * @returns Disposable to unregister the handler
	 */
	public onFileEvent(handler: FileEventHandler): vscode.Disposable {
		this.eventHandlers.add(handler);
		return {
			dispose: () => this.eventHandlers.delete(handler)
		};
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
	 * Handle a file event
	 * @param event File event
	 */
	private handleFileEvent(event: FileEvent): void {
		this.eventHandlers.forEach(handler => handler(event));
	}

	/**
	 * Notify handlers of a file event
	 * @param event File event
	 */
	private notifyHandlers(event: FileEvent): void {
		this.eventHandlers.forEach(handler => handler(event));
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
		this.watchers.forEach(watcher => watcher.dispose());
		this.watchers.length = 0;
		this.eventHandlers.clear();
	}
}
