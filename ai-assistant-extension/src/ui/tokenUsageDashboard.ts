import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { TokenUsageTracker } from '../utils/tokenUsageTracker';
import { ProviderManager } from '../ai/providerManager';
import { Logger } from '../utils/logger';

/**
 * Dashboard for displaying token usage analytics
 */
export class TokenUsageDashboard {
	private readonly context: vscode.ExtensionContext;
	private readonly webviewManager: WebviewManager;
	private readonly tokenTracker: TokenUsageTracker;
	private readonly providerManager: ProviderManager;
	private readonly logger: Logger;

	private static readonly viewType = 'aiAssistant.tokenUsageDashboard';
	private static readonly viewTitle = 'AI Assistant Token Usage';

	/**
	 * Create a new TokenUsageDashboard
	 * @param context Extension context
	 * @param webviewManager Webview manager
	 * @param tokenTracker Token usage tracker
	 * @param providerManager Provider manager
	 * @param logger Logger
	 */
	constructor(
		context: vscode.ExtensionContext,
		webviewManager: WebviewManager,
		tokenTracker: TokenUsageTracker,
		providerManager: ProviderManager,
		logger: Logger
	) {
		this.context = context;
		this.webviewManager = webviewManager;
		this.tokenTracker = tokenTracker;
		this.providerManager = providerManager;
		this.logger = logger;
	}

	/**
	 * Show the token usage dashboard
	 */
	public show(): void {
		this.logger.info('Opening token usage dashboard');

		const panel = this.webviewManager.createOrShowWebview(
			'tokenUsageDashboard',
			{
				title: TokenUsageDashboard.viewTitle,
				viewType: TokenUsageDashboard.viewType,
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: true,
				enableScripts: true
			},
			this.generateHtml(),
			(message) => this.handleWebviewMessage(message)
		);
	}

