import { Logger } from './logger';
import { TokenCounter } from './tokenCounter';
import { ModelProvider } from '../ai/providers/baseProvider';

/**
 * Text chunk with metadata
 */
interface TextChunk {
	content: string;
	priority: number;  // 0-100, higher means more important
	estimatedTokens?: number;
}

/**
 * Section types for prioritization
 */
enum SectionType {
	CodeContent = 'code',
	ImportantComment = 'importantComment',
	Comment = 'comment',
	Documentation = 'documentation',
	Error = 'error',
	Metadata = 'metadata'
}

/**
 * Options for token optimization
 */
export interface TokenOptimizationOptions {
	maxTokens: number;
	preserveStructure?: boolean;
	includeSummary?: boolean;
	prioritizeErrors?: boolean;
}

export interface OptimizationResult {
    optimizedText: string;
    originalTokens: number;
    optimizedTokens: number;
    reductionPercentage: number;
}

/**
 * Optimizes content to fit within token limits
 */
export class TokenOptimizer {
	private readonly tokenCounter: TokenCounter;

	constructor(
		private readonly provider: ModelProvider,
		private readonly logger: Logger
	) {
		this.tokenCounter = new TokenCounter(provider);
	}

	public async optimizeText(text: string, maxTokens: number): Promise<OptimizationResult> {
		const originalTokens = await this.tokenCounter.countPromptTokens(text);

		if (originalTokens <= maxTokens) {
			return {
				optimizedText: text,
				originalTokens,
				optimizedTokens: originalTokens,
				reductionPercentage: 0
			};
		}

		const optimizedText = await this.truncateToTokenLimit(text, maxTokens);
		const optimizedTokens = await this.tokenCounter.countPromptTokens(optimizedText);

		return {
			optimizedText,
			originalTokens,
			optimizedTokens,
			reductionPercentage: ((originalTokens - optimizedTokens) / originalTokens) * 100
		};
	}

	private async truncateToTokenLimit(text: string, maxTokens: number): Promise<string> {
		// Simple truncation strategy - could be made more sophisticated
		const words = text.split(' ');
		let result = '';
		let currentTokens = 0;

		for (const word of words) {
			const nextPart = result ? ' ' + word : word;
			const tokensWithNext = await this.tokenCounter.countPromptTokens(result + nextPart);

			if (tokensWithNext <= maxTokens) {
				result += nextPart;
				currentTokens = tokensWithNext;
			} else {
				break;
			}
		}

		return result;
	}
}
