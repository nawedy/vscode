/**
 * File System Utilities
 *
 * Helper functions for working with files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Check if a file or directory exists
 * @param path Path to check
 * @returns True if the path exists
 */
export function pathExists(path: string): boolean {
	return fs.existsSync(path);
}

/**
 * Check if a path is a directory
 * @param path Path to check
 * @returns True if the path is a directory
 */
export function isDirectory(path: string): boolean {
	try {
		return fs.statSync(path).isDirectory();
	} catch {
		return false;
	}
}

/**
 * Check if a path is a file
 * @param path Path to check
 * @returns True if the path is a file
 */
export function isFile(path: string): boolean {
	try {
		return fs.statSync(path).isFile();
	} catch {
		return false;
	}
}

/**
 * Read a file as text
 * @param path File path
 * @returns File content as string
 */
export function readFileText(path: string): string {
	return fs.readFileSync(path, 'utf8');
}

/**
 * Read a file as JSON
 * @param path File path
 * @returns Parsed JSON
 */
export function readJsonFile<T>(path: string): T {
	return JSON.parse(readFileText(path));
}

/**
 * Write text to a file
 * @param path File path
 * @param content Text content
 */
export function writeFileText(path: string, content: string): void {
	fs.writeFileSync(path, content, 'utf8');
}

/**
 * Find files by glob pattern
 * @param pattern Glob pattern
 * @param base Base directory
 * @returns Array of file paths
 */
export async function findFiles(pattern: string, base?: string): Promise<string[]> {
	if (!base && vscode.workspace.workspaceFolders?.length) {
		base = vscode.workspace.workspaceFolders[0].uri.fsPath;
	}

	if (!base) {
		return [];
	}

	// Using VSCode API to find files
	const files = await vscode.workspace.findFiles(
		new vscode.RelativePattern(base, pattern),
		'**/node_modules/**'
	);

	return files.map(f => f.fsPath);
}
