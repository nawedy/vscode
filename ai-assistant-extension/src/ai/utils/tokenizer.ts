import { Logger } from '../../utils/logger';

// Simple tokenizer implementation to avoid external dependency

/**
 * A simple tokenizer for counting tokens in text strings.
 * This is a basic implementation - for production use, consider using a proper tokenizer.
 */
export function encode(text: string): number[] {
    // This is a very simplified tokenization that roughly approximates
    // how many tokens would be in a string
    const words = text.split(/\s+/);
    const tokens: number[] = [];

    for (const word of words) {
        // Split each word into roughly token-sized chunks (approx 4 chars per token)
        const chunks = splitIntoTokens(word);
        tokens.push(...chunks.map((_, i) => i + tokens.length));
    }

    return tokens;
}

/**
 * Decode tokens back into text (simplified implementation)
 */
export function decode(tokens: number[]): string {
    // In a real implementation, this would convert token IDs back to text
    // Here we just return a placeholder since our tokenizer is simplified
    return '[DECODED_TEXT]';
}

/**
 * Count the number of tokens in a string
 */
export function countTokens(text: string): number {
    return encode(text).length;
}

/**
 * Split a string into roughly token-sized chunks
 */
function splitIntoTokens(text: string): string[] {
    const result: string[] = [];
    // Roughly 4 characters per token
    const chunkSize = 4;

    for (let i = 0; i < text.length; i += chunkSize) {
        result.push(text.slice(i, Math.min(i + chunkSize, text.length)));
    }

    return result;
}

/**
 * Truncate text to fit within a certain token limit
 */
export function truncateToTokenLimit(text: string, limit: number): string {
    const tokens = encode(text);

    if (tokens.length <= limit) {
        return text;
    }

    // Approximate character position based on token ratio
    const approxCharPosition = Math.floor((limit / tokens.length) * text.length);
    return text.slice(0, approxCharPosition) + '...';
}

export interface TokenizationResult {
	tokens: number;
	text: string;
}

export interface TokenizerOptions {
	preserveWhitespace?: boolean;
	maxTokens?: number;
}

export class Tokenizer {
	constructor(private readonly logger: Logger) {}

	public tokenize(text: string, options: TokenizerOptions = {}): TokenizationResult {
		// Simple tokenization based on characters/spaces
		// In practice, you'd want to use a proper tokenizer like GPT tokenizer
		const tokens = Math.ceil(text.length / 4); // Rough approximation

		if (options.maxTokens && tokens > options.maxTokens) {
			const truncatedText = text.slice(0, options.maxTokens * 4);
			return {
				tokens: options.maxTokens,
				text: truncatedText
			};
		}

		return {
			tokens,
			text
		};
	}

	public estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}
}
