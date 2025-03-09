/**
 * TestingEnsemble
 *
 * Specialized ensemble for test generation and testing-related tasks.
 * Uses AI models to generate test cases, mocks, and testing utilities.
 */

import * as vscode from 'vscode';
import { EnsembleLLM, TaskResult } from './ensembleLLM';
import { ModelManager } from '../modelManager';
import { Logger } from '../../utils/logger';
import { ConfigService } from '../../services/configService';
import { ModelCapability } from '../providers/baseProvider';

interface TestGenerationParams {
    code: string;
    language: string;
    testFramework?: string;
    coverage?: 'unit' | 'integration' | 'e2e';
}

interface GeneratedTest {
    fileName: string;
    content: string;
    type: 'unit' | 'integration' | 'e2e';
    testCases: TestCase[];
}

interface TestCase {
    name: string;
    description: string;
    input?: Record<string, unknown>;
    expectedOutput?: unknown;
}

/**
 * TestingEnsemble for test generation and enhancement
 */
export class TestingEnsemble extends EnsembleLLM {
    /**
     * Create a new testing ensemble
     * @param modelManager Model manager
     * @param logger Logger
     * @param configService Configuration service
     */
    constructor(
        modelManager: ModelManager,
        logger: Logger,
        configService: ConfigService
    ) {
        super(modelManager, logger, configService, 'testingEnsemble');
        this.registerTasks();
    }

    private registerTasks(): void {
        this.registerTask('generateTests', this.generateTests.bind(this));
        this.registerTask('generateTestCases', this.generateTestCases.bind(this));
        this.registerTask('suggestTestCoverage', this.suggestTestCoverage.bind(this));
    }

    /**
     * Get the name of the ensemble
     */
    get name(): string {
        return 'TestingEnsemble';
    }

