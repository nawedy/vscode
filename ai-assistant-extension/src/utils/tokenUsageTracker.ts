import * as vscode from 'vscode';

/**
 * Token usage data structure
 */
export interface TokenUsage {
	providerId: string;
	modelId?: string;
	promptTokens: number;
	completionTokens: number;
	timestamp: number;
}

/**
 * Token usage summary
 */
export interface TokenUsageSummary {
	totalPromptTokens: number;
	totalCompletionTokens: number;
	totalTokens: number;
	byProvider: Record<string, {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
		byModel: Record<string, {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		}>;
	}>;
}

/**
 * Tracks token usage across different providers and models
 */
export class TokenUsageTracker {
	private readonly context: vscode.ExtensionContext;
	private readonly storageKey = 'ai-assistant.tokenUsage';
	private usage: TokenUsage[] = [];
	private readonly changeEmitter = new vscode.EventEmitter<TokenUsageSummary>();

	/**
	 * Event that fires when token usage changes
	 */
	public readonly onDidChangeTokenUsage = this.changeEmitter.event;

	/**
	 * Create a new token usage tracker
	 * @param context Extension context for storage
	 */
	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.loadUsage();
	}

	/**
	 * Load token usage from storage
	 */
	private loadUsage(): void {
		const storedUsage = this.context.globalState.get<TokenUsage[]>(this.storageKey);
		if (storedUsage) {
			this.usage = storedUsage;
		}
	}

	/**
	 * Save token usage to storage
	 */
	private saveUsage(): void {
		this.context.globalState.update(this.storageKey, this.usage);
	}

	/**
	 * Record prompt tokens
	 * @param providerId Provider ID
	 * @param tokens Number of tokens
	 * @param modelId Optional model ID
	 */
	public recordPromptTokens(providerId: string, tokens: number, modelId?: string): void {
		this.usage.push({
			providerId,
			modelId,
			promptTokens: tokens,
			completionTokens: 0,
			timestamp: Date.now()
		});
		this.saveUsage();
		this.changeEmitter.fire(this.getSummary());
	}

	/**
	 * Record completion tokens
	 * @param providerId Provider ID
	 * @param tokens Number of tokens
	 * @param modelId Optional model ID
	 */
	public recordCompletionTokens(providerId: string, tokens: number, modelId?: string): void {
		this.usage.push({
			providerId,
			modelId,
			promptTokens: 0,
			completionTokens: tokens,
			timestamp: Date.now()
		});
		this.saveUsage();
		this.changeEmitter.fire(this.getSummary());
	}

	/**
	 * Record both prompt and completion tokens
	 * @param providerId Provider ID
	 * @param promptTokens Number of prompt tokens
	 * @param completionTokens Number of completion tokens
	 * @param modelId Optional model ID
	 */
	public recordTokens(providerId: string, promptTokens: number, completionTokens: number, modelId?: string): void {
		this.usage.push({
			providerId,
			modelId,
			promptTokens,
			completionTokens,
			timestamp: Date.now()
		});
		this.saveUsage();
		this.changeEmitter.fire(this.getSummary());
	}

	/**
	 * Get token usage history
	 * @returns Array of token usage entries
	 */
	public getUsageHistory(): TokenUsage[] {
		return [...this.usage];
	}

	/**
	 * Get usage summary
	 * @returns Token usage summary
	 */
	public getSummary(): TokenUsageSummary {
		let totalPromptTokens = 0;
		let totalCompletionTokens = 0;

		const byProvider: TokenUsageSummary['byProvider'] = {};

		// Calculate totals
		for (const entry of this.usage) {
			totalPromptTokens += entry.promptTokens;
			totalCompletionTokens += entry.completionTokens;

			// Initialize provider if not exists
			if (!byProvider[entry.providerId]) {
				byProvider[entry.providerId] = {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0,
					byModel: {}
				};
			}

			// Update provider stats
			byProvider[entry.providerId].promptTokens += entry.promptTokens;
			byProvider[entry.providerId].completionTokens += entry.completionTokens;
			byProvider[entry.providerId].totalTokens += entry.promptTokens + entry.completionTokens;

			// Update model stats if model ID is available
			const modelId = entry.modelId || 'unknown';
			if (!byProvider[entry.providerId].byModel[modelId]) {
				byProvider[entry.providerId].byModel[modelId] = {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				};
			}

			byProvider[entry.providerId].byModel[modelId].promptTokens += entry.promptTokens;
			byProvider[entry.providerId].byModel[modelId].completionTokens += entry.completionTokens;
			byProvider[entry.providerId].byModel[modelId].totalTokens += entry.promptTokens + entry.completionTokens;
		}

		return {
			totalPromptTokens,
			totalCompletionTokens,
			totalTokens: totalPromptTokens + totalCompletionTokens,
			byProvider
		};
	}

	/**
	 * Clear token usage history
	 * @param providerId Optional provider ID to clear only that provider's usage
	 */
	public clearUsage(providerId?: string): void {
		if (providerId) {
			this.usage = this.usage.filter(entry => entry.providerId !== providerId);
		} else {
			this.usage = [];
		}
		this.saveUsage();
		this.changeEmitter.fire(this.getSummary());
	}
}
