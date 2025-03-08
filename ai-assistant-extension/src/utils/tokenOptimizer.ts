import { BaseModelProvider } from '../ai/providers/baseProvider';
import { Logger } from './logger';

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

/**
 * Optimizes content to fit within token limits
 */
export class TokenOptimizer {
	private logger: Logger;
	private provider: BaseModelProvider;

	/**
	 * Create a new TokenOptimizer
	 * @param provider AI provider for token counting
	 * @param logger Logger instance
	 */
	constructor(provider: BaseModelProvider, logger: Logger) {
		this.provider = provider;
		this.logger = logger;
	}

	/**
	 * Optimize content to fit within token limit
	 * @param content Text content to optimize
	 * @param options Optimization options
	 * @returns Optimized content
	 */
	public async optimizeContent(content: string, options: TokenOptimizationOptions): Promise<string> {
		// Check if content is already within limits
		const estimatedTokens = await this.provider.countTokens(content);

		if (estimatedTokens <= options.maxTokens) {
			this.logger.debug(`Content already within token limit (${estimatedTokens}/${options.maxTokens})`);
			return content;
		}

		this.logger.info(`Content exceeds token limit (${estimatedTokens}/${options.maxTokens}), optimizing...`);

		// Split content into logical chunks
		const chunks = this.splitIntoChunks(content);

		// Estimate tokens for each chunk
		await this.estimateChunkTokens(chunks);

		// Apply optimization strategy
		return this.applyOptimizationStrategy(chunks, options);
	}