    /**
     * Generate unit tests for a given code
     * @param params Task parameters
     * @returns Test code and metadata
     */
    async task_generateUnitTests(params: {
        code: string;
        language: string;
        framework?: string;
        testingStyle?: 'unit' | 'integration' | 'e2e';
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { code, language, framework, testingStyle = 'unit' } = params;

            // Detect testing framework if not provided
            const detectedFramework = framework || await this.detectTestingFramework(language);

            // Create prompt
            const prompt = `Generate ${testingStyle} tests for the following ${language} code using the ${detectedFramework} testing framework.

Code to test:
\`\`\`${language}
${code}
\`\`\`

Requirements:
- Write comprehensive tests that cover the main functionality
- Include tests for edge cases and error handling
- Use modern testing patterns and best practices
- Use mocks or stubs where appropriate
- Make the tests readable and maintainable

Return the test code directly without explanation, enclosed in a code block.`;

            // Generate test code
            const result = await this.execute(
                prompt,
                ModelCapability.Testing,
                {
                    temperature: 0.2,  // Lower temperature for more focused results
                    maxTokens: 2048
                }
            );

            // Extract test code
            const testCodeMatch = result.content.match(/```(?:\w+)?\s*([\s\S]+?)```/);
            const testCode = testCodeMatch ? testCodeMatch[1].trim() : result.content.trim();

            // Generate test file name
            const testFileName = this.generateTestFileName(params.language);

            return {
                content: {
                    testCode,
                    testFileName,
                    framework: detectedFramework
                },
                metrics: {
                    taskType: 'generateUnitTests',
                    startTime,
                    endTime: Date.now(),
                    totalTokens: result.totalTokens,
                    promptTokens: result.promptTokens,
                    completionTokens: result.completionTokens,
                    numLLMCalls: 1
                },
                metadata: {
                    modelIds: [result.metadata?.model as string]
                }
            };
        } catch (error) {
            this.logger.error(`Error generating unit tests: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`,
                    testCode: '',
                    testFileName: this.generateTestFileName(params.language)
                },
                metrics: {
                    taskType: 'generateUnitTests',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Generate a test file name based on the target file name
     * @param language Programming language
     * @param targetFileName Optional target file name
     * @returns Test file name
     */
    private generateTestFileName(language: string, targetFileName?: string): string {
        const baseName = targetFileName ? targetFileName.replace(/\.\w+$/, '') : 'example';

        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
            case 'jsx':
            case 'tsx':
                return `${baseName}.test.${language}`;

            case 'python':
                return `test_${baseName}.py`;

            case 'java':
                return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Test.java`;

            case 'csharp':
            case 'cs':
                return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)}Tests.cs`;

            case 'go':
                return `${baseName}_test.go`;

            default:
                return `${baseName}_test.${language}`;
        }
    }

    /**
     * Detect appropriate testing framework based on language
     * @param language Programming language
     * @returns Testing framework name
     */
    private async detectTestingFramework(language: string): Promise<string> {
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
            case 'jsx':
            case 'tsx':
                return 'Jest';

            case 'python':
                return 'pytest';

            case 'java':
                return 'JUnit';

            case 'csharp':
            case 'cs':
                return 'xUnit';

            case 'go':
                return 'go testing';

            case 'ruby':
                return 'RSpec';

            case 'php':
                return 'PHPUnit';

            default:
                return 'an appropriate testing framework';
        }
    }

    /**
     * Generate test mocks for a given code
     * @param params Task parameters
     * @returns Mock code and metadata
     */
    async task_generateMocks(params: {
        code: string;
        language: string;
        dependencies: string[];
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { code, language, dependencies } = params;

            // Create prompt
            const prompt = `Generate mock implementations for the following dependencies in ${language}:

Dependencies to mock: ${dependencies.join(', ')}

Original code:
\`\`\`${language}
${code}
\`\`\`

Return the mock code directly without explanation, enclosed in a code block.`;

            // Generate mock code
            const result = await this.execute(
                prompt,
                ModelCapability.Testing,
                {
                    temperature: 0.2,
                    maxTokens: 1024
                }
            );

            // Extract mock code
            const mockCodeMatch = result.content.match(/```(?:\w+)?\s*([\s\S]+?)```/);
            const mockCode = mockCodeMatch ? mockCodeMatch[1].trim() : result.content.trim();

            return {
                content: {
                    mockCode,
                    dependencies
                },
                metrics: {
                    taskType: 'generateMocks',
                    startTime,
                    endTime: Date.now(),
                    totalTokens: result.totalTokens,
                    promptTokens: result.promptTokens,
                    completionTokens: result.completionTokens,
                    numLLMCalls: 1
                },
                metadata: {
                    modelIds: [result.metadata?.model as string]
                }
            };
        } catch (error) {
            this.logger.error(`Error generating mocks: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to generate mocks: ${error instanceof Error ? error.message : String(error)}`,
                    mockCode: '',
                    dependencies: params.dependencies
                },
                metrics: {
                    taskType: 'generateMocks',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Analyze test coverage
     * @param params Task parameters
     * @returns Coverage analysis
     */
    async task_analyzeCoverage(params: {
        code: string;
        tests: string;
        language: string;
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { code, tests, language } = params;

            // Create prompt
            const prompt = `Analyze test coverage for the following code and tests in ${language}:

Implementation code:
\`\`\`${language}
${code}
\`\`\`

Test code:
\`\`\`${language}
${tests}
\`\`\`

Please provide a detailed analysis of test coverage:
1. What functionality is covered by the tests?
2. What functionality is missing coverage?
3. Are there any edge cases not covered?
4. What is the approximate percentage of code coverage?

Return the analysis in JSON format with the following structure:
\`\`\`json
{
  "coveredFunctionality": ["list", "of", "covered", "functionality"],
  "missingCoverage": ["list", "of", "uncovered", "functionality"],
  "missingEdgeCases": ["list", "of", "uncovered", "edge", "cases"],
  "overallCoveragePercent": 85,
  "recommendedTests": ["list", "of", "recommended", "additional", "tests"]
}
\`\`\``;

            // Generate coverage analysis
            const result = await this.execute(
                prompt,
                ModelCapability.Testing,
                {
                    temperature: 0.1,
                    maxTokens: 1024
                }
            );

            // Extract JSON data
            const jsonMatch = result.content.match(/```(?:json)?\s*({[\s\S]+?})```/) || result.content.match(/({[\s\S]*"recommendedTests"[\s\S]*})/);
            let coverageData;

            if (jsonMatch && jsonMatch[1]) {
                try {
                    coverageData = JSON.parse(jsonMatch[1]);
                } catch (e) {
                    this.logger.warn(`Failed to parse JSON from result: ${e instanceof Error ? e.message : String(e)}`);
                    coverageData = {
                        coveredFunctionality: [],
                        missingCoverage: [],
                        missingEdgeCases: [],
                        overallCoveragePercent: 0,
                        recommendedTests: []
                    };
                }
            } else {
                // Fallback if JSON parse fails
                coverageData = {
                    coveredFunctionality: [],
                    missingCoverage: [],
                    missingEdgeCases: [],
                    overallCoveragePercent: 0,
                    recommendedTests: []
                };
            }

            return {
                content: coverageData,
                metrics: {
                    taskType: 'analyzeCoverage',
                    startTime,
                    endTime: Date.now(),
                    totalTokens: result.totalTokens,
                    promptTokens: result.promptTokens,
                    completionTokens: result.completionTokens,
                    numLLMCalls: 1
                },
                metadata: {
                    modelIds: [result.metadata?.model as string]
                }
            };
        } catch (error) {
            this.logger.error(`Error analyzing coverage: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to analyze coverage: ${error instanceof Error ? error.message : String(error)}`,
                    coveredFunctionality: [],
                    missingCoverage: [],
                    missingEdgeCases: [],
                    overallCoveragePercent: 0,
                    recommendedTests: []
                },
                metrics: {
                    taskType: 'analyzeCoverage',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
}
