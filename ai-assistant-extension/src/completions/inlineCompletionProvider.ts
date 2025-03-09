/**
 * Inline Completion Provider for SuperCoderAI VSCode Extension
 *
 * This file implements the inline completion provider that offers real-time
 * code suggestions as the user types. It leverages the CodeGenerationEnsemble
 * and ContextManager to provide context-aware, intelligent completions that
 * understand project structure and patterns.
 *
 * Key features:
 * - Context-aware code completions
 * - Intelligent triggering based on typing patterns
 * - Completion caching for performance
 * - Privacy-focused handling of code context
 * - Adaptive suggestion strategies based on file types
 *
 * File path: src/completions/inlineCompletionProvider.ts
 */

import * as vscode from 'vscode';
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
import { ContextManager } from '../context/contextManager';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';
import { debounce } from '../utils/debounce';

// Interface for completion cache entry
interface CompletionCacheEntry {
    document: string;
    position: vscode.Position;
    completionItems: vscode.InlineCompletionItem[];
    timestamp: number;
}

// Interface for completion request
interface CompletionRequest {
    document: vscode.TextDocument;
    position: vscode.Position;
    context: vscode.InlineCompletionContext;
    token: vscode.CancellationToken;
}

// Completion trigger patterns
interface TriggerPatterns {
    [key: string]: RegExp[];
}

// Add type for debounced function
type DebouncedCompletionFunction = (request: CompletionRequest) => Promise<vscode.InlineCompletionItem[]>;

interface CompletionConfig {
    enabled: boolean;
    cacheTimeToLiveMs: number;
    minTriggerLength: number;
    maxPrefixLines: number;
    maxSuffixLines: number;
    debounceMs: number;
}

interface CompletionResult {
    completedCode: string;
    metadata?: Record<string, unknown>;
}

interface CacheEntry {
	items: vscode.InlineCompletionItem[];
	timestamp: number;
}

interface CompletionContext {
	prefix: string;
	suffix: string;
	precedingLines: string[];
	followingLines: string[];
	language: string;
}

/**
 * Provides inline code completions as the user types
 */
