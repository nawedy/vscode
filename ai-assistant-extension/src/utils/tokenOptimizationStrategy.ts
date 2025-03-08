import { BaseModelProvider } from '../ai/providers/baseProvider';
import { Logger } from './logger';

/**
 * Optimization level enum
 */
export enum OptimizationLevel {
	None = 'none',
	Light = 'light',
	Moderate = 'moderate',
	Aggressive = 'aggressive',
	Maximum = 'maximum'
}

/**
 * Optimization strategy options
 */
export interface OptimizationStrategyOptions {
	maxTokens: number;
	level: OptimizationLevel;
	preserveImports: boolean;
	preserveSignatures: boolean;
	preserveComments: boolean;
	includeSummary: boolean;
	contextType: 'code' | 'documentation' | 'error' | 'general';
}

/**
 * Content section with priority information
 */
interface ContentSection {
	content: string;
	priority: number; // 0-100, higher is more important
	type: 'import' | 'signature' | 'code' | 'comment' | 'docstring' | 'whitespace' | 'error' | 'other';
	estimatedTokens?: number;
	isEssential?: boolean; // Sections that must be kept regardless of optimization level
}

/**
 * Advanced token optimization strategies
 */
export class TokenOptimizationStrategy {
	private provider: BaseModelProvider;
	private logger: Logger;

	/**
	 * Create a new TokenOptimizationStrategy
	 * @param provider Model provider for token estimation
	 * @param logger Logger instance
	 */
	constructor(provider: BaseModelProvider, logger: Logger) {
		this.provider = provider;
		this.logger = logger;
	}

	/**
	 * Optimize content to fit within token limits using an appropriate strategy
	 * @param content The content to optimize
	 * @param options Optimization options
	 * @returns Optimized content
	 */
	public async optimize(content: string, options: OptimizationStrategyOptions): Promise<string> {
		// Return original if no optimization needed or optimization disabled
		if (options.level === OptimizationLevel.None) {
			return content;
		}

		// Estimate current token count
		const estimatedTokens = await this.provider.countTokens(content);

		// Check if we need to optimize
		if (estimatedTokens <= options.maxTokens) {
			this.logger.debug(`Content (${estimatedTokens} tokens) already within limit (${options.maxTokens} tokens)`);
			return content;
		}

		this.logger.info(`Optimizing content: ${estimatedTokens} tokens → ${options.maxTokens} tokens (${options.level} level)`);

		// Parse content into sections
		const sections = await this.parseContentIntoSections(content, options);

		// Apply token estimation to each section
		await this.estimateSectionTokens(sections);

		// Apply optimization strategy based on level
		return this.applyOptimizationStrategy(sections, options, estimatedTokens);
	}

	/**
	 * Parse content into prioritized sections
	 * @param content Full content
	 * @param options Optimization options
	 * @returns Array of content sections
	 */
	private async parseContentIntoSections(content: string, options: OptimizationStrategyOptions): Promise<ContentSection[]> {
		const sections: ContentSection[] = [];
		const lines = content.split('\n');

		let currentSection: ContentSection | null = null;
		let inDocString = false;
		let inComment = false;
		let inCodeBlock = false;
		let consecutiveEmptyLines = 0;

		// Detect language from content if possible
		const language = this.detectLanguage(content);

		// Define essential patterns based on language
		const importPattern = this.getImportPattern(language);
		const signaturePattern = this.getSignaturePattern(language);
		const docstringPattern = this.getDocstringPattern(language);
		const commentPattern = this.getCommentPattern(language);
		const errorPattern = /error|exception|failed|warning|critical/i;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();

			// Handle empty lines
			if (trimmedLine.length === 0) {
				consecutiveEmptyLines++;

				// Only keep first empty line in a sequence
				if (consecutiveEmptyLines === 1) {
					sections.push({
						content: '\n',
						priority: 10,
						type: 'whitespace'
					});
				}

				// Complete any current section
				if (currentSection) {
					sections.push(currentSection);
					currentSection = null;
				}

				continue;
			}
			consecutiveEmptyLines = 0;

			// Check for import statements
			if (importPattern.test(trimmedLine)) {
				sections.push({
					content: line + '\n',
					priority: 90, // Very high priority for imports
					type: 'import',
					isEssential: options.preserveImports
				});
				continue;
			}

			// Check for function/method signatures or class definitions
			if (signaturePattern.test(trimmedLine)) {
				if (currentSection) {
					sections.push(currentSection);
				}
				currentSection = {
					content: line + '\n',
					priority: 85, // High priority for signatures
					type: 'signature',
					isEssential: options.preserveSignatures
				};
				continue;
			}

			// Check for error patterns which should be preserved
			if (errorPattern.test(trimmedLine)) {
				if (currentSection) {
					if (currentSection.type === 'error') {
						currentSection.content += line + '\n';
						continue;
					} else {
						sections.push(currentSection);
					}
				}

				currentSection = {
					content: line + '\n',
					priority: 80, // High priority for errors
					type: 'error',
					isEssential: true
				};
				continue;
			}

			// Handle comments
			if (commentPattern.test(trimmedLine)) {
				const isDocumentation = docstringPattern.test(trimmedLine) ||
					trimmedLine.includes('@param') ||
					trimmedLine.includes('@returns') ||
					trimmedLine.includes('@throws');

				if (currentSection && (currentSection.type === 'comment' || currentSection.type === 'docstring')) {
					// Continue existing comment section
					currentSection.content += line + '\n';
				} else {
					// Start new comment section
					if (currentSection) {
						sections.push(currentSection);
					}

					currentSection = {
						content: line + '\n',
						priority: isDocumentation ? 60 : 40, // Higher priority for documentation
						type: isDocumentation ? 'docstring' : 'comment',
						isEssential: options.preserveComments && isDocumentation
					};
				}
				continue;
			}

			// Handle regular code
			if (currentSection && currentSection.type === 'code') {
				currentSection.content += line + '\n';
			} else {
				if (currentSection) {
					sections.push(currentSection);
				}

				currentSection = {
					content: line + '\n',
					priority: 70, // Medium-high priority for code
					type: 'code'
				};
			}
		}

