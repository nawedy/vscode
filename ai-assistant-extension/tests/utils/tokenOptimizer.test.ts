import * as assert from 'assert';
import * as sinon from 'sinon';
import { TokenOptimizer, TokenOptimizationOptions } from '../../src/utils/tokenOptimizer';
import { BaseModelProvider } from '../../src/ai/providers/baseProvider';
import { Logger } from '../../src/utils/logger';

// Mock model provider for testing
class MockModelProvider {
	countTokensCalls: number = 0;

	async countTokens(text: string): Promise<number> {
		this.countTokensCalls++;
		// Simplified token counting algorithm for testing
		// Assume 1 token per 4 characters, which is a rough approximation
		return Math.ceil(text.length / 4);
	}
}

describe('TokenOptimizer', function () {
	let mockProvider: MockModelProvider;
	let logger: Logger;
	let tokenOptimizer: TokenOptimizer;

	const sampleCode = `// This is a sample function
function calculateTotal(items) {
	// Calculate the total price
	let total = 0;

	// Loop through all items
	for (const item of items) {
		total += item.price;
	}

	// Apply tax if needed
	if (total > 100) {
		total = total * 1.1; // 10% tax
	}

	// Return the result
	return total;
}

// Usage example
const items = [
	{ name: 'Item 1', price: 50 },
	{ name: 'Item 2', price: 75 }
];

// Calculate and log the result
console.log(calculateTotal(items));`;

	beforeEach(() => {
		mockProvider = new MockModelProvider();
		logger = new Logger('test');
		tokenOptimizer = new TokenOptimizer(mockProvider as unknown as BaseModelProvider, logger);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('optimizeContent', () => {
		it('should return original content if within token limit', async () => {
			const content = 'This is a short text';
			const options: TokenOptimizationOptions = {
				maxTokens: 100
			};

			const result = await tokenOptimizer.optimizeContent(content, options);

			assert.strictEqual(result, content);
			assert.strictEqual(mockProvider.countTokensCalls, 1);
		});

		it('should optimize content by removing lower priority chunks', async () => {
			const options: TokenOptimizationOptions = {
				maxTokens: 20, // Very small limit to force optimization
				includeSummary: false
			};

			const result = await tokenOptimizer.optimizeContent(sampleCode, options);

			// Result should be shorter than original
			assert.ok(result.length < sampleCode.length);

			// Should contain most important parts (function signature)
			assert.ok(result.includes('function calculateTotal'));

			// Should have removed comments which have lower priority
			assert.ok(!result.includes('// This is a sample function'));
		});

		it('should include summary when requested', async () => {
			const options: TokenOptimizationOptions = {
				maxTokens: 30,
				includeSummary: true
			};

			const result = await tokenOptimizer.optimizeContent(sampleCode, options);

			// Should include summary header
			assert.ok(result.includes('Note: This content has been optimized'));
			assert.ok(result.includes('sections were removed'));
		});

		it('should preserve structure when requested', async () => {
			const options: TokenOptimizationOptions = {
				maxTokens: 40,
				preserveStructure: true
			};

			// Original code structure
			const structuredCode = `function example() {
  // Start example
  doSomething();
  // Middle comment
  doSomethingElse();
  // End example
}`;

			const result = await tokenOptimizer.optimizeContent(structuredCode, options);

			// Should preserve function structure even if some comments are removed
			assert.ok(result.includes('function example()'));
			assert.ok(result.includes('doSomething();'));
			assert.ok(result.includes('doSomethingElse();'));
			assert.ok(result.includes('}'));
		});
	});

	describe('splitContentIntoChunks', () => {
		it('should return original content as single chunk if within limit', async () => {
			const content = 'This is a short text';

			const result = await tokenOptimizer.splitContentIntoChunks(content, 100);

			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0], content);
		});

		it('should split content into multiple chunks if needed', async () => {
			const options = {
				maxTokensPerChunk: 10
			};

			const result = await tokenOptimizer.splitContentIntoChunks(sampleCode, options.maxTokensPerChunk);

			// Should have multiple chunks
			assert.ok(result.length > 1);

			// Each chunk should be relatively small
			for (const chunk of result) {
				const tokens = await mockProvider.countTokens(chunk);
				assert.ok(tokens <= options.maxTokensPerChunk);
			}
		});

		it('should handle very long lines by splitting them', async () => {
			const longLine = 'x'.repeat(500); // Very long line

			const result = await tokenOptimizer.splitContentIntoChunks(longLine, 30);

			// Should split into multiple chunks
			assert.ok(result.length > 1);
		});
	});
});