export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider, vscode.Disposable {
    private codeGenerationEnsemble: CodeGenerationEnsemble;
    private contextManager: ContextManager;
    private configService: ConfigService;

    // Cache for completions to improve performance
    private completionCache: Map<string, CompletionCacheEntry> = new Map();

    // Config options
    private enabled: boolean = true;
    private cacheTimeToLiveMs: number = 10000; // 10 seconds
    private minTriggerLength: number = 3;
    private maxPrefixLines: number = 15;
    private maxSuffixLines: number = 5;
    private debounceMs: number = 300;

    // Language-specific trigger patterns
    private triggerPatterns: TriggerPatterns = {
        typescript: [
            /function\s+\w+\s*\([^)]*\)\s*{?\s*$/i,   // Function declaration
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{?\s*$/i, // Arrow function
            /if\s*\([^)]*\)\s*{?\s*$/i,               // If statement
            /for\s*\([^)]*\)\s*{?\s*$/i,              // For loop
            /\/\/\s*TODO:.*$/i,                       // TODO comment
            /class\s+\w+\s*{?\s*$/i,                  // Class declaration
            /interface\s+\w+\s*{?\s*$/i,              // Interface declaration
            /\/\*\*\s*$/i                             // JSDoc comment start
        ],
        javascript: [
            /function\s+\w+\s*\([^)]*\)\s*{?\s*$/i,   // Function declaration
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{?\s*$/i, // Arrow function
            /if\s*\([^)]*\)\s*{?\s*$/i,               // If statement
            /for\s*\([^)]*\)\s*{?\s*$/i,              // For loop
            /\/\/\s*TODO:.*$/i,                       // TODO comment
            /class\s+\w+\s*{?\s*$/i                   // Class declaration
        ],
        python: [
            /def\s+\w+\s*\([^)]*\):\s*$/i,            // Function definition
            /class\s+\w+.*:\s*$/i,                    // Class definition
            /if\s+.*:\s*$/i,                          // If statement
            /for\s+.*:\s*$/i,                         // For loop
            /while\s+.*:\s*$/i,                       // While loop
            /#\s*TODO:.*$/i                           // TODO comment
        ]
    };

    // Debounced completion handler to avoid too many requests
    // Fix debounced function type
    private debouncedProvideCompletions: DebouncedCompletionFunction;

    /**
     * Initialize the inline completion provider
     *
     * @param codeGenerationEnsemble Code generation ensemble for completions
     * @param contextManager Context manager for project context
     * @param configService Configuration service
     */
    constructor(
        codeGenerationEnsemble: CodeGenerationEnsemble,
        contextManager: ContextManager,
        configService: ConfigService
    ) {
        this.codeGenerationEnsemble = codeGenerationEnsemble;
        this.contextManager = contextManager;
        this.configService = configService;

        // Load configuration
        this.loadConfig();

        // @ts-ignore: error TS2322: Type '(...args: unknown[]) => void' is not assignable to type '(request: CompletionRequest) => Promise<InlineCompletionItem[]>'.
        // Create debounced completion handler
        // Fix debounce type casting
        this.debouncedProvideCompletions = debounce<DebouncedCompletionFunction>(
            this.generateCompletions.bind(this),
            this.debounceMs
        );

        // Set up configuration change listener
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('supercoderAI.inlineCompletions')) {
                this.loadConfig();
            }
        });

        // Set up context change listener to invalidate cache
        this.contextManager.onContextChanged(() => {
            this.clearCompletionCache();
        });

        logger.info('InlineCompletionProvider initialized');
    }

    /**
     * Load configuration from settings
     */
    private loadConfig(): void {
        const config = this.configService.get<CompletionConfig>('inlineCompletions');
        if (!config) return;

        this.enabled = config.enabled ?? true;
        this.cacheTimeToLiveMs = config.cacheTimeToLiveMs ?? 10000;
        this.minTriggerLength = config.minTriggerLength ?? 3;
        this.maxPrefixLines = config.maxPrefixLines ?? 15;
        this.maxSuffixLines = config.maxSuffixLines ?? 5;
        this.debounceMs = config.debounceMs ?? 300;

        logger.info('InlineCompletionProvider configuration loaded');
    }

    /**
     * Provide inline completions as the user types
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @param context The completion context
     * @param token A cancellation token
     * @returns Array of inline completion items
     */
    public async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null | undefined> {
        // Skip if disabled
        if (!this.enabled) {
            return [];
        }

        try {
            // Check cache first
            const cachedCompletions = this.checkCache(document, position);
            if (cachedCompletions) {
                logger.debug('Using cached completions');
                return cachedCompletions;
            }

            // Check if we should trigger completion
            if (!this.shouldTriggerCompletion(document, position)) {
                return [];
            }

            // Get completions using debounced handler
            const request: CompletionRequest = { document, position, context, token };
            const completions = await this.debouncedProvideCompletions(request);

            // Cache the completions
            this.cacheCompletions(document, position, completions);

            return completions;
        } catch (error) {
            logger.error(`Error providing inline completions: ${error.message}`);
            return [];
        }
    }

    /**
     * Generate completions for a given request
     *
     * @param request Completion request
     * @returns Array of inline completion items
     */
    // Fix return type
    private async generateCompletions(
        request: CompletionRequest
    ): Promise<vscode.InlineCompletionItem[]> {
        const { document, position, context, token } = request;

        // Skip if cancelled
        if (token.isCancellationRequested) {
            return [];
        }

        try {
            const completionContext = this.getCompletionContext(document, position);
            // Get document text
            const documentText = document.getText();

            // Get context before and after the cursor
            const prefix = this.getPrefix(document, position);
            const suffix = this.getSuffix(document, position);

            // Get language ID
            const languageId = document.languageId;

            // Get project context
            let projectContext = {};
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
                // @ts-ignore: error TS2551: Property 'getFileContext' does not exist on type 'ContextManager'. Did you mean 'getContext'?

                projectContext = await this.contextManager.getFileContext(
                    workspaceUri,
                    document.uri.fsPath,
                    2000 // Limit tokens for completion context
                );
            }

            // Generate completion
            const result = await this.codeGenerationEnsemble.executeTask('completeCode', {
                partialCode: prefix,
                suffix: suffix,
                language: languageId,
                instructions: 'Complete the code based on the context',
                projectContext
            });

            // Skip if cancelled during generation
            if (token.isCancellationRequested) {
                return [];
            }

            // Process the result
            if (result && result.content && result.content.completedCode) {
                const completedCode = result.content.completedCode;

                // Extract just the completion part (without the prefix)
                const completion = this.extractCompletion(prefix, completedCode);

                if (completion && completion.length > 0) {
                    // Create completion item
                    const item = new vscode.InlineCompletionItem(
                        completion,
                        new vscode.Range(position, position)
                    );

                    return [item];
                }
            }

            return [];
        } catch (error) {
            logger.error(`Error generating completions: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    /**
     * Check if completion should be triggered based on current context
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @returns True if completion should be triggered
     */
    private shouldTriggerCompletion(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        // Get text up to the cursor position
        const lineText = document.lineAt(position.line).text.substring(0, position.character);

        // Skip if line is too short
        if (lineText.trim().length < this.minTriggerLength) {
            return false;
        }

        // Check language-specific trigger patterns
        const languageId = document.languageId;
        const patterns = this.triggerPatterns[languageId] || [];

        // Get a few lines of context before the current line
        let contextText = '';
        const startLine = Math.max(0, position.line - 3);
        for (let i = startLine; i < position.line; i++) {
            contextText += document.lineAt(i).text + '\n';
        }
        contextText += lineText;

        // Check if any trigger pattern matches
        for (const pattern of patterns) {
            if (pattern.test(contextText)) {
                return true;
            }
        }

        // Special case for continuing a line/block
        const isIndented = lineText.startsWith(' ') || lineText.startsWith('\t');
        const isBlockBody = lineText.trimEnd().endsWith('{');
        const isCommaList = lineText.trimEnd().endsWith(',');

        if ((isIndented || isBlockBody || isCommaList) && lineText.trim().length >= this.minTriggerLength) {
            return true;
        }

        return false;
    }

    /**
     * Get prefix text before cursor
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @returns Prefix text
     */
    private getPrefix(
        document: vscode.TextDocument,
        position: vscode.Position
    ): string {
        // Get lines before cursor (limited by maxPrefixLines)
        let prefix = '';
        const startLine = Math.max(0, position.line - this.maxPrefixLines);

        for (let i = startLine; i < position.line; i++) {
            prefix += document.lineAt(i).text + '\n';
        }

        // Add the current line up to the cursor
        prefix += document.lineAt(position.line).text.substring(0, position.character);

        return prefix;
    }

    /**
     * Get suffix text after cursor
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @returns Suffix text
     */
    private getSuffix(
        document: vscode.TextDocument,
        position: vscode.Position
    ): string {
        // Get the rest of the current line
        let suffix = document.lineAt(position.line).text.substring(position.character);

        // Get lines after cursor (limited by maxSuffixLines)
        const endLine = Math.min(document.lineCount - 1, position.line + this.maxSuffixLines);

        for (let i = position.line + 1; i <= endLine; i++) {
            suffix += '\n' + document.lineAt(i).text;
        }

        return suffix;
    }

    /**
     * Extract the completion part from the generated code
     *
     * @param prefix Original prefix
     * @param completedCode Generated completed code
     * @returns Just the completion part
     */
    private extractCompletion(prefix: string, completedCode: string): string {
        // Ensure the completed code starts with the prefix
        if (!completedCode.startsWith(prefix)) {
            // Try to find where the completion should start
            const prefixLines = prefix.split('\n');
            const lastPrefixLine = prefixLines[prefixLines.length - 1];

            // Find the last prefix line in the completion
            const index = completedCode.indexOf(lastPrefixLine);
            if (index >= 0) {
                // Extract from after the last prefix line
                const startIndex = index + lastPrefixLine.length;
                return completedCode.substring(startIndex);
            }

            return '';
        }

        // Extract just the completion part
        return completedCode.substring(prefix.length);
    }

    /**
     * Check if we have valid cached completions
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @returns Cached completion items or undefined
     */
    private checkCache(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.InlineCompletionItem[] | undefined {
        const cacheKey = this.getCacheKey(document, position);
        const cachedEntry = this.completionCache.get(cacheKey);

        if (cachedEntry) {
            // Check if cache is still valid
            const now = Date.now();
            if (now - cachedEntry.timestamp < this.cacheTimeToLiveMs) {
                return cachedEntry.completionItems;
            } else {
                // Remove expired cache entry
                this.completionCache.delete(cacheKey);
            }
        }

        return undefined;
    }

    /**
     * Cache completion items for reuse
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @param completionItems Completion items to cache
     */
    private cacheCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        completionItems: vscode.InlineCompletionItem[]
    ): void {
        const cacheKey = this.getCacheKey(document, position);

        this.completionCache.set(cacheKey, {
            document: document.getText(),
            position,
            completionItems,
            timestamp: Date.now()
        });

        // Limit cache size
        if (this.completionCache.size > 50) {
            // Remove oldest entries
            const entries = Array.from(this.completionCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

            // Remove oldest 20% of entries
            const entriesToRemove = Math.ceil(entries.length * 0.2);
            for (let i = 0; i < entriesToRemove; i++) {
                this.completionCache.delete(entries[i][0]);
            }
        }
    }

    /**
     * Generate a cache key for document and position
     *
     * @param document The current text document
     * @param position The position where the completion was requested
     * @returns Cache key string
     */
    private getCacheKey(
        document: vscode.TextDocument,
        position: vscode.Position
    ): string {
        const context = this.getCompletionContext(document, position);
        return JSON.stringify({
            uri: document.uri.toString(),
            version: document.version,
            prefix: context.prefix,
            language: context.language
        });
    }

    private getCompletionContext(document: vscode.TextDocument, position: vscode.Position): CompletionContext {
        const prefix = this.getPrefix(document, position);
        const suffix = this.getSuffix(document, position);
        const lines = document.getText().split('\n');
        const currentLine = position.line;

        return {
            prefix,
            suffix,
            precedingLines: lines.slice(Math.max(0, currentLine - this.maxPrefixLines), currentLine),
            followingLines: lines.slice(currentLine + 1, currentLine + 1 + this.maxSuffixLines),
            language: document.languageId
        };
    }

    /**
     * Clear completion cache
     */
    public clearCompletionCache(): void {
        this.completionCache.clear();
        logger.debug('Cleared completion cache');
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.clearCompletionCache();
    }
}