		// Add the final section if there is one
		if (currentSection) {
			sections.push(currentSection);
		}

		return sections;
	}

	/**
	 * Estimate token counts for each section
	 * @param sections Content sections
	 */
	private async estimateSectionTokens(sections: ContentSection[]): Promise<void> {
		for (const section of sections) {
			section.estimatedTokens = await this.provider.countTokens(section.content);
		}
	}

	/**
	 * Apply optimization strategy based on level and options
	 * @param sections Content sections
	 * @param options Optimization options
	 * @param totalTokens Total tokens in original content
	 * @returns Optimized content
	 */
	private applyOptimizationStrategy(
		sections: ContentSection[],
		options: OptimizationStrategyOptions,
		totalTokens: number
	): string {
		// Calculate how many tokens we need to remove
		const targetTokens = options.maxTokens;
		const excessTokens = totalTokens - targetTokens;

		// Reserve tokens for summary if requested
		const summaryTokens = options.includeSummary ? 100 : 0;
		const effectiveTargetTokens = targetTokens - summaryTokens;

		// Sort sections by priority (lowest first to remove them first)
		sections.sort((a, b) => {
			// Always prioritize essential sections
			if (a.isEssential && !b.isEssential) return 1;
			if (!a.isEssential && b.isEssential) return -1;

			// Then sort by priority
			return a.priority - b.priority;
		});

		// Set up token reduction based on optimization level
		const reductionTarget = this.getReductionTarget(options.level, excessTokens);

		// Start removing sections from lowest priority until we meet token target
		let currentTokens = totalTokens;
		let removedSections: ContentSection[] = [];
		let keptSections: ContentSection[] = [...sections];

		// Try to achieve token target
		while (currentTokens > effectiveTargetTokens && keptSections.length > 0) {
			// Find next section to remove that's not essential
			const sectionIndex = keptSections.findIndex(s => !s.isEssential);

			// Break if all remaining sections are essential
			if (sectionIndex === -1) break;

			// Remove section and update token count
			const [removedSection] = keptSections.splice(sectionIndex, 1);
			removedSections.push(removedSection);
			currentTokens -= removedSection.estimatedTokens || 0;

			// Stop if we've reached target
			if (currentTokens <= effectiveTargetTokens) {
				break;
			}
		}

		// If we still have too many tokens and we're at maximum optimization,
		// we need to start removing essential sections
		if (currentTokens > effectiveTargetTokens && options.level === OptimizationLevel.Maximum) {
			while (currentTokens > effectiveTargetTokens && keptSections.length > 1) {
				// Always keep at least one section
				const [removedSection] = keptSections.splice(0, 1);
				removedSections.push(removedSection);
				currentTokens -= removedSection.estimatedTokens || 0;
			}
		}

		// Sort kept sections back into original order for output
		keptSections.sort((a, b) => sections.indexOf(a) - sections.indexOf(b));

		// Build output
		let result = keptSections.map(s => s.content).join('');

		// Add optimization summary if requested
		if (options.includeSummary && removedSections.length > 0) {
			const removedTokens = removedSections.reduce((sum, s) => sum + (s.estimatedTokens || 0), 0);

			// Create a summary
			const summary = [
				`// Note: Content optimized to fit token limits (${currentTokens}/${targetTokens} tokens)`,
				`// ${removedSections.length} sections removed, saving ${removedTokens} tokens`,
				`// Optimization level: ${options.level}`,
				`//`,
				''
			].join('\n');

			result = summary + result;
		}

		return result;
	}

	/**
	 * Get reduction target based on optimization level
	 * @param level Optimization level
	 * @param excessTokens Excess tokens to remove
	 * @returns Target token reduction
	 */
	private getReductionTarget(level: OptimizationLevel, excessTokens: number): number {
		switch (level) {
			case OptimizationLevel.Light:
				return Math.ceil(excessTokens * 1.1); // Remove just enough plus 10%

			case OptimizationLevel.Moderate:
				return Math.ceil(excessTokens * 1.2); // Remove excess plus 20%

			case OptimizationLevel.Aggressive:
				return Math.ceil(excessTokens * 1.5); // Remove excess plus 50%

			case OptimizationLevel.Maximum:
				return Math.ceil(excessTokens * 2); // Remove twice what we need

			default:
				return excessTokens; // Just enough
		}
	}

	/**
	 * Detect the programming language from content
	 * @param content Text content
	 * @returns Detected language or null
	 */
	private detectLanguage(content: string): string | null {
		// Simple heuristic-based language detection
		if (content.includes('import React') || content.includes('const ') && content.includes('() =>')) {
			return 'javascript';
		}
		if (content.includes('import ') && content.includes('from ') && content.includes('interface ')) {
			return 'typescript';
		}
		if (content.includes('def ') && content.includes(':') && content.includes('import ')) {
			return 'python';
		}
		if (content.includes('func ') && content.includes('package ')) {
			return 'go';
		}
		if (content.includes('#include') && (content.includes('int main') || content.includes('std::'))) {
			return 'cpp';
		}
		if (content.includes('package ') && content.includes('public class ') && content.includes('void ')) {
			return 'java';
		}

		// Default case
		return null;
	}

	/**
	 * Get import statement regex pattern for a language
	 * @param language Programming language
	 * @returns RegExp for import statements
	 */
	private getImportPattern(language: string | null): RegExp {
		switch (language) {
			case 'javascript':
			case 'typescript':
				return /^(import|export)/;
			case 'python':
				return /^(import|from)\s+\w+/;
			case 'java':
				return /^import\s+[\w.]+;/;
			case 'cpp':
				return /^#include</;
			case 'go':
				return /^import\s+[("]/;
			default:
				// Generic import pattern
				return /^(import|#include|using|require|from)/;
		}
	}

	/**
	 * Get function/method signature pattern for a language
	 * @param language Programming language
	 * @returns RegExp for function signatures
	 */
	private getSignaturePattern(language: string | null): RegExp {
		switch (language) {
			case 'javascript':
			case 'typescript':
				return /^(function\s+\w+|class\s+\w+|interface\s+\w+|const\s+\w+\s*=\s*(\(.*\)|function)|\w+\s*\([^)]*\)\s*(\{|=>))/;
			case 'python':
				return /^(def\s+\w+|class\s+\w+)/;
			case 'java':
			case 'cpp':
				return /^(public|private|protected|static|void|int|bool|class|struct|enum)\s+\w+/;
			case 'go':
				return /^(func\s+\w+|type\s+\w+)/;
			default:
				// Generic signature pattern
				return /^(\w+\s+\w+\s*\(|class\s+\w+|def\s+\w+|function\s+\w+)/;
		}
	}

	/**
	 * Get docstring/JSDoc pattern for a language
	 * @param language Programming language
	 * @returns RegExp for docstring patterns
	 */
	private getDocstringPattern(language: string | null): RegExp {
		switch (language) {
			case 'javascript':
			case 'typescript':
				return /^\/\*\*|\* @\w+|@\w+/;
			case 'python':
				return /^"""|'''/;
			case 'java':
				return /^\/\*\*|@\w+/;
			default:
				// Generic docstring pattern
				return /^(\/\*\*|"""|'''|@\w+)/;
		}
	}

	/**
	 * Get comment pattern for a language
	 * @param language Programming language
	 * @returns RegExp for comment patterns
	 */
	private getCommentPattern(language: string | null): RegExp {
		switch (language) {
			case 'javascript':
			case 'typescript':
			case 'java':
			case 'cpp':
			case 'go':
				return /^(\/\/|\/\*)/;
			case 'python':
				return /^#/;
			default:
				// Generic comment pattern
				return /^(\/\/|\/\*|#)/;
		}
	}
}