	/**
	 * Split content into logical chunks
	 * @param content Full content
	 * @returns Array of content chunks with priority levels
	 */
	private splitIntoChunks(content: string): TextChunk[] {
		const chunks: TextChunk[] = [];
		const lines = content.split('\n');

		let currentChunk: TextChunk | null = null;
		let inCodeBlock = false;
		let codeBlockType = '';

		for (const line of lines) {
			// Detect code block boundaries
			if (line.trim().match(/^```(\w*)$/)) {
				if (inCodeBlock) {
					// End of code block
					if (currentChunk) {
						currentChunk.content += line + '\n';
						chunks.push(currentChunk);
					}
					currentChunk = null;
					inCodeBlock = false;
				} else {
					// Start of code block
					if (currentChunk) {
						chunks.push(currentChunk);
					}
					codeBlockType = line.trim().replace(/^```/, '');
					currentChunk = {
						content: line + '\n',
						priority: 80  // Code blocks are high priority
					};
					inCodeBlock = true;
				}
				continue;
			}

			if (inCodeBlock) {
				// Inside code block
				if (currentChunk) {
					currentChunk.content += line + '\n';
				}
				continue;
			}

			// Handle different line types
			if (line.trim().startsWith('// ERROR:') || line.trim().startsWith('// FIXME:') ||
				line.trim().startsWith('// BUG:')) {
				// Error comments get high priority
				chunks.push({
					content: line + '\n',
					priority: 90
				});
			} else if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
				// Comments get medium priority
				if (currentChunk && currentChunk.priority === 40) {
					currentChunk.content += line + '\n';
				} else {
					if (currentChunk) {
						chunks.push(currentChunk);
					}
					currentChunk = {
						content: line + '\n',
						priority: 40
					};
				}
			} else if (line.trim().startsWith('import ') || line.trim().startsWith('using ') ||
				line.trim().startsWith('from ') || line.trim().startsWith('#include')) {
				// Import statements get high priority
				chunks.push({
					content: line + '\n',
					priority: 70
				});
			} else if (line.trim().length === 0) {
				// Empty lines
				if (currentChunk) {
					currentChunk.content += '\n';
				}
			} else {
				// Regular code line
				if (currentChunk && currentChunk.priority === 60) {
					currentChunk.content += line + '\n';
				} else {
					if (currentChunk) {
						chunks.push(currentChunk);
					}
					currentChunk = {
						content: line + '\n',
						priority: 60
					};
				}
			}
		}

		// Add the last chunk if there is one
		if (currentChunk) {
			chunks.push(currentChunk);
		}

		return chunks;
	}

	/**
	 * Estimate token count for each chunk
	 * @param chunks Content chunks
	 */
	private async estimateChunkTokens(chunks: TextChunk[]): Promise<void> {
		for (const chunk of chunks) {
			chunk.estimatedTokens = await this.provider.countTokens(chunk.content);
		}
	}

	/**
	 * Apply optimization strategy based on options
	 * @param chunks Content chunks
	 * @param options Optimization options
	 * @returns Optimized content
	 */
	private async applyOptimizationStrategy(chunks: TextChunk[], options: TokenOptimizationOptions): Promise<string> {
		// Sort chunks by priority (highest first)
		chunks.sort((a, b) => b.priority - a.priority);

		// Calculate how many tokens we need to cut
		const totalTokens = chunks.reduce((sum, chunk) => sum + (chunk.estimatedTokens || 0), 0);
		const excessTokens = totalTokens - options.maxTokens;

		if (excessTokens <= 0) {
			// No optimization needed
			return chunks.map(c => c.content).join('');
		}

		// Reserve tokens for summary if needed
		const summaryTokens = options.includeSummary ? 100 : 0;
		const targetTokens = options.maxTokens - summaryTokens;

		// Remove lower priority chunks until we're within the limit
		let currentTokens = totalTokens;
		const keptChunks: TextChunk[] = [...chunks];

		while (currentTokens > targetTokens && keptChunks.length > 0) {
			// Find lowest priority chunk
			let lowestPriorityIndex = keptChunks.length - 1;

			for (let i = keptChunks.length - 2; i >= 0; i--) {
				if (keptChunks[i].priority < keptChunks[lowestPriorityIndex].priority) {
					lowestPriorityIndex = i;
				}
			}

			// Remove the chunk with lowest priority
			const removedChunk = keptChunks.splice(lowestPriorityIndex, 1)[0];
			currentTokens -= removedChunk.estimatedTokens || 0;

			this.logger.debug(`Removed chunk with priority ${removedChunk.priority}, saving ${removedChunk.estimatedTokens} tokens`);
		}

		// If we need to preserve structure, resort by original position
		if (options.preserveStructure) {
			// We need to infer original position from content
			// This is a simplified approach - for better results we would need to track positions
			const result: string[] = [];
			let inCodeBlock = false;

// @ts-ignore: error TS2552: Cannot find name 'content'. Did you mean 'context'?
			// Process line by line to preserve structure
			for (const line of content.split('\n')) {
				// Handle code block markers
				if (line.trim().match(/^```(\w*)$/)) {
					inCodeBlock = !inCodeBlock;
				}

				// Check if this line is in any of our kept chunks
				const isKept = keptChunks.some(chunk => chunk.content.includes(line));

				if (isKept || inCodeBlock) {
					result.push(line);
				}
			}

			return result.join('\n');
		} else {
			// Just concatenate the kept chunks
			let result = keptChunks.map(c => c.content).join('');

			// Add summary if requested
			if (options.includeSummary) {
				result = `// Note: This content has been optimized to fit within token limits.\n` +
					`// ${chunks.length - keptChunks.length} sections were removed to save ${excessTokens} tokens.\n\n` + result;
			}

			return result;
		}
	}

	/**
	 * Find optimal chunk size for sending content
	 * @param content Full content to split
	 * @param maxTokensPerChunk Maximum tokens per chunk
	 * @returns Array of optimized content chunks
	 */
	public async splitContentIntoChunks(content: string, maxTokensPerChunk: number): Promise<string[]> {
		const estimatedTokens = await this.provider.countTokens(content);

		if (estimatedTokens <= maxTokensPerChunk) {
			// No need to split
			return [content];
		}

		// Split content into paragraphs or logical blocks
		const blocks = content.split('\n\n').filter(block => block.trim().length > 0);
		const result: string[] = [];
		let currentChunk = '';
		let currentChunkTokens = 0;

		for (const block of blocks) {
			const blockTokens = await this.provider.countTokens(block + '\n\n');

			// If adding this block would exceed the limit, start a new chunk
			if (currentChunkTokens + blockTokens > maxTokensPerChunk && currentChunk.length > 0) {
				result.push(currentChunk.trim());
				currentChunk = '';
				currentChunkTokens = 0;
			}

			// If a single block is too large, we need to split it further
			if (blockTokens > maxTokensPerChunk) {
				// For large blocks, we split by sentence or line
				const subBlocks = this.splitBlockByLines(block, maxTokensPerChunk);
				for (const subBlock of subBlocks) {
					result.push(subBlock.trim());
				}
			} else {
				// Add block to current chunk
				currentChunk += block + '\n\n';
				currentChunkTokens += blockTokens;
			}
		}

		// Add the last chunk if it's not empty
		if (currentChunk.trim().length > 0) {
			result.push(currentChunk.trim());
		}

		return result;
	}

	/**
	 * Split a large block into smaller pieces by lines
	 * @param block Large block of text
	 * @param maxTokens Maximum tokens per block
	 * @returns Array of smaller blocks
	 */
	private splitBlockByLines(block: string, maxTokens: number): string[] {
		const lines = block.split('\n');
		const result: string[] = [];
		let currentChunk = '';

		for (const line of lines) {
			// Estimate - this isn't precise but avoids extra API calls
			const estimatedLineTokens = Math.ceil(line.length / 4) + 1;

			// If line would make chunk too large, start a new one
			if (estimatedLineTokens + Math.ceil(currentChunk.length / 4) > maxTokens && currentChunk.length > 0) {
				result.push(currentChunk);
				currentChunk = '';
			}

			// Handle extremely long lines (unlikely but possible)
			if (estimatedLineTokens > maxTokens) {
				// Split by sentence if possible
				const sentences = line.match(/[^.!?]+[.!?]+/g) || [line];
				for (const sentence of sentences) {
					if (Math.ceil(sentence.length / 4) > maxTokens) {
						// If even a sentence is too long, split by character groups
						let sentenceChunk = '';
						for (let i = 0; i < sentence.length; i += maxTokens * 2) {
							result.push(sentence.substring(i, i + maxTokens * 2));
						}
					} else {
						// Add sentence if it fits, otherwise start new chunk
						if (Math.ceil(sentence.length / 4) + Math.ceil(currentChunk.length / 4) > maxTokens) {
							if (currentChunk.length > 0) {
								result.push(currentChunk);
							}
							currentChunk = sentence;
						} else {
							currentChunk += sentence;
						}
					}
				}
			} else {
				// Normal case - add the line to current chunk
				currentChunk += line + '\n';
			}
		}

		// Add the last chunk if not empty
		if (currentChunk.length > 0) {
			result.push(currentChunk);
		}

		return result;
	}
}
