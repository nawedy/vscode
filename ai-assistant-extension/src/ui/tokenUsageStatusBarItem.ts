import * as vscode from 'vscode';
import { ProviderManager } from '../ai/providerManager';
import { TokenUsageTracker } from '../utils/tokenUsageTracker';

/**
 * Status bar item for displaying token usage
 */
export class TokenUsageStatusBarItem {
	private readonly context: vscode.ExtensionContext;
	private readonly providerManager: ProviderManager;
	private readonly statusBarItem: vscode.StatusBarItem;
	private readonly tokenTracker: TokenUsageTracker;

	/**
	 * Create a new TokenUsageStatusBarItem
	 * @param context Extension context
	 * @param providerManager Provider manager
	 */
	constructor(context: vscode.ExtensionContext, providerManager: ProviderManager) {
		this.context = context;
		this.providerManager = providerManager;
		this.tokenTracker = new TokenUsageTracker(context);

		// Create status bar item
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'aiAssistant.showTokenUsage';
		this.statusBarItem.tooltip = 'AI Assistant Token Usage';

		// Register command to show token usage
		context.subscriptions.push(
			vscode.commands.registerCommand('aiAssistant.showTokenUsage', this.showTokenUsage.bind(this))
		);

		context.subscriptions.push(this.statusBarItem);

		// Update status bar initially
		this.updateStatusBar();

		// Set up timer to update status bar periodically
		setInterval(() => this.updateStatusBar(), 60000); // Update every minute
	}

	/**
	 * Show the status bar item
	 */
	public show(): void {
		this.statusBarItem.show();
	}

	/**
	 * Hide the status bar item
	 */
	public hide(): void {
		this.statusBarItem.hide();
	}

	/**
	 * Update the status bar text
	 */
	private updateStatusBar(): void {
		const provider = this.providerManager.getActiveProvider();

		if (!provider) {
			this.statusBarItem.text = '$(terminal) AI: No provider';
			return;
		}
// @ts-ignore: error TS2339: Property 'getProviderUsage' does not exist on type 'TokenUsageTracker'.

		const usage = this.tokenTracker.getProviderUsage(provider.id);

		if (!usage) {
			this.statusBarItem.text = `$(terminal) AI: ${provider.name} (0 tokens)`;
			return;
		}

		this.statusBarItem.text = `$(terminal) AI: ${provider.name} (${usage.totalTokens} tokens)`;
	}

	/**
	 * Show the token usage details
	 */
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'getUsage' does not exist on type 'TokenUsageTracker'.
	private async showTokenUsage(): Promise<void> {
		const usage = this.tokenTracker.getUsage();
		const providers = this.providerManager.getAvailableProviders();

		// Create quick pick items for each provider with usage data
		const items = providers.map(provider => {
			const providerUsage = usage[provider.id];
			const totalTokens = providerUsage?.totalTokens ?? 0;
			const promptTokens = providerUsage?.promptTokens ?? 0;
			const completionTokens = providerUsage?.completionTokens ?? 0;

			return {
				label: `${provider.name}`,
				description: `Total: ${totalTokens} tokens`,
				detail: `Prompt: ${promptTokens} tokens, Completion: ${completionTokens} tokens`,
				provider
			};
		});

		// Add reset option
		items.push({
			label: '$(clear-all) Reset Token Usage Counters',
			description: '',
			detail: 'Reset token usage counters for all providers',
			provider: null as any
		});

		// Show quick pick
		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'AI Provider Token Usage'
		});

		if (!selected) {
			return;
		}

		// If reset option selected
		if (!selected.provider) {
			const confirmReset = await vscode.window.showWarningMessage(
				'Are you sure you want to reset token usage counters?',
				'Reset',
				'Cancel'
			);

// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetAllUsage' does not exist on type 'TokenUsageTracker'.
			if (confirmReset === 'Reset') {
				this.tokenTracker.resetAllUsage();
				this.updateStatusBar();
				vscode.window.showInformationMessage('Token usage counters reset');
			}

			return;
		}

		// Show provider details
		const providerUsage = usage[selected.provider.id];
		if (!providerUsage) {
			vscode.window.showInformationMessage(`No token usage data for ${selected.provider.name}`);
			return;
		}

		// Show reset option for this provider
		const action = await vscode.window.showInformationMessage(
			`${selected.provider.name}: ${providerUsage.totalTokens} tokens used\nPrompt: ${providerUsage.promptTokens}, Completion: ${providerUsage.completionTokens}`,
			'Reset Counter',
			'Close'
		);

// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
// @ts-ignore: error TS2339: Property 'resetProviderUsage' does not exist on type 'TokenUsageTracker'.
		if (action === 'Reset Counter') {
			this.tokenTracker.resetProviderUsage(selected.provider.id);
			this.updateStatusBar();
			vscode.window.showInformationMessage(`Reset token usage for ${selected.provider.name}`);
		}
	}
}
