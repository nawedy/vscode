import * as vscode from 'vscode';

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3
}

export interface ILogger {
	debug(message: string): void;
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
	setLevel(level: LogLevel): void;
}

export class Logger implements ILogger {
	private outputChannel: vscode.OutputChannel;
	private level: LogLevel;

	constructor(name: string, level: LogLevel = LogLevel.INFO) {
		this.outputChannel = vscode.window.createOutputChannel(name);
		this.level = level;
	}

	public debug(message: string): void {
		if (this.level <= LogLevel.DEBUG) {
			this.log('DEBUG', message);
		}
	}

	public info(message: string): void {
		if (this.level <= LogLevel.INFO) {
			this.log('INFO', message);
		}
	}

	public warn(message: string): void {
		if (this.level <= LogLevel.WARN) {
			this.log('WARN', message);
		}
	}

	public error(message: string): void {
		if (this.level <= LogLevel.ERROR) {
			this.log('ERROR', message);
		}
	}

	public setLevel(level: LogLevel): void {
		this.level = level;
	}

	private log(level: string, message: string): void {
		const timestamp = new Date().toISOString();
		this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
	}

	public dispose(): void {
		this.outputChannel.dispose();
	}
}
