/**
 * RefactoringEnsemble
 *
 * Specialized ensemble for code refactoring operations.
 * Uses AI models to analyze and improve code structure and quality.
 */

import * as vscode from 'vscode';
import { EnsembleLLM, TaskResult } from './ensembleLLM';
import { ModelManager } from '../modelManager';
import { Logger } from '../../utils/logger';
import { ConfigService } from '../../services/configService';
import { ModelCapability } from '../providers/baseProvider';
import { CodeContext } from '../../context/contextManager';

interface RefactoringParams {
    code: string;
    language: string;
    context?: CodeContext;
    refactoringType?: 'extract' | 'rename' | 'move' | 'optimize';
}

interface RefactoringResult {
    refactoredCode: string;
    changes: CodeChange[];
    explanation: string;
}

interface CodeChange {
    type: 'add' | 'remove' | 'modify';
    path: string;
    oldContent?: string;
    newContent: string;
    explanation: string;
}

/**
 * RefactoringEnsemble for code improvement operations
 */
export class RefactoringEnsemble extends EnsembleLLM {
    /**
     * Create a new refactoring ensemble
     * @param modelManager Model manager
     * @param logger Logger
     * @param configService Configuration service
     */
    constructor(
        modelManager: ModelManager,
        logger: Logger,
        configService: ConfigService
    ) {
        super(modelManager, logger, configService, 'refactoring');
        this.registerTasks();
    }

    private registerTasks(): void {
        this.registerTask('refactorCode', this.refactorCode.bind(this));
        this.registerTask('suggestRefactoring', this.suggestRefactoring.bind(this));
        this.registerTask('optimizeCode', this.optimizeCode.bind(this));
    }

    /**
     * Get the name of the ensemble
     */
    get name(): string {
        return 'RefactoringEnsemble';
    }

