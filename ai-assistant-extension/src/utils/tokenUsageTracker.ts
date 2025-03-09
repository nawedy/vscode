import * as vscode from 'vscode';
import { Logger } from './logger';
import { ModelProvider } from '../ai/providers/baseProvider';

/**
 * Token usage data structure
 */
export interface TokenUsage {
	providerId: string;
	modelId?: string;
	promptTokens: number;
	completionTokens: number;
	timestamp: number;
	totalTokens: number;
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
 * Token statistics
 */
export interface TokenStats {
	totalUsage: number;
	periodUsage: number;
	averageUsage: number;
}

interface UsageStats {
	periodTokens: number;
	totalTokens: number;
	averageTokens: number;
	usageByDay: Map<string, number>;
}

/**
 * Tracks token usage across different providers and models
 */
export class TokenUsageTracker {
	private readonly context: vscode.ExtensionContext;
	private readonly storageKey = 'ai-assistant.tokenUsage';
	private usage: TokenUsage[] = [];
	private readonly changeEmitter = new vscode.EventEmitter<TokenUsageSummary>();
	private readonly retentionDays: number = 30;
	private readonly logger: Logger;
	private readonly usageHistory: TokenUsage[] = [];

	/**
	 * Event that fires when token usage changes
	 */
	public readonly onDidChangeTokenUsage = this.changeEmitter.event;

	/**
	 * Create a new token usage tracker
	 * @param context Extension context for storage
	 * @param logger Logger instance
	 */
	constructor(context: vscode.ExtensionContext, logger: Logger) {
		this.context = context;
		this.logger = logger;
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
			timestamp: Date.now(),
			totalTokens: tokens
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
			timestamp: Date.now(),
			totalTokens: tokens
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
			timestamp: Date.now(),
			totalTokens: promptTokens + completionTokens
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

	/**
	 * Track token usage
	 * @param usageOrTokens Number of tokens or token usage data
	 * @param completionTokens Optional number of completion tokens
	 * @param modelId Optional model ID
	 * @param providerId Optional provider ID
	 */
	public trackUsage(usage: number): void;
	public trackUsage(usage: Omit<TokenUsage, 'timestamp'>): void;
	public trackUsage(promptTokens: number, completionTokens: number, modelId: string, providerId: string): void;
	public trackUsage(
		usageOrTokens: number | Omit<TokenUsage, 'timestamp'>,
		completionTokens?: number,
		modelId?: string,
		providerId?: string
	): void {
		if (typeof usageOrTokens === 'number') {
			if (completionTokens !== undefined && modelId && providerId) {
				// Handle 4-parameter version
				const usage: TokenUsage = {
					promptTokens: usageOrTokens,
					completionTokens,
					totalTokens: usageOrTokens + completionTokens,
					timestamp: Date.now(),
					modelId,
					providerId
				};
				this.usageHistory.push(usage);
			} else {
				// Handle single number version
				this.usageHistory.push({
					promptTokens: usageOrTokens,
					completionTokens: 0,
					totalTokens: usageOrTokens,
					timestamp: Date.now(),
					providerId: 'unknown'
				});
			}
		} else {
			// Handle object version
			this.usageHistory.push({
				...usageOrTokens,
				timestamp: Date.now()
			});
		}
		this.pruneOldEntries();
	}

	/**
	 * Get token statistics
	 * @param periodDays Number of days for the period
	 * @returns Token statistics
	 */
	public getStats(periodDays: number = 30): TokenStats {
		const now = Date.now();
		const periodStart = now - (periodDays * 24 * 60 * 60 * 1000);

		const stats: UsageStats = {
			periodTokens: 0,
			totalTokens: 0,
			averageTokens: 0,
			usageByDay: new Map()
		};

		// Calculate usage
		this.usageHistory.forEach(entry => {
			stats.totalTokens += entry.totalTokens;
			if (entry.timestamp >= periodStart) {
				stats.periodTokens += entry.totalTokens;
				const day = new Date(entry.timestamp).toISOString().split('T')[0];
				stats.usageByDay.set(day, (stats.usageByDay.get(day) || 0) + entry.totalTokens);
			}
		});

		stats.averageTokens = stats.periodTokens / periodDays;

		return {
			totalUsage: stats.totalTokens,
			periodUsage: stats.periodTokens,
			averageUsage: stats.averageTokens
		};
	}

	/**
	 * Prune old entries from usage history
	 */
	private pruneOldEntries(): void {
		const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
		const index = this.usageHistory.findIndex(entry => entry.timestamp >= cutoff);

		if (index > 0) {
			this.usageHistory.splice(0, index);
		}
	}

	/**
	 * Get total usage
	 * @returns Total usage
	 */
	public getTotalUsage(): { promptTokens: number; completionTokens: number; totalTokens: number } {
		return this.usageHistory.reduce((acc, curr) => ({
			promptTokens: acc.promptTokens + curr.promptTokens,
			completionTokens: acc.completionTokens + curr.completionTokens,
			totalTokens: acc.totalTokens + curr.totalTokens
		}), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
	}

	/**
	 * Clear usage history
	 */
	public clearHistory(): void {
		this.usageHistory = [];
	}
}
