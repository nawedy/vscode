/**
 * CodeGenerationEnsemble
 *
 * Specialized ensemble for code generation and implementation.
 * Handles generation of new code, completion of existing code,
 * and implementation of features across multiple files.
 */

import * as vscode from 'vscode';
import { EnsembleLLM, TaskResult } from './ensembleLLM';
import { ModelManager } from '../modelManager';
import { Logger } from '../../utils/logger';
import { ConfigService } from '../../services/configService';
import { ModelCapability } from '../providers/baseProvider';
import { CodeContext } from '../../context/contextManager';
import { FileParser } from '../../context/fileParser';
import { ProjectAnalyzer } from '../../context/projectAnalyzer';

/**
 * Generated code file
 */
export interface GeneratedCodeFile {
	fileName: string;
	content: string;
	language: string;
	documentation?: string;
}

/**
 * Code generation result
 */
export interface CodeGenerationResult {
	files: GeneratedCodeFile[];
	explanation?: string;
	testFiles?: GeneratedCodeFile[];
	metadata?: Record<string, unknown>;
}

/**
 * Feature implementation result
 */
export interface FeatureImplementationResult {
	files: GeneratedCodeFile[];
	implementationPlan: string;
}

/**
 * Params for generating code
 */
interface GenerateCodeParams {
	description: string;
	language: string;
	projectContext?: Record<string, unknown>;
}

/**
 * Params for implementing a feature
 */
interface ImplementFeatureParams {
	featureDescription: string;
	language: string;
	existingFiles?: Array<{
		filePath: string;
		content: string;
	}>;
	requiredFunctionality?: string[];
	context?: CodeContext;
}

/**
 * Params for implementing architecture
 */
interface ImplementArchitectureParams {
	architectureDescription: string;
	language: string;
	designPatterns?: string[];
	context?: CodeContext;
}

interface GenerationParams {
	prompt: string;
	language: string;
	context?: string;
	requirements?: string[];
}

interface GenerationResult {
	code: string;
	explanation?: string;
	tests?: string;
}

/**
 * Code generation ensemble for feature implementations
 */
export class CodeGenerationEnsemble extends EnsembleLLM {
	private readonly fileParser: FileParser;
	private readonly projectAnalyzer: ProjectAnalyzer;

	/**
	 * Create a new code generation ensemble
	 * @param modelManager Model manager
	 * @param logger Logger instance
	 * @param configService Configuration service
	 * @param fileParser File parser
	 * @param projectAnalyzer Project analyzer
	 */
	constructor(
		modelManager: ModelManager,
		logger: Logger,
		configService: ConfigService,
		fileParser: FileParser,
		projectAnalyzer: ProjectAnalyzer
	) {
		super(modelManager, logger, configService, 'codeGeneration');
		this.fileParser = fileParser;
		this.projectAnalyzer = projectAnalyzer;

		this.registerTasks();
	}

	private registerTasks(): void {
		this.registerTask('generateCode', this.generateCode.bind(this));
		this.registerTask('generateTests', this.generateTests.bind(this));
		this.registerTask('generateDocumentation', this.generateDocumentation.bind(this));
	}

