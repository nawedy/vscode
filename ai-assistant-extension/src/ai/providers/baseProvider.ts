import * as vscode from 'vscode';
import { ConfigService } from '../../services/configService';
import { Logger } from '../../utils/logger';

/**
 * Model capabilities
 */
export enum ModelCapability {
	ChatCompletion = 'chatCompletion',
	CodeCompletion = 'codeCompletion',
	CodeGeneration = 'codeGeneration',
	Explanation = 'explanation',
	Refactoring = 'refactoring',
	Planning = 'planning',
	Testing = 'testing',
	SecurityAnalysis = 'securityAnalysis',
	Chat = 'chat',
	Completion = 'completion',
	Embedding = 'embedding',
	ImageGeneration = 'image-generation',
	Summarization = 'summarization',
	EditingAssistance = 'editing-assistance'
}

/**
 * Model information
 */
export interface ModelInfo {
	/** Unique model ID */
	id: string;
	/** Display name */
	name: string;
	/** Context length in tokens */
	contextLength: number;
	/** Supported capabilities */
	capabilities: ModelCapability[];
	/** Whether the model is available */
	available: boolean;
	/** Additional model parameters */
	parameters?: Record<string, any>;
}

/**
 * Model request options
 */
export interface ModelRequestOptions {
	/** Maximum number of tokens to generate */
	maxTokens?: number;
	/** Temperature for generation */
	temperature?: number;
	/** Top-p sampling parameter */
	topP?: number;
	/** Top-k sampling parameter */
	topK?: number;
	/** Frequency penalty */
	frequencyPenalty?: number;
	/** Presence penalty */
	presencePenalty?: number;
	/** Stop sequences */
	stopSequences?: string[];
	/** System prompt */
	systemPrompt?: string;
	/** Model capability to use */
	capability?: ModelCapability;
	/** Additional model-specific parameters */
	modelParams?: Record<string, any>;
}

/**
 * Model response data
 */
export interface ModelResponse {
	/** Text content */
	content: string;
	/** Prompt tokens used */
	promptTokens?: number;
	/** Completion tokens used */
	completionTokens?: number;
	/** Total tokens used */
	totalTokens?: number;
	/** Additional response metadata */
	metadata?: Record<string, any>;
}

/**
 * Error class for model provider issues
 */
export class ModelProviderError extends Error {
	public readonly providerId: string;
	public readonly modelId?: string;
	public readonly status?: string;

	/**
	 * Create a new model provider error
	 * @param message Error message
	 * @param providerId Provider ID
	 * @param modelId Optional model ID
	 * @param status Optional status code
	 */
	constructor(message: string, providerId: string, modelId?: string, status?: string) {
		super(message);
		this.name = 'ModelProviderError';
		this.providerId = providerId;
		this.modelId = modelId;
		this.status = status;
	}
}

/**
 * Streaming response handler
 */
export interface StreamingResponseHandler {
	/** Called when content is received */
	onContent: (content: string) => void;
	/** Called when the response is complete */
	onComplete: (response: ModelResponse) => void;
	/** Called when an error occurs */
	onError: (error: Error) => void;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'function';
	content: string;
	name?: string;
}

/**
 * Completion options
 */
export interface CompletionOptions {
	model: string;
	prompt: string;
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	stopSequences?: string[];
	systemPrompt?: string;
}

/**
 * Provider model grouping
 */
export interface ProviderModelGroup {
	name: string;
	description?: string;
	models: ModelInfo[];
}

/**
 * Token usage information
 */
export interface TokenUsageInfo {
	provider: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	timestamp?: number;
}

/**
 * Base model provider class
 */
export abstract class BaseModelProvider implements vscode.Disposable {
	/** Provider ID */
	public readonly id: string;
	/** Provider display name */
	public readonly name: string;
	/** Provider models */
	protected models: Map<string, ModelInfo> = new Map();
	/** Ready state */
	protected _isReady: boolean = false;
	/** Logger instance */
	protected readonly logger?: Logger;
	/** Configuration service */
	protected readonly configService?: ConfigService;

	/**
	 * Create a new model provider
	 * @param id Provider ID
	 * @param name Provider display name
	 * @param configService Optional configuration service
	 * @param logger Optional logger instance
	 */
	constructor(id: string, name: string, configService?: ConfigService, logger?: Logger) {
		this.id = id;
		this.name = name;
		this.configService = configService;
		this.logger = logger;
	}

	/**
	 * Check if provider is ready
	 */
	public get isReady(): boolean {
		return this._isReady;
	}

	/**
	 * Initialize the provider
	 * @returns Whether initialization was successful
	 */
	public abstract initialize(): Promise<boolean>;

	/**
	 * Generate completion from a prompt
	 * @param prompt The prompt text
	 * @param options Request options
	 * @returns Model response
	 */
	public abstract generateCompletion(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse>;

	/**
	 * Generate completion from a prompt with streaming response
	 * @param prompt The prompt text
	 * @param handler Streaming handler
	 * @param options Request options
	 */
	public abstract generateCompletionStream(
		prompt: string,
		handler: StreamingResponseHandler,
		options?: ModelRequestOptions
	): Promise<void>;

	/**
	 * Count tokens in a text
	 * @param text The text to count tokens for
	 * @returns Token count
	 */
	public abstract countTokens(text: string): Promise<number>;

	/**
	 * Get available models
	 * @returns Map of model ID to model info
	 */
	public getModels(): Map<string, ModelInfo> {
		return new Map(this.models);
	}

	/**
	 * Get model info by ID
	 * @param modelId Model ID
	 * @returns Model info or null if not found
	 */
	public abstract getModelInfo(modelId: string): ModelInfo | null;

	/**
	 * Get default model ID for a capability
	 * @param capability Model capability
	 * @returns Model ID or null if no suitable model found
	 */
	public abstract getDefaultModelForCapability(capability: ModelCapability): Promise<string | null>;

	/**
	 * Update token usage statistics
	 * @param usage Token usage information
	 */
	protected updateTokenUsage(usage: TokenUsageInfo): void {
		// Add timestamp if not provided
		if (!usage.timestamp) {
			usage.timestamp = Date.now();
		}

		// Log token usage
		this.logger?.info(`Token usage: ${usage.model} - ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)`);

		// In a real implementation, this could persist the usage information
		// or emit an event for tracking services
	}

	/**
	 * Dispose of resources
	 */
	public abstract dispose(): void;
}