	/**
	 * Generate HTML content for the dashboard
	 * @returns HTML content
	 */
	private generateHtml(): string {
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
		// Get usage data
		const usage = this.tokenTracker.getUsage();
		const providers = this.providerManager.getAvailableProviders();

		// Create usage summary
		let totalPromptTokens = 0;
		let totalCompletionTokens = 0;
		let totalCost = 0;

		// Create provider usage entries
		const providerEntries = providers.map(provider => {
			const providerUsage = usage[provider.id] || {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
				lastUpdated: 0
			};

			// Calculate cost estimate (very rough approximation)
			const costPerThousandPrompt = this.getEstimatedCostPerThousandTokens(provider.id, 'prompt');
			const costPerThousandCompletion = this.getEstimatedCostPerThousandTokens(provider.id, 'completion');

			const promptCost = (providerUsage.promptTokens / 1000) * costPerThousandPrompt;
			const completionCost = (providerUsage.completionTokens / 1000) * costPerThousandCompletion;
			const totalProviderCost = promptCost + completionCost;

			// Update total counts
			totalPromptTokens += providerUsage.promptTokens;
			totalCompletionTokens += providerUsage.completionTokens;
			totalCost += totalProviderCost;

			// Format last updated date
			const lastUpdated = providerUsage.lastUpdated
				? new Date(providerUsage.lastUpdated).toLocaleString()
				: 'Never';

			return `
				<div class="provider-card">
					<div class="provider-header">
						<h3>${provider.name}</h3>
						<span class="last-updated">Last used: ${lastUpdated}</span>
					</div>
					<div class="provider-body">
						<div class="stat-item">
							<div class="stat-label">Prompt Tokens</div>
							<div class="stat-value">${providerUsage.promptTokens.toLocaleString()}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Completion Tokens</div>
							<div class="stat-value">${providerUsage.completionTokens.toLocaleString()}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Total Tokens</div>
							<div class="stat-value total">${providerUsage.totalTokens.toLocaleString()}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">Estimated Cost</div>
							<div class="stat-value cost">$${totalProviderCost.toFixed(4)}</div>
						</div>
					</div>
					<div class="provider-footer">
						<button class="reset-button" data-provider="${provider.id}">Reset Counter</button>
					</div>
				</div>
			`;
		}).join('');

		// Calculate total usage
		const totalTokens = totalPromptTokens + totalCompletionTokens;

		// Create summary panel
		const summaryPanel = `
			<div class="summary-panel">
				<h2>Total Usage</h2>
				<div class="summary-stats">
					<div class="summary-stat">
						<div class="summary-label">Prompt Tokens</div>
						<div class="summary-value">${totalPromptTokens.toLocaleString()}</div>
					</div>
					<div class="summary-stat">
						<div class="summary-label">Completion Tokens</div>
						<div class="summary-value">${totalCompletionTokens.toLocaleString()}</div>
					</div>
					<div class="summary-stat">
						<div class="summary-label">Total Tokens</div>
						<div class="summary-value total">${totalTokens.toLocaleString()}</div>
					</div>
					<div class="summary-stat">
						<div class="summary-label">Estimated Cost</div>
						<div class="summary-value cost">$${totalCost.toFixed(2)}</div>
					</div>
				</div>
				<button class="reset-all-button">Reset All Counters</button>
			</div>
		`;

		const styleUri = vscode.Uri.joinPath(
			this.context.extensionUri,
			'media',
			'styles.css'
		);

		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>AI Assistant Token Usage</title>
				<link rel="stylesheet" href="${styleUri}">
				<style>
					.dashboard {
						max-width: 1200px;
						margin: 0 auto;
					}

					.summary-panel {
						padding: 16px;
						margin-bottom: 20px;
						border: 1px solid var(--vscode-panel-border);
						border-radius: 4px;
						background-color: var(--vscode-editor-inactiveSelectionBackground);
					}

					.summary-stats {
						display: flex;
						flex-wrap: wrap;
						gap: 16px;
						margin-bottom: 16px;
					}

					.provider-cards {
						display: grid;
						grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
						gap: 20px;
					}

					.provider-card {
						border: 1px solid var(--vscode-panel-border);
						border-radius: 4px;
						overflow: hidden;
						display: flex;
						flex-direction: column;
					}

					.provider-header {
						padding: 12px;
						background-color: var(--vscode-sideBarSectionHeader-background);
						border-bottom: 1px solid var(--vscode-panel-border);
						display: flex;
						justify-content: space-between;
						align-items: center;
					}

					.last-updated {
						font-size: 12px;
						color: var(--vscode-descriptionForeground);
					}
				</style>
			</head>
			<body>
				<div class="dashboard">
					<h1>Token Usage Dashboard</h1>
					${summaryPanel}
					<h2>Provider Usage</h2>
					<div class="provider-cards">
						${providerEntries.length > 0 ? providerEntries : '<div class="empty-state">No token usage data available</div>'}
					</div>
				</div>

				<script>
					(function() {
						const vscode = acquireVsCodeApi();

						// Get all reset buttons
						const resetButtons = document.querySelectorAll('.reset-button');
						resetButtons.forEach(button => {
							button.addEventListener('click', () => {
								const providerId = button.getAttribute('data-provider');
								if (providerId) {
									vscode.postMessage({
										command: 'resetProvider',
										providerId: providerId
									});
								}
							});
						});

						// Reset all button
						const resetAllButton = document.querySelector('.reset-all-button');
						if (resetAllButton) {
							resetAllButton.addEventListener('click', () => {
								vscode.postMessage({
									command: 'resetAll'
								});
							});
						}
					})();
				</script>
			</body>
			</html>
		`;
	}

	/**
	 * Handle messages from the webview
	 * @param message Message from webview
	 */
	private async handleWebviewMessage(message: any): Promise<void> {
		switch (message.command) {
			case 'resetProvider':
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
				if (message.providerId) {
					this.tokenTracker.resetProviderUsage(message.providerId);
					this.refreshDashboard();
					vscode.window.showInformationMessage(`Reset token count for provider: ${message.providerId}`);
				}
				break;

// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
			case 'resetAll':
				this.tokenTracker.resetAllUsage();
				this.refreshDashboard();
				vscode.window.showInformationMessage('Reset all token counts');
				break;
		}
	}

	/**
	 * Refresh the dashboard content
	 */
	private refreshDashboard(): void {
		this.webviewManager.postMessage('tokenUsageDashboard', {
			command: 'refreshContent',
			html: this.generateHtml()
		});
	}

	/**
	 * Get estimated cost per 1000 tokens for a provider
	 * @param providerId Provider ID
	 * @param tokenType 'prompt' or 'completion'
	 * @returns Estimated cost per 1000 tokens
	 */
	private getEstimatedCostPerThousandTokens(providerId: string, tokenType: 'prompt' | 'completion'): number {
		// These are rough estimates based on common pricing
		switch (providerId) {
			case 'openai':
				return tokenType === 'prompt' ? 0.0015 : 0.002; // GPT-3.5 rates
			case 'anthropic':
				return tokenType === 'prompt' ? 0.008 : 0.024; // Claude rates
			case 'mistral':
				return tokenType === 'prompt' ? 0.0025 : 0.0075; // Mistral medium rates
			case 'qwen':
				return tokenType === 'prompt' ? 0.001 : 0.0015; // Qwen rates (approximation)
			default:
				return tokenType === 'prompt' ? 0.001 : 0.002; // Default fallback
		}
	}
}
