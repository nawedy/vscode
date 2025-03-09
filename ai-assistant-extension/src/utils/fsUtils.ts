/**
 * File System Utilities
 *
 * Helper functions for working with files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from './logger';

interface FileStat {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modifiedTime: number;
}

interface FileInfo {
	path: string;
	name: string;
	extension: string;
	size: number;
	lastModified: number;
	isDirectory: boolean;
}

interface WriteOptions {
	create?: boolean;
	overwrite?: boolean;
	encoding?: BufferEncoding;
}

interface WriteFileOptions {
	create?: boolean;
	overwrite?: boolean;
	encoding?: BufferEncoding;
}

interface FileOperation {
	uri: vscode.Uri;
	type: 'create' | 'delete' | 'rename';
	content?: string | Uint8Array;
	target?: vscode.Uri;
}

export interface FSOperation {
	type: 'read' | 'write' | 'delete' | 'create';
	path: string;
	success: boolean;
	error?: string;
}

export class FSUtils {
	constructor(private readonly logger: Logger) {}

	public async readFile(uri: vscode.Uri): Promise<string> {
		try {
			const content = await vscode.workspace.fs.readFile(uri);
			return Buffer.from(content).toString('utf-8');
		} catch (error) {
			this.logger.error(`Failed to read file ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public async writeFile(uri: vscode.Uri, content: string): Promise<void> {
		try {
			const data = Buffer.from(content, 'utf-8');
			await vscode.workspace.fs.writeFile(uri, data);
		} catch (error) {
			this.logger.error(`Failed to write file ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public async ensureDirectory(uri: vscode.Uri): Promise<void> {
		try {
			await vscode.workspace.fs.createDirectory(uri);
		} catch (error) {
			// Directory might already exist, which is fine
			if (!(error instanceof vscode.FileSystemError.FileExists)) {
				throw error;
			}
		}
	}

	public async listFiles(uri: vscode.Uri, pattern: string): Promise<vscode.Uri[]> {
		try {
			const files = await vscode.workspace.findFiles(
				new vscode.RelativePattern(uri, pattern),
				'**/node_modules/**'
			);
			return files;
		} catch (error) {
			this.logger.error(`Failed to list files in ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public getRelativePath(from: vscode.Uri, to: vscode.Uri): string {
		return path.relative(from.fsPath, to.fsPath);
	}

	public async fileExists(uri: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(uri);
			return true;
		} catch {
			return false;
		}
	}
}

export async function getFileInfo(filePath: string): Promise<FileInfo> {
	const stats = await fs.stat(filePath);
	const parsedPath = path.parse(filePath);

	return {
		path: filePath,
		name: parsedPath.name,
		extension: parsedPath.ext,
		size: stats.size,
		lastModified: stats.mtimeMs,
		isDirectory: stats.isDirectory()
	};
}

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

export async function listFiles(dir: string, pattern?: RegExp): Promise<FileStat[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const stats: FileStat[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (!pattern || pattern.test(entry.name)) {
			const stat = await fs.stat(fullPath);
			stats.push({
				name: entry.name,
				path: fullPath,
				isDirectory: entry.isDirectory(),
				size: stat.size,
				modifiedTime: stat.mtimeMs
			});
		}
	}

	return stats;
}

export async function ensureDirectory(dir: string): Promise<void> {
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch (error) {
		throw new Error(`Failed to create directory ${dir}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export async function writeFile(
	uri: vscode.Uri,
	content: string | Uint8Array,
	options?: WriteFileOptions
): Promise<void> {
	const data = typeof content === 'string' ? Buffer.from(content) : content;
	await vscode.workspace.fs.writeFile(uri, data);
}

export async function readFile(uri: vscode.Uri): Promise<string> {
	const data = await vscode.workspace.fs.readFile(uri);
	return Buffer.from(data).toString('utf8');
}
