import * as vscode from 'vscode';

/**
 * Log level enumeration
 */
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3
}

/**
 * Application logger for AI Assistant Extension
 */
export class Logger {
	private readonly outputChannel: vscode.OutputChannel;
	private level: LogLevel = LogLevel.INFO;

	/**
	 * Create a new logger instance
	 * @param name Name of the logger/output channel
	 */
	constructor(name: string = 'AI Assistant') {
		this.outputChannel = vscode.window.createOutputChannel(name);
	}

	/**
	 * Set the log level
	 * @param level The log level to set
	 */
	public setLevel(level: LogLevel): void {
		this.level = level;
	}

	/**
	 * Log a debug message
	 * @param message The message to log
	 * @param data Additional data to log
	 */
	public debug(message: string, data?: any): void {
		if (this.level <= LogLevel.DEBUG) {
			this.log('DEBUG', message, data);
		}
	}

	/**
	 * Log an info message
	 * @param message The message to log
	 * @param data Additional data to log
	 */
	public info(message: string, data?: any): void {
		if (this.level <= LogLevel.INFO) {
			this.log('INFO', message, data);
		}
	}

	/**
	 * Log a warning message
	 * @param message The message to log
	 * @param data Additional data to log
	 */
	public warn(message: string, data?: any): void {
		if (this.level <= LogLevel.WARN) {
			this.log('WARN', message, data);
		}
	}

	/**
	 * Log an error message
	 * @param message The message to log
	 * @param data Additional data to log
	 */
	public error(message: string, data?: any): void {
		if (this.level <= LogLevel.ERROR) {
			this.log('ERROR', message, data);
		}
	}

	/**
	 * Format and log a message
	 * @param level The log level
	 * @param message The message to log
	 * @param data Additional data to log
	 */
	private log(level: string, message: string, data?: any): void {
		const timestamp = new Date().toISOString();
		let logMessage = `[${timestamp}] [${level}] ${message}`;

		if (data !== undefined) {
			if (typeof data === 'object') {
				try {
					logMessage += `\n${JSON.stringify(data, null, 2)}`;
				} catch (e) {
					logMessage += `\n[Object cannot be stringified]`;
				}
			} else {
				logMessage += `\n${data}`;
			}
		}

		this.outputChannel.appendLine(logMessage);
	}

	/**
	 * Show the log output channel
	 */
	public show(): void {
		this.outputChannel.show();
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.outputChannel.dispose();
	}
}

// Create and export a default logger instance
export const logger = new Logger();
