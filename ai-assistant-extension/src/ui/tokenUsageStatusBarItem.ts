import * as vscode from 'vscode';
import { TokenUsageTracker } from '../utils/tokenUsageTracker';
import { Logger } from '../utils/logger';

interface StatusBarOptions {
	showTotal?: boolean;
	showDaily?: boolean;
	updateInterval?: number;
}

export class TokenUsageStatusBarItem implements vscode.Disposable {
	private readonly statusBarItem: vscode.StatusBarItem;
	private readonly tracker: TokenUsageTracker;
	private readonly logger: Logger;
	private updateInterval: NodeJS.Timer | undefined;

	constructor(tracker: TokenUsageTracker, logger: Logger, options: StatusBarOptions = {}) {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.tracker = tracker;
		this.logger = logger;

		this.statusBarItem.command = 'aiAssistant.showTokenUsage';
		this.updateUsage();

		if (options.updateInterval) {
			this.updateInterval = setInterval(() => this.updateUsage(), options.updateInterval);
		}

		this.statusBarItem.show();
	}

	private updateUsage(): void {
		try {
			const usage = this.tracker.getTotalUsage();
			this.statusBarItem.text = `$(symbol-numeric) ${usage.totalTokens} tokens`;
			this.statusBarItem.tooltip = `Total Tokens: ${usage.totalTokens}\nPrompt Tokens: ${usage.promptTokens}\nCompletion Tokens: ${usage.completionTokens}`;
		} catch (error) {
			this.logger.error(`Error updating token usage: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	public dispose(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}
		this.statusBarItem.dispose();
	}
}
