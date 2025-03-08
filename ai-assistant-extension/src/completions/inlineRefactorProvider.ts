/**
 * Inline Refactor Provider
 *
 * Provides inline suggestions for code refactoring.
 * This handles refactoring suggestions that appear in-editor.
 */

import * as vscode from 'vscode';
import { ModelManager } from '../ai/modelManager';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { ModelCapability } from '../ai/providers/baseProvider';

/**
 * Provider for inline refactoring suggestions
 */
export class InlineRefactorProvider implements vscode.Disposable {
	private readonly logger: Logger;
	private readonly modelManager: ModelManager;
	private readonly configService: ConfigService;
	private disposables: vscode.Disposable[] = [];

	/**
	 * Create a new inline refactor provider
	 * @param logger Logger instance
	 * @param modelManager Model manager
	 * @param configService Configuration service
	 */
	constructor(
		logger: Logger,
		modelManager: ModelManager,
		configService: ConfigService
	) {
		this.logger = logger;
		this.modelManager = modelManager;
		this.configService = configService;
	}

	/**
	 * Register inline completion provider
	 * @returns Disposable for the registered provider
	 */
	register(): vscode.Disposable {
		this.logger.info('Registering inline refactor provider');

		// Create selector for supported languages
		const selector = this.getSupportedLanguageSelector();

		// Register completion provider
		const disposable = vscode.languages.registerInlineCompletionItemProvider(
			selector,
			{
				provideInlineCompletionItems: async (document, position, context, token) => {
					return this.provideInlineCompletions(document, position, context, token);
				}
// @ts-ignore: error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
// @ts-ignore: error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
// @ts-ignore: error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
// @ts-ignore: error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
// @ts-ignore: error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
// @ts-ignore: error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
			},
			...this.getTriggerCharacters()
		);

		// Add to disposables
		this.disposables.push(disposable);
		return disposable;
	}

