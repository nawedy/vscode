import * as vscode from 'vscode';
import { Logger } from './logger';

export enum ErrorSeverity {
	Info = 'info',
	Warning = 'warning',
	Error = 'error',
	Critical = 'critical'
}

export interface ErrorDetails {
	message: string;
	severity: ErrorSeverity;
	source?: string;
	stack?: string;
	timestamp: number;
}

/**
 * Error categories for better user feedback
 */
export enum ErrorCategory {
	Authentication = 'authentication',
	Network = 'network',
	Authorization = 'authorization',
	RateLimit = 'rateLimit',
	InvalidRequest = 'invalidRequest',
	ServerError = 'serverError',
	TokenLimit = 'tokenLimit',
	ContentFilter = 'contentFilter',
	Timeout = 'timeout',
	Unknown = 'unknown'
}

/**
 * Standardized error object with categorization
 */
export interface StandardizedError {
	message: string;
	category: ErrorCategory;
	originalError?: Error;
	providerName?: string;
	statusCode?: number;
	retryable: boolean;
	suggestedAction?: string;
}

/**
 * Provider-specific error mapping functions
 */
export interface ErrorMapper {
	mapOpenAIError(error: any): StandardizedError;
	mapAnthropicError(error: any): StandardizedError;
	mapMistralError(error: any): StandardizedError;
	mapQwenError(error: any): StandardizedError;
	mapGenericError(error: any, providerName?: string): StandardizedError;
}

/**
 * Error handling utility for AI providers
 */
export class ErrorHandler {
	constructor(private readonly logger: Logger) {}

	/**
	 * Map provider-specific errors to standardized format
	 * @param error The original error
	 * @param providerName Provider name for context
	 * @returns Standardized error object
	 */
	public mapError(error: any, providerName: string): StandardizedError {
		// Handle axios errors which have a response property
		if (error.response) {
			const statusCode = error.response.status;

			// Common error handling based on HTTP status
			switch (statusCode) {
				case 401:
					return {
						message: 'Authentication failed. Please check your API key.',
						category: ErrorCategory.Authentication,
						originalError: error,
						providerName,
						statusCode,
						retryable: false,
						suggestedAction: 'Update your API key in settings'
					};
				case 403:
					return {
						message: 'Not authorized to access this resource.',
						category: ErrorCategory.Authorization,
						originalError: error,
						providerName,
						statusCode,
						retryable: false,
						suggestedAction: 'Check account permissions'
					};
				case 429:
					return {
						message: 'Rate limit exceeded. Please try again later.',
						category: ErrorCategory.RateLimit,
						originalError: error,
						providerName,
						statusCode,
						retryable: true,
						suggestedAction: 'Wait before making additional requests'
					};
				case 400:
					return {
						message: 'Invalid request to AI provider.',
						category: ErrorCategory.InvalidRequest,
						originalError: error,
						providerName,
						statusCode,
						retryable: false
					};
				case 500:
				case 502:
				case 503:
				case 504:
					return {
						message: `Server error from ${providerName}.`,
						category: ErrorCategory.ServerError,
						originalError: error,
						providerName,
						statusCode,
						retryable: true,
						suggestedAction: 'Try again later'
					};
			}

			// Provider specific error handling based on response data
			const errorData = error.response.data || {};

			// Check provider-specific codes
			switch (providerName.toLowerCase()) {
				case 'openai':
					return this.mapOpenAIError(error);
				case 'anthropic':
					return this.mapAnthropicError(error);
				case 'mistral':
					return this.mapMistralError(error);
				case 'qwen':
					return this.mapQwenError(error);
				default:
					// Generic message from error response
					const message = errorData.error?.message || errorData.message || `Error with ${providerName}`;
					return {
						message,
						category: ErrorCategory.Unknown,
						originalError: error,
						providerName,
						statusCode,
						retryable: false
					};
			}
		}

		// Network errors
		if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message?.includes('network')) {
			return {
				message: `Network error connecting to ${providerName}. Please check your internet connection.`,
				category: ErrorCategory.Network,
				originalError: error,
				providerName,
				retryable: true,
				suggestedAction: 'Check your internet connection'
			};
		}

