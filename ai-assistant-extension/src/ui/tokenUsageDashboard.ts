import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { WebviewManager } from './webviewManager';
import { TokenUsageTracker } from '../utils/tokenUsageTracker';

interface UsageData {
	totalTokens: number;
	promptTokens: number;
	completionTokens: number;
	byProvider: Record<string, {
		total: number;
		byModel: Record<string, number>;
	}>;
}

export class TokenUsageDashboard {
	private panel: vscode.WebviewPanel | undefined;
	private readonly tracker: TokenUsageTracker;
	private readonly webviewManager: WebviewManager;
	private readonly logger: Logger;

	constructor(
		tracker: TokenUsageTracker,
		webviewManager: WebviewManager,
		logger: Logger
	) {
		this.tracker = tracker;
		this.webviewManager = webviewManager;
		this.logger = logger;
	}

	public show(): void {
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = this.webviewManager.createWebviewPanel({
			title: "Token Usage Dashboard",
			viewType: 'aiAssistant.tokenUsage'
		});

		this.panel.webview.html = this.getWebviewContent();

		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});

		// Update usage data every 30 seconds
		const updateInterval = setInterval(() => {
			if (this.panel) {
				this.updateUsageData();
			} else {
				clearInterval(updateInterval);
			}
		}, 30000);
	}

	private getWebviewContent(): string {
		const usage = this.getUsageData();
		return `<!DOCTYPE html>
<html>
<head>
	<title>Token Usage Dashboard</title>
	<style>
		body { padding: 20px; }
		.usage-card {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-widget-border);
			padding: 15px;
			margin-bottom: 20px;
			border-radius: 4px;
		}
	</style>
</head>
<body>
	<h1>Token Usage</h1>
	<div class="usage-card">
		<h2>Total Usage</h2>
		<p>Total Tokens: ${usage.totalTokens}</p>
		<p>Prompt Tokens: ${usage.promptTokens}</p>
		<p>Completion Tokens: ${usage.completionTokens}</p>
	</div>
	${this.renderProviderUsage(usage.byProvider)}
</body>
</html>`;
	}

	private getUsageData(): UsageData {
		const usage = this.tracker.getTotalUsage();
		const summary = this.tracker.getSummary();

		return {
			totalTokens: usage.totalTokens,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			byProvider: summary.byProvider
		};
	}

	private renderProviderUsage(providerUsage: Record<string, { total: number; byModel: Record<string, number> }>): string {
		return Object.entries(providerUsage)
			.map(([provider, usage]) => `
				<div class="usage-card">
					<h3>${provider}</h3>
					<p>Total: ${usage.total}</p>
					${Object.entries(usage.byModel)
						.map(([model, tokens]) => `<p>${model}: ${tokens}</p>`)
						.join('\n')
					}
				</div>
			`)
			.join('\n');
	}

	private updateUsageData(): void {
		if (this.panel) {
			const usage = this.getUsageData();
			this.panel.webview.postMessage({ type: 'updateUsage', usage });
		}
	}

	public dispose(): void {
		if (this.panel) {
			this.panel.dispose();
		}
	}
}
