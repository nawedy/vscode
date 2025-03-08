/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Copyright (c) SuperCoderAI. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Disposable, DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IFileService, FileChangeType } from 'vs/platform/files/common/files';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IModelService } from 'vs/editor/common/services/model';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Emitter, Event } from 'vs/base/common/event';
import { ICancellationToken } from 'vs/base/common/cancellation';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { ILogService } from 'vs/platform/log/common/log';
import { Queue } from 'vs/base/common/async';

/**
 * Interface for the parsed context of a file
 */
export interface IFileContext {
    uri: URI;
    language: string;
    context: any; // Parsed context data
    dependencies: string[]; // URIs of dependencies
    symbols: string[]; // Exported symbols
    lastModified: number; // Timestamp of last modification
    summary: string; // Summary of file content
}

/**
 * Interface for the context-relevance scoring
 */
export interface IContextRelevance {
    uri: URI;
    relevance: number; // 0-1 relevance score
}

/**
 * Configuration options for the context manager
 */
export interface IContextManagerConfig {
    enabled: boolean;
    maxFilesInContext: number;
    excludePatterns: string[];
    indexOnStartup: boolean;
    cacheEnabled: boolean;
    cacheTTL: number; // Time to live in milliseconds
}

/**
 * Main Context Manager class for SuperCoderAI integration
 * Responsible for indexing, caching, and selecting relevant context
 */
export class ContextManager extends Disposable implements IWorkbenchContribution {
    private static readonly CACHE_KEY = 'supercoderai.contextCache';

    private readonly _onDidUpdateContext = new Emitter<URI>();
    public readonly onDidUpdateContext: Event<URI> = this._onDidUpdateContext.event;

    private readonly _onDidChangeContextRelevance = new Emitter<IContextRelevance[]>();
    public readonly onDidChangeContextRelevance: Event<IContextRelevance[]> = this._onDidChangeContextRelevance.event;

    private readonly _onDidCompleteProjectIndexing = new Emitter<void>();
    public readonly onDidCompleteProjectIndexing: Event<void> = this._onDidCompleteProjectIndexing.event;

    private config: IContextManagerConfig;
    private contextCache: Map<string, IFileContext> = new Map();
    private relevanceCache: Map<string, IContextRelevance[]> = new Map();
    private dependencyGraph: Map<string, string[]> = new Map();
    private fileWatcherDisposable: IDisposable | undefined;
    private indexingQueue: Queue<void>;
    private isIndexing: boolean = false;