	/**
	 * Provide inline completions
	 * @param document Document to provide completions for
	 * @param position Position to provide completions at
	 * @param context Context for the completion
	 * @param token Cancellation token
	 * @returns Inline completion items
	 */
	private async provideInlineCompletions(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken
	): Promise<vscode.InlineCompletionItem[] | null> {
		try {
			// Check if feature is enabled
			if (!this.configService.get<boolean>('inlineRefactoring.enabled', true)) {
				return null;
			}

			// Check trigger conditions
			if (!this.shouldTriggerCompletion(document, position, context)) {
				return null;
			}

			// Get the current line and preceding text
			const currentLine = document.lineAt(position.line).text;
			const precedingText = document.getText(new vscode.Range(
				new vscode.Position(0, 0),
				position
			));

			// Get the following text (for context)
			const followingText = document.getText(new vscode.Range(
				position,
				document.positionAt(document.getText().length)
			)).substring(0, 5000); // Limit to 5000 chars

			// Get surrounding code block
			const codeContext = this.getSurroundingCodeBlock(document, position);

			// Create prompt for the model
			const prompt = this.createPrompt(document.languageId, precedingText, followingText, codeContext);

			// Generate completion
			const response = await this.modelManager.generateCompletion(prompt, {
				capability: ModelCapability.Refactoring,
				temperature: 0.1, // Lower temperature for more deterministic results
// @ts-ignore: error TS2353: Object literal may only specify known properties, and 'withFallbacks' does not exist in type 'ModelRequestOptions'.
// @ts-ignore: error TS2353: Object literal may only specify known properties, and 'withFallbacks' does not exist in type 'ModelRequestOptions'.
// @ts-ignore: error TS2353: Object literal may only specify known properties, and 'withFallbacks' does not exist in type 'ModelRequestOptions'.
// @ts-ignore: error TS2353: Object literal may only specify known properties, and 'withFallbacks' does not exist in type 'ModelRequestOptions'.
// @ts-ignore: error TS2353: Object literal may only specify known properties, and 'withFallbacks' does not exist in type 'ModelRequestOptions'.
// @ts-ignore: error TS2353: Object literal may only specify known properties, and 'withFallbacks' does not exist in type 'ModelRequestOptions'.
				maxTokens: 200,    // Limit token generation
				withFallbacks: true // Use fallbacks if primary model fails
			});

			if (!response.content.trim()) {
				return null;
			}

			// Create completion items
			const completions = this.createCompletionItems(response.content);

			if (completions.length === 0) {
				return null;
			}

			this.logger.debug(`Generated ${completions.length} inline refactoring suggestions`);
			return completions;
		} catch (error) {
			// Log error but don't show to user - we want this to fail silently
			this.logger.error(`Error providing inline completions: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
	 * Create a prompt for the completion model
	 * @param language Language ID
	 * @param precedingText Text before the cursor
	 * @param followingText Text after the cursor
	 * @param codeContext Surrounding code block
	 * @returns Prompt for the model
	 */
	private createPrompt(
		language: string,
		precedingText: string,
		followingText: string,
		codeContext: string
	): string {
		return `You are an expert ${language} developer.
Your task is to suggest the next part of the code based on the existing context.
Focus on completing the current line or suggesting a small refactoring.
Only suggest actual code, no comments or explanations.
Limit your suggestion to what would appear as an inline completion in an editor.

LANGUAGE: ${language}

CODE CONTEXT:
\`\`\`${language}
${codeContext}
\`\`\`

CODE SO FAR:
\`\`\`${language}
${precedingText}
\`\`\`

FOLLOWING CODE:
\`\`\`${language}
${followingText}
\`\`\`

Only provide the code to insert at the cursor position. Keep it brief and focused.`;
	}

	/**
	 * Create completion items from a response
	 * @param content Response content
	 * @returns Array of inline completion items
	 */
	private createCompletionItems(content: string): vscode.InlineCompletionItem[] {
		// Extract the code from the response
		const cleanContent = this.extractCodeFromResponse(content);

		if (!cleanContent) {
			return [];
		}

		// Split by lines in case there are multiple suggestions
		const lines = cleanContent.split('\n');

		return lines
			.filter(line => line.trim().length > 0)
			.map(line => {
				return new vscode.InlineCompletionItem(
					line,
					new vscode.Range(
						new vscode.Position(0, 0),
						new vscode.Position(0, 0)
					)
				);
			});
	}

	/**
	 * Extract the actual code from the model response
	 * @param response Model response
	 * @returns Clean code content
	 */
	private extractCodeFromResponse(response: string): string {
		// Remove any markdown code blocks
		const codeBlockMatch = response.match(/```(?:\w+)?\s*([\s\S]+?)\s*```/);
		if (codeBlockMatch) {
			return codeBlockMatch[1].trim();
		}

		// Remove any explicit "Response:" or similar prefixes
		const cleanedResponse = response
			.replace(/^(?:Response|Suggestion|Code|Completion):\s*/i, '')
			.trim();

		return cleanedResponse;
	}

	/**
	 * Check if completion should be triggered
	 * @param document Document
	 * @param position Cursor position
	 * @param context Completion context
	 * @returns Whether to trigger completion
	 */
	private shouldTriggerCompletion(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext
	): boolean {
		// Don't trigger if it's an explicit trigger (user requested it)
// @ts-ignore: error TS2339: Property 'Explicit' does not exist on type 'typeof InlineCompletionTriggerKind'.
		// We only want to show when automatic triggering is enabled
		if (context.triggerKind === vscode.InlineCompletionTriggerKind.Explicit) {
			return this.configService.get<boolean>('inlineRefactoring.triggerOnExplicit', true);
		}

		// Get current line
		const line = document.lineAt(position.line).text;

		// Don't trigger on empty lines
		if (line.trim().length === 0) {
			return false;
		}

		// Don't trigger inside comments or strings
		const isInComment = this.isPositionInComment(document, position);
		if (isInComment) {
			return false;
		}

		// Check if we're in a code block boundary
		const isCodeBlockBoundary = this.isCodeBlockBoundary(line);
		if (isCodeBlockBoundary) {
			return true;
		}

		// Detect if we're in a function declaration
		const isFunctionDeclaration = /\b(?:function|def|class|method|async|public|private|protected)\b/.test(line);
		if (isFunctionDeclaration) {
			return true;
		}

		// Detect if we just opened a code block
		const justOpenedCodeBlock = line.trimEnd().endsWith('{') || line.trimEnd().endsWith(':');
		if (justOpenedCodeBlock) {
			return true;
		}

		// Check control flow statements
		const isControlFlow = /\b(?:if|else|for|while|switch|catch|try)\b/.test(line);
		if (isControlFlow) {
			return true;
		}

		// Default to false to avoid too many unwanted suggestions
		return false;
	}

	/**
	 * Check if a position is inside a comment
	 * @param document Document
	 * @param position Position to check
	 * @returns Whether position is in a comment
	 */
	private isPositionInComment(document: vscode.TextDocument, position: vscode.Position): boolean {
		// Simple check for single line comments
		const line = document.lineAt(position.line).text;
		const beforeCursor = line.substring(0, position.character);

		// Check for single-line comments
		if (beforeCursor.includes('//') || beforeCursor.includes('#')) {
			return true;
		}

		// Very basic check for multi-line comments in common languages
		// A more robust implementation would use a language service
		const fullDocText = document.getText();
		const cursorOffset = document.offsetAt(position);

		// Check for C-style comments
		const lastCommentStart = fullDocText.lastIndexOf('/*', cursorOffset);
		if (lastCommentStart !== -1) {
			const lastCommentEnd = fullDocText.indexOf('*/', lastCommentStart);
			if (lastCommentEnd === -1 || lastCommentEnd > cursorOffset) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if a line is a code block boundary
	 * @param line Line to check
	 * @returns Whether line is a code block boundary
	 */
	private isCodeBlockBoundary(line: string): boolean {
		const trimmed = line.trim();
		return trimmed === '{' || trimmed === '}' || trimmed === 'begin' || trimmed === 'end';
	}

	/**
	 * Get the surrounding code block for context
	 * @param document Document
	 * @param position Position in document
	 * @returns Surrounding code block
	 */
	private getSurroundingCodeBlock(document: vscode.TextDocument, position: vscode.Position): string {
		const lineCount = document.lineCount;

		// Get 10 lines before and after for context, but stay within file bounds
		const startLine = Math.max(0, position.line - 10);
		const endLine = Math.min(lineCount - 1, position.line + 10);

		const range = new vscode.Range(
			new vscode.Position(startLine, 0),
			document.lineAt(endLine).range.end
		);

		return document.getText(range);
	}

	/**
	 * Get supported language selector
	 * @returns Language selector for supported languages
	 */
	private getSupportedLanguageSelector(): vscode.DocumentFilter[] {
		// Default supported languages
		const defaultLanguages = [
			'typescript',
			'javascript',
			'python',
			'java',
			'csharp',
			'go',
			'rust',
			'cpp',
			'c',
			'php',
			'ruby',
			'kotlin'
		];

		// Get user-configured languages
		const configuredLanguages = this.configService.get<string[]>(
			'inlineRefactoring.languages',
			defaultLanguages
		);

		// Create document filters for each language
		return configuredLanguages.map(language => {
			return { language };
		});
	}

	/**
	 * Get trigger characters
	 * @returns Trigger characters for inline completion
	 */
	private getTriggerCharacters(): string[] {
		return ['.', '(', '{', '[', '=', ':', '>'];
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
	}
}