	private async generateCode(params: GenerationParams): Promise<TaskResult<GenerationResult>> {
		try {
			// Generate code with multiple models
			const responses = await this.generate(
				this.buildCodePrompt(params),
				{
					capability: ModelCapability.CodeGeneration,
					minResponses: 2,
					votingStrategy: 'weighted'
				}
			);

			// Process and combine responses
			const result = this.processGenerationResults(responses);

			return {
				success: true,
				content: result
			};
		} catch (error) {
			return {
				success: false,
				error: `Code generation failed: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	private async generateTests(params: GenerationParams): Promise<TaskResult<string>> {
		// Implementation for test generation
		// ...existing code...
	}

	private async generateDocumentation(params: GenerationParams): Promise<TaskResult<string>> {
		// Implementation for documentation generation
		// ...existing code...
	}

	private buildCodePrompt(params: GenerationParams): string {
		// Implementation for building code prompt
		// ...existing code...
	}

	private processGenerationResults(responses: EnsembleResult): GenerationResult {
		// Implementation for processing generation results
		// ...existing code...
	}

	/**
	 * Implement a feature across multiple files
	 * @param params Feature implementation parameters
	 * @returns Task result with implemented feature
	 */
	async task_implementFeature(params: ImplementFeatureParams): Promise<TaskResult<FeatureImplementationResult>> {
		this.logger.info('Implementing feature');

		try {
			// First, generate an implementation plan
			const planPrompt = await this.buildFeatureImplementationPlanPrompt(params);
			const planResponse = await this.modelManager.generateCompletion(planPrompt, {
				capability: ModelCapability.Planning,
				temperature: 0.3,
				maxTokens: 2048
			});

			// Parse the plan
			const implementationPlan = this.extractImplementationPlan(planResponse.content);

			// Generate a list of files to create/modify
			const filesListPrompt = await this.buildFilesListPrompt(params, implementationPlan);
			const filesListResponse = await this.modelManager.generateCompletion(filesListPrompt, {
				capability: ModelCapability.Planning,
				temperature: 0.2,
				maxTokens: 1024
			});

			// Parse the files list
			const filesList = this.parseFilesList(filesListResponse.content);

			// Generate code for each file
			const files: GeneratedCodeFile[] = [];
			for (const fileInfo of filesList) {
				// Generate code for this file
				const filePrompt = await this.buildFileImplementationPrompt(params, fileInfo, implementationPlan);
				const fileResponse = await this.modelManager.generateCompletion(filePrompt, {
					capability: ModelCapability.CodeGeneration,
					temperature: 0.2,
					maxTokens: 3072
				});

				// Parse the file code
				const code = this.extractFileCode(fileResponse.content, fileInfo.language || params.language);

				// Add to results
				files.push({
					filePath: fileInfo.filePath,
					code,
					description: fileInfo.description,
					isNew: fileInfo.isNew
				});
			}

			return {
				success: true,
				content: {
					files,
					implementationPlan
				},
				metadata: {
					fileCount: files.length
				}
			};
		} catch (error) {
			this.logger.error(`Error implementing feature: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to implement feature: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Implement a software architecture
	 * @param params Architecture implementation parameters
	 * @returns Task result with implementation
	 */
	async task_implementArchitecture(params: ImplementArchitectureParams): Promise<TaskResult<FeatureImplementationResult>> {
		this.logger.info('Implementing architecture');

		try {
			// Process as a feature implementation with architecture-specific prompt
			const featureParams: ImplementFeatureParams = {
				featureDescription: `Architecture implementation: ${params.architectureDescription}`,
				language: params.language,
				existingFiles: params.context?.relatedFiles.map(file => ({
					filePath: file.uri.fsPath,
					content: file.content
				})),
				requiredFunctionality: params.designPatterns,
				context: params.context
			};

			return this.task_implementFeature(featureParams);
		} catch (error) {
			this.logger.error(`Error implementing architecture: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to implement architecture: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Implement a design pattern
	 * @param params Design pattern parameters
	 * @returns Task result with implementation
	 */
	async task_implementDesignPattern(params: {
		patternName: string;
		language: string;
		context?: string;
	}): Promise<TaskResult<CodeGenerationResult>> {
		this.logger.info(`Implementing design pattern: ${params.patternName}`);

		try {
			// Create prompt for design pattern implementation
			const prompt = `
Generate a complete example implementation of the ${params.patternName} design pattern in ${params.language}.
${params.context ? `Context: ${params.context}` : ''}

Provide:
1. Well-structured and idiomatic code implementing the pattern
2. Clear comments explaining key components
3. A brief explanation of how this implementation follows the pattern principles

Return your response as:
\`\`\`${params.language}
// IMPLEMENTATION CODE HERE
\`\`\`

EXPLANATION:
[Explanation of how the code implements the pattern]
`;

			// Call the model with the appropriate capability
			const response = await this.modelManager.generateCompletion(prompt, {
				capability: ModelCapability.CodeGeneration,
				temperature: 0.3,
				maxTokens: 3072
			});

			// Parse the response
			const result = this.parseCodeGenerationResponse(response.content, params.language);

			return {
				success: true,
				content: result,
				metadata: {
					promptTokens: response.promptTokens,
					completionTokens: response.completionTokens,
					totalTokens: response.totalTokens,
					designPattern: params.patternName,
					language: params.language
				}
			};
		} catch (error) {
			this.logger.error(`Error implementing design pattern: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to implement design pattern: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Build prompt for code generation
	 * @param params Code generation parameters
	 * @returns Code generation prompt
	 */
	private async buildCodeGenerationPrompt(params: GenerateCodeParams): Promise<string> {
		// Try to get template from prompt manager
		const template = this.promptManager.getTemplate('code-generation');

		if (template) {
			return this.promptManager.render('code-generation', {
				prompt: params.prompt,
				language: params.language,
				existingCode: params.existingCode || '',
				context: JSON.stringify(params.context || {}, null, 2)
			}) || this.createDefaultCodeGenerationPrompt(params);
		}

		return this.createDefaultCodeGenerationPrompt(params);
	}

	/**
	 * Create default code generation prompt
	 * @param params Code generation parameters
	 * @returns Code generation prompt
	 */
	private createDefaultCodeGenerationPrompt(params: GenerateCodeParams): string {
		let prompt = `Generate ${params.language} code based on this request: "${params.prompt}"\n\n`;

		if (params.existingCode) {
			prompt += `Extend or modify this existing code:\n\`\`\`${params.language}\n${params.existingCode}\n\`\`\`\n\n`;
		}

		// Add context if available
		if (params.context) {
			if (params.context.currentFile) {
				prompt += `Current file: ${params.context.currentFile.uri.fsPath}\n`;
				prompt += `Language: ${params.context.currentFile.languageId}\n\n`;
			}

			if (params.context.projectInfo) {
				prompt += `Project: ${params.context.projectInfo.name}\n`;
				prompt += `Project languages: ${Array.from(params.context.projectInfo.languages).join(', ')}\n\n`;
			}
		}

		prompt += `Provide your response in this format:

\`\`\`${params.language}
// GENERATED CODE HERE
\`\`\`

EXPLANATION:
[Brief explanation of the code and approach]`;

		return prompt;
	}

	/**
	 * Parse code generation response
	 * @param response Model response text
	 * @param language Programming language
	 * @returns Parsed code generation result
	 */
	private parseCodeGenerationResponse(response: string, language: string): CodeGenerationResult {
		try {
			// Extract code and explanation
			const codeMatch = response.match(/```[\w]*\s*([\s\S]*?)\s*```/);
			let code = '';
			let explanation = '';

			if (codeMatch && codeMatch[1]) {
				code = codeMatch[1];

				// Get explanation after code block
				const parts = response.split(/```/);
				if (parts.length > 2) {
					explanation = parts.slice(2).join('```').trim();
				}
			} else {
				// Fallback: assume entire response is code
				code = response.trim();
			}

			return {
				code,
				explanation
			};
		} catch (error) {
			this.logger.error(`Error parsing code generation response: ${error instanceof Error ? error.message : String(error)}`);

			return {
				code: response,
				explanation: ''
			};
		}
	}

	/**
	 * Build prompt for feature implementation plan
	 * @param params Feature implementation parameters
	 * @returns Feature implementation plan prompt
	 */
	private async buildFeatureImplementationPlanPrompt(params: ImplementFeatureParams): Promise<string> {
		let prompt = `Generate an implementation plan for the following feature in ${params.language}:\n\n`;
		prompt += `Feature Description: ${params.featureDescription}\n\n`;

		if (params.requiredFunctionality && params.requiredFunctionality.length > 0) {
			prompt += `Required Functionality:\n`;
			params.requiredFunctionality.forEach((func, index) => {
				prompt += `${index + 1}. ${func}\n`;
			});
			prompt += `\n`;
		}

		if (params.existingFiles && params.existingFiles.length > 0) {
			prompt += `Existing Files:\n`;
			params.existingFiles.forEach((file, index) => {
				prompt += `${index + 1}. ${file.filePath}\n`;
			});
			prompt += `\n`;
		}

		if (params.context) {
			if (params.context.currentFile) {
				prompt += `Current file: ${params.context.currentFile.uri.fsPath}\n`;
				prompt += `Language: ${params.context.currentFile.languageId}\n\n`;
			}

			if (params.context.projectInfo) {
				prompt += `Project: ${params.context.projectInfo.name}\n`;
				prompt += `Project languages: ${Array.from(params.context.projectInfo.languages).join(', ')}\n\n`;
			}
		}

		prompt += `Provide your response in this format:

\`\`\`json
{
	"implementationPlan": "..."
}
\`\`\``;

		return prompt;
	}

	/**
	 * Extract implementation plan from response
	 * @param response Model response text
	 * @returns Extracted implementation plan
	 */
	private extractImplementationPlan(response: string): string {
		try {
			const match = response.match(/```json\s*([\s\S]*?)\s*```/);
			if (match && match[1]) {
				const json = JSON.parse(match[1]);
				return json.implementationPlan || '';
			}
		} catch (error) {
			this.logger.error(`Error extracting implementation plan: ${error instanceof Error ? error.message : String(error)}`);
		}

		return response.trim();
	}

	/**
	 * Build prompt for files list
	 * @param params Feature implementation parameters
	 * @param implementationPlan Implementation plan
	 * @returns Files list prompt
	 */
	private async buildFilesListPrompt(params: ImplementFeatureParams, implementationPlan: string): Promise<string> {
		let prompt = `Generate a list of files to create or modify for the following feature in ${params.language}:\n\n`;
		prompt += `Feature Description: ${params.featureDescription}\n\n`;
		prompt += `Implementation Plan: ${implementationPlan}\n\n`;

		if (params.requiredFunctionality && params.requiredFunctionality.length > 0) {
			prompt += `Required Functionality:\n`;
			params.requiredFunctionality.forEach((func, index) => {
				prompt += `${index + 1}. ${func}\n`;
			});
			prompt += `\n`;
		}

		if (params.existingFiles && params.existingFiles.length > 0) {
			prompt += `Existing Files:\n`;
			params.existingFiles.forEach((file, index) => {
				prompt += `${index + 1}. ${file.filePath}\n`;
			});
			prompt += `\n`;
		}

		if (params.context) {
			if (params.context.currentFile) {
				prompt += `Current file: ${params.context.currentFile.uri.fsPath}\n`;
				prompt += `Language: ${params.context.currentFile.languageId}\n\n`;
			}

			if (params.context.projectInfo) {
				prompt += `Project: ${params.context.projectInfo.name}\n`;
				prompt += `Project languages: ${Array.from(params.context.projectInfo.languages).join(', ')}\n\n`;
			}
		}

		prompt += `Provide your response in this format:

\`\`\`json
[
	{
		"filePath": "...",
		"description": "...",
		"isNew": true/false
	}
]
\`\`\``;

		return prompt;
	}

	/**
	 * Parse files list from response
	 * @param response Model response text
	 * @returns Parsed files list
	 */
	private parseFilesList(response: string): Array<{ filePath: string; description: string; isNew: boolean; language?: string }> {
		try {
			const match = response.match(/```json\s*([\s\S]*?)\s*```/);
			if (match && match[1]) {
				return JSON.parse(match[1]);
			}
		} catch (error) {
			this.logger.error(`Error parsing files list: ${error instanceof Error ? error.message : String(error)}`);
		}

		return [];
	}

	/**
	 * Build prompt for file implementation
	 * @param params Feature implementation parameters
	 * @param fileInfo File information
	 * @param implementationPlan Implementation plan
	 * @returns File implementation prompt
	 */
	private async buildFileImplementationPrompt(params: ImplementFeatureParams, fileInfo: { filePath: string; description: string; isNew: boolean; language?: string }, implementationPlan: string): Promise<string> {
		let prompt = `Generate code for the following file in ${fileInfo.language || params.language}:\n\n`;
		prompt += `File Path: ${fileInfo.filePath}\n\n`;
		prompt += `Description: ${fileInfo.description}\n\n`;
		prompt += `Implementation Plan: ${implementationPlan}\n\n`;

		if (params.requiredFunctionality && params.requiredFunctionality.length > 0) {
			prompt += `Required Functionality:\n`;
			params.requiredFunctionality.forEach((func, index) => {
				prompt += `${index + 1}. ${func}\n`;
			});
			prompt += `\n`;
		}

		if (params.existingFiles && params.existingFiles.length > 0) {
			prompt += `Existing Files:\n`;
			params.existingFiles.forEach((file, index) => {
				prompt += `${index + 1}. ${file.filePath}\n`;
			});
			prompt += `\n`;
		}

		if (params.context) {
			if (params.context.currentFile) {
				prompt += `Current file: ${params.context.currentFile.uri.fsPath}\n`;
				prompt += `Language: ${params.context.currentFile.languageId}\n\n`;
			}

			if (params.context.projectInfo) {
				prompt += `Project: ${params.context.projectInfo.name}\n`;
				prompt += `Project languages: ${Array.from(params.context.projectInfo.languages).join(', ')}\n\n`;
			}
		}

		prompt += `Provide your response in this format:

\`\`\`${fileInfo.language || params.language}
// GENERATED CODE HERE
\`\`\``;

		return prompt;
	}

	/**
	 * Extract file code from response
	 * @param response Model response text
	 * @param language Programming language
	 * @returns Extracted file code
	 */
	private extractFileCode(response: string, language: string): string {
		try {
			const match = response.match(/```[\w]*\s*([\s\S]*?)\s*```/);
			if (match && match[1]) {
				return match[1].trim();
			}
		} catch (error) {
			this.logger.error(`Error extracting file code: ${error instanceof Error ? error.message : String(error)}`);
		}

		return response.trim();
	}
}