    constructor(
        @IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
        @IFileService private readonly fileService: IFileService,
        @ILanguageService private readonly languageService: ILanguageService,
        @IModelService private readonly modelService: IModelService,
        @IExtensionService private readonly extensionService: IExtensionService,
        @IStorageService private readonly storageService: IStorageService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @ITelemetryService private readonly telemetryService: ITelemetryService,
        @IProgressService private readonly progressService: IProgressService,
        @ILogService private readonly logService: ILogService
    ) {
        super();

        this.config = this.readConfiguration();

        // Create the indexing queue with concurrency of 1
        this.indexingQueue = new Queue<void>();

        // Load cached context if enabled
        if (this.config.cacheEnabled) {
            this.loadContextCache();
        }

        // Register configuration change listener
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('supercoder.contextManager')) {
                this.config = this.readConfiguration();

                // If the enabled state changed, set up or tear down accordingly
                if (e.affectsConfiguration('supercoder.contextManager.enabled')) {
                    if (this.config.enabled) {
                        this.setupFileWatcher();
                        if (this.config.indexOnStartup) {
                            this.indexWorkspace();
                        }
                    } else {
                        this.tearDownFileWatcher();
                    }
                }
            }
        }));

        // Set up if enabled
        if (this.config.enabled) {
            this.setupFileWatcher();

            // Index workspace on startup if configured
            if (this.config.indexOnStartup) {
                this.extensionService.whenInstalledExtensionsRegistered().then(() => {
                    this.indexWorkspace();
                });
            }
        }
    }

    /**
     * Read configuration from VS Code settings
     */
    private readConfiguration(): IContextManagerConfig {
        const config = this.configurationService.getValue<any>('supercoder.contextManager');
        return {
            enabled: config?.enabled ?? true,
            maxFilesInContext: config?.maxFilesInContext ?? 20,
            excludePatterns: config?.excludePatterns ?? ['**/node_modules/**', '**/dist/**', '**/out/**', '**/.git/**'],
            indexOnStartup: config?.indexOnStartup ?? true,
            cacheEnabled: config?.cacheEnabled ?? true,
            cacheTTL: config?.cacheTTL ?? 86400000 // Default: 24 hours
        };
    }

    /**
     * Set up file watcher to track changes in the workspace
     */
    private setupFileWatcher(): void {
        if (this.fileWatcherDisposable) {
            return; // Already set up
        }

        const workspaceFolders = this.contextService.getWorkspace().folders;
        if (workspaceFolders.length === 0) {
            return; // No workspace folders to watch
        }

        const disposables = new DisposableStore();

        // Watch for file changes in all workspace folders
        for (const folder of workspaceFolders) {
            disposables.add(this.fileService.onDidFilesChange(e => {
                // Check if any of the changes are within the folder
                const relevantChanges = e.changes.filter(change => {
                    return change.resource.toString().startsWith(folder.uri.toString());
                });

                if (relevantChanges.length === 0) {
                    return;
                }

                // Process file changes
                for (const change of relevantChanges) {
                    this.handleFileChange(change.resource, change.type);
                }
            }));
        }

        this.fileWatcherDisposable = toDisposable(() => {
            disposables.dispose();
        });
    }

    /**
     * Tear down file watcher
     */
    private tearDownFileWatcher(): void {
        if (this.fileWatcherDisposable) {
            this.fileWatcherDisposable.dispose();
            this.fileWatcherDisposable = undefined;
        }
    }

    /**
     * Handle file changes (create, update, delete)
     */
    private handleFileChange(uri: URI, type: FileChangeType): void {
        // Check if the file should be excluded
        if (this.shouldExcludeFile(uri)) {
            return;
        }

        // Handle based on change type
        switch (type) {
            case FileChangeType.ADDED:
            case FileChangeType.UPDATED:
                this.indexFile(uri);
                break;
            case FileChangeType.DELETED:
                this.removeFileContext(uri);
                break;
        }
    }

    /**
     * Check if a file should be excluded from indexing
     */
    private shouldExcludeFile(uri: URI): boolean {
        const path = uri.toString();

        // Check against exclude patterns
        for (const pattern of this.config.excludePatterns) {
            // Simple glob pattern matching (could be improved with proper glob matcher)
            const regExp = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regExp.test(path)) {
                return true;
            }
        }

        // Also check file extensions we don't support
        const unsupportedExtensions = ['.exe', '.dll', '.zip', '.png', '.jpg', '.gif'];
        for (const ext of unsupportedExtensions) {
            if (path.toLowerCase().endsWith(ext)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Index the entire workspace
     */
    public async indexWorkspace(): Promise<void> {
        if (this.isIndexing) {
            return; // Already indexing
        }

        const workspaceFolders = this.contextService.getWorkspace().folders;
        if (workspaceFolders.length === 0) {
            return; // No workspace folders to index
        }

        this.isIndexing = true;

        try {
            await this.progressService.withProgress(
                {
                    location: ProgressLocation.Notification,
                    title: nls.localize('supercoderai.indexing', "SuperCoderAI: Indexing workspace for context..."),
                    cancellable: true
                },
                async (progress, token) => {
                    // Create a file finder for each workspace folder
                    for (const folder of workspaceFolders) {
                        if (token.isCancellationRequested) {
                            break;
                        }

                        await this.indexFolder(folder.uri, progress, token);
                    }

                    // Build the dependency graph after indexing
                    this.buildDependencyGraph();

                    // Notify that indexing is complete
                    this._onDidCompleteProjectIndexing.fire();
                }
            );
        } finally {
            this.isIndexing = false;

            // Save cache if enabled
            if (this.config.cacheEnabled) {
                this.saveContextCache();
            }
        }
    }

    /**
     * Index a specific folder
     */
    private async indexFolder(folderUri: URI, progress: any, token: ICancellationToken): Promise<void> {
        try {
            // Get all files in the folder
            const files = await this.fileService.resolve(folderUri, { resolveMetadata: true });
            if (!files || !files.children || token.isCancellationRequested) {
                return;
            }

            // Process each file/folder
            let processedCount = 0;
            const totalCount = files.children.length;

            for (const file of files.children) {
                if (token.isCancellationRequested) {
                    break;
                }

                if (file.isDirectory) {
                    // Recursively index subfolders
                    await this.indexFolder(file.resource, progress, token);
                } else {
                    // Skip excluded files
                    if (this.shouldExcludeFile(file.resource)) {
                        continue;
                    }

                    // Queue file for indexing
                    await this.indexingQueue.queue(async () => {
                        if (!token.isCancellationRequested) {
                            await this.indexFile(file.resource);

                            // Update progress
                            processedCount++;
                            const progressPercentage = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;
                            progress.report({
                                message: nls.localize(
                                    'supercoderai.indexingProgress',
                                    "Indexed {0}/{1} files ({2}%)",
                                    processedCount,
                                    totalCount,
                                    Math.round(progressPercentage)
                                ),
                                increment: 100 / totalCount
                            });
                        }
                    });
                }
            }
        } catch (error) {
            this.logService.error('SuperCoderAI: Error indexing folder', error);
        }
    }

    /**
     * Index a specific file
     */
    private async indexFile(uri: URI): Promise<IFileContext | undefined> {
        try {
            // Get the language of the file
            const language = this.getLanguageForFile(uri);
            if (!language) {
                return undefined; // Unsupported language
            }

            // Check if we have a language-specific parser
            const parser = await this.getParserForLanguage(language);
            if (!parser) {
                return undefined; // No parser available
            }

            // Get file content
            const fileContent = await this.getFileContent(uri);
            if (!fileContent) {
                return undefined;
            }

            // Parse the file
            const parseResult = await parser.parseFile(uri.toString(), fileContent);

            // Create the file context
            const fileContext: IFileContext = {
                uri,
                language,
                context: parseResult,
                dependencies: parseResult.dependencies || [],
                symbols: parseResult.symbols || [],
                lastModified: Date.now(),
                summary: parseResult.summary || `File: ${uri.toString()}`
            };

            // Store in cache
            this.contextCache.set(uri.toString(), fileContext);

            // Notify listeners
            this._onDidUpdateContext.fire(uri);

            return fileContext;
        } catch (error) {
            this.logService.error(`SuperCoderAI: Error indexing file ${uri.toString()}`, error);
            return undefined;
        }
    }

    /**
     * Remove a file from the context cache
     */
    private removeFileContext(uri: URI): void {
        const uriString = uri.toString();

        // Remove from context cache
        this.contextCache.delete(uriString);

        // Remove from dependency graph
        this.dependencyGraph.delete(uriString);

        // Remove from relevance cache
        this.relevanceCache.delete(uriString);

        // Update any dependency references
        for (const [depKey, deps] of this.dependencyGraph.entries()) {
            const index = deps.indexOf(uriString);
            if (index !== -1) {
                deps.splice(index, 1);
            }
        }

        // Notify listeners
        this._onDidUpdateContext.fire(uri);
    }

    /**
     * Build the dependency graph from indexed files
     */
    private buildDependencyGraph(): void {
        this.dependencyGraph.clear();

        // Build the graph
        for (const [uriString, fileContext] of this.contextCache.entries()) {
            // Add this file to the graph
            if (!this.dependencyGraph.has(uriString)) {
                this.dependencyGraph.set(uriString, []);
            }

            // Process dependencies
            for (const depUri of fileContext.dependencies) {
                // Add dependency relationship
                const deps = this.dependencyGraph.get(uriString) || [];
                if (!deps.includes(depUri)) {
                    deps.push(depUri);
                }
                this.dependencyGraph.set(uriString, deps);

                // Ensure the dependency has an entry
                if (!this.dependencyGraph.has(depUri)) {
                    this.dependencyGraph.set(depUri, []);
                }
            }
        }
    }

    /**
     * Get file content as string
     */
    private async getFileContent(uri: URI): Promise<string | undefined> {
        try {
            // Check if the file is already open in an editor
            const model = this.modelService.getModel(uri);
            if (model) {
                return model.getValue();
            }

            // Otherwise, read from disk
            const content = await this.fileService.readFile(uri);
            return content.value.toString();
        } catch (error) {
            this.logService.error(`SuperCoderAI: Error reading file ${uri.toString()}`, error);
            return undefined;
        }
    }

    /**
     * Get the language for a file
     */
    private getLanguageForFile(uri: URI): string | undefined {
        // Get the language ID for the file
        const extension = uri.path.substring(uri.path.lastIndexOf('.') + 1);

        // Map common extensions to languages
        const extensionToLanguage: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascriptreact',
            'ts': 'typescript',
            'tsx': 'typescriptreact',
            'py': 'python',
            'java': 'java',
            'go': 'go',
            'rb': 'ruby',
            'cs': 'csharp',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'json': 'json',
            'md': 'markdown'
        };

        return extensionToLanguage[extension.toLowerCase()];
    }

    /**
     * Get the parser for a specific language
     */
    private async getParserForLanguage(language: string): Promise<any> {
        // This is a placeholder. In the real implementation, we would:
        // 1. Check if a language-specific parser is available from the SuperCoderAI extension
        // 2. Load and return the appropriate parser

        // Simulate loading a parser (this would be implemented by loading from the extension)
        return await this.simulateParserLoading(language);
    }

    /**
     * Simulated parser loading (replace with actual implementation)
     */
    private async simulateParserLoading(language: string): Promise<any> {
        // This is a placeholder that simulates a parser
        return {
            parseFile: async (path: string, content: string) => {
                // Simulate parsing delay
                await new Promise(resolve => setTimeout(resolve, 10));

                // Return a simplified context
                return {
                    summary: `${language} file with ${content.length} characters`,
                    dependencies: [],
                    symbols: [],
                };
            }
        };
    }

    /**
     * Get context for a specific file
     */
    public getFileContext(uri: URI): IFileContext | undefined {
        return this.contextCache.get(uri.toString());
    }

    /**
     * Get related context for a file based on relevance
     */
    public async getRelatedContext(uri: URI, maxFiles: number = this.config.maxFilesInContext): Promise<IFileContext[]> {
        // First, get relevance scores
        const relevanceScores = await this.getContextRelevance(uri);

        // Sort by relevance and take top N
        const topFiles = relevanceScores
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, maxFiles);

        // Map to file contexts
        return topFiles
            .map(item => this.contextCache.get(item.uri.toString()))
            .filter((context): context is IFileContext => !!context);
    }

    /**
     * Get relevance scores for context selection
     */
    public async getContextRelevance(uri: URI): Promise<IContextRelevance[]> {
        const uriString = uri.toString();

        // Check cache first
        if (this.relevanceCache.has(uriString)) {
            return this.relevanceCache.get(uriString)!;
        }

        // Calculate relevance scores
        const relevanceScores: IContextRelevance[] = [];

        // Add the file itself with maximum relevance
        relevanceScores.push({
            uri,
            relevance: 1.0
        });

        // Add direct dependencies and dependent files with high relevance
        const dependencies = this.getDependencies(uri);
        for (const depUri of dependencies) {
            relevanceScores.push({
                uri: URI.parse(depUri),
                relevance: 0.9
            });
        }

        const dependents = this.getDependents(uri);
        for (const depUri of dependents) {
            relevanceScores.push({
                uri: URI.parse(depUri),
                relevance: 0.85
            });
        }

        // Add files in the same directory with medium relevance
        const sameDirectoryFiles = this.getFilesInSameDirectory(uri);
        for (const fileUri of sameDirectoryFiles) {
            if (fileUri.toString() !== uriString) {
                relevanceScores.push({
                    uri: fileUri,
                    relevance: 0.7
                });
            }
        }

        // Add files with similar names with medium relevance
        const similarNameFiles = this.getFilesWithSimilarNames(uri);
        for (const fileUri of similarNameFiles) {
            if (fileUri.toString() !== uriString) {
                relevanceScores.push({
                    uri: fileUri,
                    relevance: 0.6
                });
            }
        }

        // Cache the results
        this.relevanceCache.set(uriString, relevanceScores);

        // Notify listeners
        this._onDidChangeContextRelevance.fire(relevanceScores);

        return relevanceScores;
    }

    /**
     * Get dependencies of a file
     */
    private getDependencies(uri: URI): string[] {
        const uriString = uri.toString();
        const fileContext = this.contextCache.get(uriString);

        if (fileContext) {
            return fileContext.dependencies;
        }

        return [];
    }

    /**
     * Get files that depend on a file
     */
    private getDependents(uri: URI): string[] {
        const uriString = uri.toString();
        const dependents = [];

        for (const [fileUri, deps] of this.dependencyGraph.entries()) {
            if (deps.includes(uriString)) {
                dependents.push(fileUri);
            }
        }

        return dependents;
    }

    /**
     * Get files in the same directory
     */
    private getFilesInSameDirectory(uri: URI): URI[] {
        const directory = uri.with({ path: uri.path.substring(0, uri.path.lastIndexOf('/')) });
        const directoryStr = directory.toString();

        return Array.from(this.contextCache.keys())
            .filter(uriStr => {
                const fileUri = URI.parse(uriStr);
                const fileDir = fileUri.with({ path: fileUri.path.substring(0, fileUri.path.lastIndexOf('/')) });
                return fileDir.toString() === directoryStr;
            })
            .map(uriStr => URI.parse(uriStr));
    }

    /**
     * Get files with similar names
     */
    private getFilesWithSimilarNames(uri: URI): URI[] {
        const fileName = uri.path.substring(uri.path.lastIndexOf('/') + 1);
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));

        return Array.from(this.contextCache.keys())
            .filter(uriStr => {
                const fileUri = URI.parse(uriStr);
                const otherFileName = fileUri.path.substring(fileUri.path.lastIndexOf('/') + 1);
                const otherBaseName = otherFileName.substring(0, otherFileName.lastIndexOf('.'));

                return otherBaseName.includes(baseName) || baseName.includes(otherBaseName);
            })
            .map(uriStr => URI.parse(uriStr));
    }

    /**
     * Save context cache to storage
     */
    private saveContextCache(): void {
        try {
            // Convert to serializable format
            const serializedCache: Record<string, any> = {};

            for (const [key, value] of this.contextCache.entries()) {
                serializedCache[key] = {
                    uri: value.uri.toString(),
                    language: value.language,
                    summary: value.summary,
                    dependencies: value.dependencies,
                    symbols: value.symbols,
                    lastModified: value.lastModified
                };
            }

            // Save to storage
            this.storageService.store(
                ContextManager.CACHE_KEY,
                JSON.stringify(serializedCache),
                StorageScope.WORKSPACE,
                StorageTarget.MACHINE
            );
        } catch (error) {
            this.logService.error('SuperCoderAI: Error saving context cache', error);
        }
    }

    /**
     * Load context cache from storage
     */
    private loadContextCache(): void {
        try {
            const cachedData = this.storageService.get(
                ContextManager.CACHE_KEY,
                StorageScope.WORKSPACE
            );

            if (!cachedData) {
                return;
            }

            const parsedCache = JSON.parse(cachedData);
            const now = Date.now();

            for (const [key, value] of Object.entries(parsedCache)) {
                const cachedItem = value as any;

                // Skip items past their TTL
                if (now - cachedItem.lastModified > this.config.cacheTTL) {
                    continue;
                }

                // Convert back to IFileContext
                this.contextCache.set(key, {
                    uri: URI.parse(cachedItem.uri),
                    language: cachedItem.language,
                    context: {},  // We don't cache the full parsed context
                    summary: cachedItem.summary,
                    dependencies: cachedItem.dependencies,
                    symbols: cachedItem.symbols,
                    lastModified: cachedItem.lastModified
                });
            }

            // Rebuild dependency graph
            this.buildDependencyGraph();
        } catch (error) {
            this.logService.error('SuperCoderAI: Error loading context cache', error);
        }
    }

    /**
     * Clear the context cache
     */
    public clearCache(): void {
        this.contextCache.clear();
        this.relevanceCache.clear();
        this.dependencyGraph.clear();

        // Remove from storage
        this.storageService.remove(
            ContextManager.CACHE_KEY,
            StorageScope.WORKSPACE
        );

        this.logService.info('SuperCoderAI: Context cache cleared');
    }

    /**
     * Dispose of resources
     */
    public override dispose(): void {
        this.tearDownFileWatcher();
        this._onDidUpdateContext.dispose();
        this._onDidChangeContextRelevance.dispose();
        this._onDidCompleteProjectIndexing.dispose();

        // Save cache if enabled
        if (this.config.cacheEnabled) {
            this.saveContextCache();
        }

        super.dispose();
    }
}