    /**
     * Refactor code according to specified goals
     * @param params Task parameters
     * @returns Refactored code and explanation
     */
    async task_refactorCode(params: {
        originalCode: string;
        refactoringGoals: string[];
        language: string;
        projectContext?: any;
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { originalCode, refactoringGoals, language, projectContext } = params;

            // Create prompt
            const prompt = `Refactor the following ${language} code according to these goals: ${refactoringGoals.join(', ')}

Original code:
\`\`\`${language}
${originalCode}
\`\`\`

${projectContext ? `Project context:
${JSON.stringify(projectContext, null, 2)}` : ''}

Return the refactored code directly in a code block, followed by a detailed explanation of the changes made and how they align with the refactoring goals.`;

            // Generate refactored code
            const result = await this.execute(
                prompt,
                ModelCapability.Refactoring,
                {
                    temperature: 0.1,  // Low temperature for precise refactoring
                    maxTokens: Math.max(1024, originalCode.length * 2)  // Enough tokens for code + explanation
                }
            );

            // Extract refactored code and explanation
            const codeMatch = result.content.match(/```(?:\w+)?\s*([\s\S]+?)```/);
            const refactoredCode = codeMatch ? codeMatch[1].trim() : '';

            // Everything after the code block is the explanation
            let verification = '';
            if (codeMatch && codeMatch.index !== undefined) {
                verification = result.content.substring(codeMatch.index + codeMatch[0].length).trim();
            }

            return {
                content: {
                    refactoredCode,
                    verification,
                    goals: refactoringGoals
                },
                metrics: {
                    taskType: 'refactorCode',
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
            this.logger.error(`Error refactoring code: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to refactor code: ${error instanceof Error ? error.message : String(error)}`,
                    refactoredCode: params.originalCode,  // Return original code on error
                    verification: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    goals: params.refactoringGoals
                },
                metrics: {
                    taskType: 'refactorCode',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Optimize code for performance
     * @param params Task parameters
     * @returns Optimized code and performance analysis
     */
    async task_optimizeCode(params: {
        originalCode: string;
        optimizationGoals: string[];
        language: string;
        projectContext?: any;
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { originalCode, optimizationGoals, language, projectContext } = params;

            // Create prompt
            const prompt = `Optimize the following ${language} code according to these performance goals: ${optimizationGoals.join(', ')}

Original code:
\`\`\`${language}
${originalCode}
\`\`\`

${projectContext ? `Project context:
${JSON.stringify(projectContext, null, 2)}` : ''}

Return the optimized code directly in a code block, followed by a detailed performance analysis explaining:
1. What specific optimizations were made
2. How they improve performance
3. Any time or space complexity improvements
4. Any potential trade-offs made`;

            // Generate optimized code
            const result = await this.execute(
                prompt,
                ModelCapability.Refactoring,
                {
                    temperature: 0.1,
                    maxTokens: Math.max(1024, originalCode.length * 2)
                }
            );

            // Extract optimized code and analysis
            const codeMatch = result.content.match(/```(?:\w+)?\s*([\s\S]+?)```/);
            const optimizedCode = codeMatch ? codeMatch[1].trim() : '';

            // Everything after the code block is the analysis
            let performanceAnalysis = '';
            if (codeMatch && codeMatch.index !== undefined) {
                performanceAnalysis = result.content.substring(codeMatch.index + codeMatch[0].length).trim();
            }

            return {
                content: {
                    optimizedCode,
                    performanceAnalysis,
                    goals: optimizationGoals
                },
                metrics: {
                    taskType: 'optimizeCode',
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
            this.logger.error(`Error optimizing code: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to optimize code: ${error instanceof Error ? error.message : String(error)}`,
                    optimizedCode: params.originalCode,  // Return original code on error
                    performanceAnalysis: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    goals: params.optimizationGoals
                },
                metrics: {
                    taskType: 'optimizeCode',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Improve code quality
     * @param params Task parameters
     * @returns Improved code and explanation
     */
    async task_improveCode(params: {
        originalCode: string;
        improvementGoals: string[];
        language: string;
        projectContext?: any;
        mode?: string;
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { originalCode, improvementGoals, language, projectContext, mode } = params;

            // Special handling for explanation mode
            if (mode === 'explain') {
                return this.explainCode({
                    code: originalCode,
                    language,
                    detailLevel: improvementGoals[0]?.includes('Basic') ? 'basic' :
                        improvementGoals[0]?.includes('Expert') ? 'expert' : 'detailed'
                });
            }

            // Create prompt
            const prompt = `Improve the following ${language} code according to these goals: ${improvementGoals.join(', ')}

Original code:
\`\`\`${language}
${originalCode}
\`\`\`

${projectContext ? `Project context:
${JSON.stringify(projectContext, null, 2)}` : ''}

Return the improved code directly in a code block, followed by a detailed explanation of the changes made and how they improve the code quality.`;

            // Generate improved code
            const result = await this.execute(
                prompt,
                ModelCapability.Refactoring,
                {
                    temperature: 0.1,
                    maxTokens: Math.max(1024, originalCode.length * 2)
                }
            );

            // Extract improved code and explanation
            const codeMatch = result.content.match(/```(?:\w+)?\s*([\s\S]+?)```/);
            const improvedCode = codeMatch ? codeMatch[1].trim() : '';

            // Everything after the code block is the explanation
            let improvementExplanation = '';
            if (codeMatch && codeMatch.index !== undefined) {
                improvementExplanation = result.content.substring(codeMatch.index + codeMatch[0].length).trim();
            }

            return {
                content: {
                    improvedCode,
                    improvementExplanation,
                    goals: improvementGoals
                },
                metrics: {
                    taskType: 'improveCode',
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
            this.logger.error(`Error improving code: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to improve code: ${error instanceof Error ? error.message : String(error)}`,
                    improvedCode: params.originalCode,  // Return original code on error
                    improvementExplanation: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    goals: params.improvementGoals
                },
                metrics: {
                    taskType: 'improveCode',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Explain code
     * @param params Task parameters
     * @returns Code explanation
     */
    private async explainCode(params: {
        code: string;
        language: string;
        detailLevel: 'basic' | 'detailed' | 'expert';
    }): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            const { code, language, detailLevel } = params;

            // Create prompt
            const prompt = `Explain the following ${language} code with a ${detailLevel} level of detail:

\`\`\`${language}
${code}
\`\`\`

Provide a ${detailLevel} explanation covering:
1. What the code does (overall purpose)
2. How it works (implementation details)
3. Key functions/methods and their purposes
4. Any design patterns or programming techniques used
${detailLevel === 'expert' ? '5. Potential performance implications\n6. Possible edge cases or bugs' : ''}

Format your explanation with markdown headings, bullet points, and code examples where appropriate.`;

            // Generate explanation
            const result = await this.execute(
                prompt,
                ModelCapability.Explanation,
                {
                    temperature: 0.2,
                    maxTokens: Math.max(1024, code.length)
                }
            );

            return {
                content: {
                    explanation: result.content
                },
                metrics: {
                    taskType: 'explainCode',
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
            this.logger.error(`Error explaining code: ${error instanceof Error ? error.message : String(error)}`);

            return {
                content: {
                    error: `Failed to explain code: ${error instanceof Error ? error.message : String(error)}`,
                    explanation: `Error: ${error instanceof Error ? error.message : String(error)}`
                },
                metrics: {
                    taskType: 'explainCode',
                    startTime,
                    endTime: Date.now(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
}
