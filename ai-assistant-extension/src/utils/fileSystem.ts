import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from './logger';

export interface FileSystemOperationResult {
	success: boolean;
	error?: string;
}

export class FileSystem {
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

	public async writeFile(uri: vscode.Uri, content: string): Promise<FileSystemOperationResult> {
		try {
			const data = Buffer.from(content, 'utf-8');
			await vscode.workspace.fs.writeFile(uri, data);
			return { success: true };
		} catch (error) {
			const message = `Failed to write file ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`;
			this.logger.error(message);
			return { success: false, error: message };
		}
	}

	public async deleteFile(uri: vscode.Uri): Promise<FileSystemOperationResult> {
		try {
			await vscode.workspace.fs.delete(uri);
			return { success: true };
		} catch (error) {
			const message = `Failed to delete file ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`;
			this.logger.error(message);
			return { success: false, error: message };
		}
	}

	public async fileExists(uri: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(uri);
			return true;
		} catch {
			return false;
		}
	}

	public async createDirectory(uri: vscode.Uri): Promise<FileSystemOperationResult> {
		try {
			await vscode.workspace.fs.createDirectory(uri);
			return { success: true };
		} catch (error) {
			const message = `Failed to create directory ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`;
			this.logger.error(message);
			return { success: false, error: message };
		}
	}
}