		// Timeout errors
		if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
			return {
				message: `Request to ${providerName} timed out. Please try again.`,
				category: ErrorCategory.Timeout,
				originalError: error,
				providerName,
				retryable: true,
				suggestedAction: 'Try again or reduce request complexity'
			};
		}

		// Default generic error
		return {
			message: error.message || `Unknown error with ${providerName}`,
			category: ErrorCategory.Unknown,
			originalError: error,
			providerName,
			retryable: false
		};
	}

	/**
	 * Map OpenAI specific errors
	 * @param error OpenAI error
	 * @returns Standardized error
	 */
	private mapOpenAIError(error: any): StandardizedError {
		const errorData = error.response?.data || {};
		const errorType = errorData.error?.type || '';
		const errorCode = errorData.error?.code || '';

		// Handle token limit errors
		if (errorType === 'tokens' || errorCode === 'context_length_exceeded') {
			return {
				message: 'Input is too long for model context window.',
				category: ErrorCategory.TokenLimit,
				originalError: error,
				providerName: 'OpenAI',
				statusCode: error.response?.status,
				retryable: false,
				suggestedAction: 'Reduce input length or choose a model with larger context'
			};
		}

		// Handle content filter errors
		if (errorCode === 'content_filter' || errorType === 'moderation') {
			return {
				message: 'Content was flagged by the content filter.',
				category: ErrorCategory.ContentFilter,
				originalError: error,
				providerName: 'OpenAI',
				statusCode: error.response?.status,
				retryable: false,
				suggestedAction: 'Modify your input content'
			};
		}

		// General OpenAI error with available message
		const message = errorData.error?.message || 'Unknown OpenAI error';
		return {
			message,
			category: ErrorCategory.Unknown,
			originalError: error,
			providerName: 'OpenAI',
			statusCode: error.response?.status,
			retryable: false
		};
	}

	/**
	 * Map Anthropic specific errors
	 * @param error Anthropic error
	 * @returns Standardized error
	 */
	private mapAnthropicError(error: any): StandardizedError {
		const errorData = error.response?.data || {};
		const errorType = errorData.type || '';

		if (errorType === 'invalid_request_error') {
			if (errorData.message?.includes('token')) {
				return {
					message: 'Input is too long for model context window.',
					category: ErrorCategory.TokenLimit,
					originalError: error,
					providerName: 'Anthropic',
					statusCode: error.response?.status,
					retryable: false,
					suggestedAction: 'Reduce input length or choose a model with larger context'
				};
			}

			return {
				message: errorData.message || 'Invalid request to Anthropic',
				category: ErrorCategory.InvalidRequest,
				originalError: error,
				providerName: 'Anthropic',
				statusCode: error.response?.status,
				retryable: false
			};
		}

		if (errorType === 'authentication_error') {
			return {
				message: 'Authentication failed with Anthropic. Please check your API key.',
				category: ErrorCategory.Authentication,
				originalError: error,
				providerName: 'Anthropic',
				statusCode: error.response?.status,
				retryable: false,
				suggestedAction: 'Update your API key in settings'
			};
		}

		// General Anthropic error
		const message = errorData.message || 'Unknown Anthropic error';
		return {
			message,
			category: ErrorCategory.Unknown,
			originalError: error,
			providerName: 'Anthropic',
			statusCode: error.response?.status,
			retryable: false
		};
	}

	/**
	 * Map Mistral specific errors
	 * @param error Mistral error
	 * @returns Standardized error
	 */
	private mapMistralError(error: any): StandardizedError {
		const errorData = error.response?.data || {};

		// Check for token limit errors
		if (errorData.message?.includes('context') || errorData.message?.includes('token')) {
			return {
				message: 'Input is too long for Mistral model context window.',
				category: ErrorCategory.TokenLimit,
				originalError: error,
				providerName: 'Mistral',
				statusCode: error.response?.status,
				retryable: false,
				suggestedAction: 'Reduce input length or choose a model with larger context'
			};
		}

		// General Mistral error
		const message = errorData.message || errorData.detail || 'Unknown Mistral error';
		return {
			message,
			category: ErrorCategory.Unknown,
			originalError: error,
			providerName: 'Mistral',
			statusCode: error.response?.status,
			retryable: false
		};
	}

	/**
	 * Map Qwen specific errors
	 * @param error Qwen error
	 * @returns Standardized error
	 */
	private mapQwenError(error: any): StandardizedError {
		const errorData = error.response?.data || {};

		// Check for token limit errors in Qwen responses
		if (errorData.message?.includes('tokens') || errorData.message?.includes('length')) {
			return {
				message: 'Input is too long for Qwen model context window.',
				category: ErrorCategory.TokenLimit,
				originalError: error,
				providerName: 'Qwen',
				statusCode: error.response?.status,
				retryable: false,
				suggestedAction: 'Reduce input length or choose a model with larger context'
			};
		}

		// General Qwen error
		const message = errorData.message || 'Unknown Qwen error';
		return {
			message,
			category: ErrorCategory.Unknown,
			originalError: error,
			providerName: 'Qwen',
			statusCode: error.response?.status,
			retryable: false
		};
	}

	/**
	 * Handle error by showing appropriate UI message and logging
	 * @param error Error to handle
	 * @param userFacingMessage User-friendly message
	 * @param silent Whether to suppress notifications
	 */
	public async handleError(error: any, userFacingMessage?: string, silent: boolean = false): Promise<void> {
		// Get standardized error if not already standardized
		const standardError = (error as StandardizedError).category
			? error as StandardizedError
			: this.mapError(error, 'AI provider');

		// Log the error with details
		this.logger.error(`${userFacingMessage || standardError.message} - Category: ${standardError.category}, Provider: ${standardError.providerName || 'unknown'}`);
		if (standardError.originalError) {
			this.logger.error(`Original error: ${standardError.originalError.message}`);
		}

		// Don't show notification if silent mode requested
		if (silent) {
			return;
		}

		// Show notification with action buttons if available
		const message = userFacingMessage || standardError.message;

		if (standardError.suggestedAction) {
			const action = await vscode.window.showErrorMessage(
				message,
				...(standardError.retryable ? ['Retry'] : []),
				standardError.suggestedAction
			);

			// Handle action button clicks
			if (action === 'Retry') {
				// Signal that retry was requested - specific implementers can handle
				return Promise.reject({ retry: true, originalError: error });
			} else if (action === standardError.suggestedAction) {
				// Handle suggested action based on error category
				await this.handleSuggestedAction(standardError);
			}
		} else {
			// Simple error message without actions
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Handle suggested action based on error category
	 * @param error Standardized error
	 */
	private async handleSuggestedAction(error: StandardizedError): Promise<void> {
		switch (error.category) {
			case ErrorCategory.Authentication:
				// Open settings for API key configuration
				vscode.commands.executeCommand('workbench.action.openSettings', 'aiAssistant.api');
				break;

			case ErrorCategory.TokenLimit:
				// Show token usage info
				vscode.commands.executeCommand('aiAssistant.showTokenUsage');
				break;

			// More specific handlers can be added here
		}
	}

	public async showError(message: string, ...actions: string[]): Promise<string | undefined> {
		this.logger.error(message);
		return await vscode.window.showErrorMessage(message, ...actions);
	}
}
