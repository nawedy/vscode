import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory } from '../../src/utils/errorHandler';
import { Logger } from '../../src/utils/logger';

describe('ErrorHandler', function () {
	let logger: Logger;
	let errorHandler: ErrorHandler;

	beforeEach(() => {
		logger = new Logger('test');
		errorHandler = new ErrorHandler(logger);

		// Stub vscode.window.showErrorMessage
		sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('mapError', () => {
		it('should map authentication errors', () => {
			const error = {
				response: {
					status: 401,
					data: {
						error: {
							message: 'Invalid API key'
						}
					}
				}
			};

			const result = errorHandler.mapError(error, 'TestProvider');

			assert.strictEqual(result.category, ErrorCategory.Authentication);
			assert.strictEqual(result.message, 'Authentication failed. Please check your API key.');
			assert.strictEqual(result.retryable, false);
			assert.strictEqual(result.providerName, 'TestProvider');
			assert.strictEqual(result.statusCode, 401);
			assert.strictEqual(result.suggestedAction, 'Update your API key in settings');
		});

		it('should map rate limit errors', () => {
			const error = {
				response: {
					status: 429,
					data: {
						error: {
							message: 'Too many requests'
						}
					}
				}
			};

			const result = errorHandler.mapError(error, 'TestProvider');

			assert.strictEqual(result.category, ErrorCategory.RateLimit);
			assert.strictEqual(result.message, 'Rate limit exceeded. Please try again later.');
			assert.strictEqual(result.retryable, true);
			assert.strictEqual(result.suggestedAction, 'Wait before making additional requests');
		});

		it('should map network errors', () => {
			const error = {
				code: 'ECONNREFUSED',
				message: 'Connection refused'
			};

			const result = errorHandler.mapError(error, 'TestProvider');

			assert.strictEqual(result.category, ErrorCategory.Network);
			assert.strictEqual(result.retryable, true);
			assert.ok(result.message.includes('Network error connecting to TestProvider'));
		});

		it('should map timeout errors', () => {
			const error = {
				code: 'ETIMEDOUT',
				message: 'Request timed out'
			};

			const result = errorHandler.mapError(error, 'TestProvider');

			assert.strictEqual(result.category, ErrorCategory.Timeout);
			assert.strictEqual(result.retryable, true);
			assert.ok(result.message.includes('timed out'));
		});
	});

	describe('Provider-specific error mapping', () => {
		it('should map OpenAI token limit errors', () => {
			const error = {
				response: {
					status: 400,
					data: {
						error: {
							type: 'tokens',
							message: 'This model\'s maximum context length is 4097 tokens.'
						}
					}
				}
			};

			const result = errorHandler.mapError(error, 'OpenAI');

			assert.strictEqual(result.category, ErrorCategory.TokenLimit);
			assert.strictEqual(result.message, 'Input is too long for model context window.');
			assert.strictEqual(result.retryable, false);
		});

		it('should map Anthropic token limit errors', () => {
			const error = {
				response: {
					status: 400,
					data: {
						type: 'invalid_request_error',
						message: 'Prompt is too long, max tokens: 100000'
					}
				}
			};

			const result = errorHandler.mapError(error, 'Anthropic');

			assert.strictEqual(result.category, ErrorCategory.TokenLimit);
			assert.strictEqual(result.retryable, false);
			assert.strictEqual(result.suggestedAction, 'Reduce input length or choose a model with larger context');
		});
	});

	describe('handleError', () => {
		it('should log error details', async () => {
			const loggerSpy = sinon.spy(logger, 'error');

			const error = new Error('Test error');
			await errorHandler.handleError(error, 'User-facing message');

			assert.strictEqual(loggerSpy.calledTwice, true);
			assert.ok(loggerSpy.firstCall.args[0].includes('User-facing message'));
		});

		it('should show error notification with actions', async () => {
			const showErrorSpy = vscode.window.showErrorMessage as sinon.SinonStub;

			const error = {
				response: {
					status: 401,
					data: {}
				}
			};

			await errorHandler.handleError(error, 'API key is invalid');

			assert.strictEqual(showErrorSpy.calledOnce, true);
			assert.strictEqual(showErrorSpy.firstCall.args[0], 'API key is invalid');
			assert.ok(showErrorSpy.firstCall.args.includes('Update your API key in settings'));
		});

		it('should not show notification in silent mode', async () => {
			const showErrorSpy = vscode.window.showErrorMessage as sinon.SinonStub;

			const error = new Error('Test error');
			await errorHandler.handleError(error, 'Should not be shown', true);

			assert.strictEqual(showErrorSpy.called, false);
		});
	});
});
