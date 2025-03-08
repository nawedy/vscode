/**
 * EnsembleLLM
 *
 * Base class for ensemble models that combine multiple LLMs
 * to perform complex, specialized tasks.
 */

import * as vscode from 'vscode';
import { ModelManager } from '../modelManager';
import { Logger } from '../../utils/logger';
import { ConfigService } from '../../services/configService';
import { PromptManager } from '../promptManager';

/**
 * Task result from ensemble
 */
export interface TaskResult<T = any> {
	success: boolean;
	content?: T;
	error?: string;
	metadata?: Record<string, any>;
}

/**
 * Task function type
 */
export type TaskFunction = (params: any) => Promise<TaskResult>;

/**
 * Base class for ensemble LLMs
 */
export abstract class EnsembleLLM {
	protected modelManager: ModelManager;
	protected logger: Logger;
	protected configService: ConfigService;
	protected promptManager: PromptManager;
	protected tasks: Map<string, TaskFunction> = new Map();
	protected ensembleId: string;

	/**
	 * Create a new ensemble LLM
	 * @param modelManager Model manager
	 * @param logger Logger
	 * @param configService Configuration service
	 * @param ensembleId Unique ensemble identifier
	 */
	constructor(
		modelManager: ModelManager,
		logger: Logger,
		configService: ConfigService,
		ensembleId: string
	) {
		this.modelManager = modelManager;
		this.logger = logger;
		this.configService = configService;
		this.ensembleId = ensembleId;

		// Create a prompt manager instance
		const context = this.configService.getExtensionContext();
		this.promptManager = new PromptManager(context, logger);

		this.logger.info(`EnsembleLLM '${ensembleId}' initialized`);
	}

	/**
	 * Register a task that this ensemble can perform
	 * @param taskName Task name
	 * @param taskFunction Task function
	 */
	protected registerTask(taskName: string, taskFunction: TaskFunction): void {
		this.tasks.set(taskName, taskFunction);
		this.logger.debug(`Registered task '${taskName}' for ensemble '${this.ensembleId}'`);
	}

	/**
	 * Execute a registered task
	 * @param taskName Task name
	 * @param params Task parameters
	 * @returns Task result
	 */
	public async executeTask<T = any>(taskName: string, params: any): Promise<TaskResult<T>> {
		try {
			const task = this.tasks.get(taskName);
			if (!task) {
				throw new Error(`Task '${taskName}' not found in ensemble '${this.ensembleId}'`);
			}

			this.logger.info(`Executing task '${taskName}' in ensemble '${this.ensembleId}'`);
			const result = await task(params);
			return result as TaskResult<T>;
		} catch (error) {
			this.logger.error(
				`Error executing task '${taskName}' in ensemble '${this.ensembleId}': ${error instanceof Error ? error.message : String(error)}`
			);

			return {
				success: false,
				error: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Get a list of available task names
	 * @returns Array of task names
	 */
	public getAvailableTasks(): string[] {
		return Array.from(this.tasks.keys());
	}

	/**
	 * Check if a task is available
	 * @param taskName Task name
	 * @returns Whether the task is available
	 */
	public hasTask(taskName: string): boolean {
		return this.tasks.has(taskName);
	}

	/**
	 * Get the ensemble ID
	 * @returns Ensemble ID
	 */
	public getId(): string {
		return this.ensembleId;
	}

	/**
	 * Process a complex task through multiple steps
	 * @param steps Array of step definitions
	 * @param context Initial context
	 * @returns Final result
	 */
	protected async processMultiStepTask<T = any>(
		steps: Array<{
			taskName: string;
			params: (ctx: any) => any;
			processResult?: (result: TaskResult, ctx: any) => any;
		}>,
		context: any = {}
	): Promise<TaskResult<T>> {
		let currentContext = { ...context };

		try {
			for (const [index, step] of steps.entries()) {
				// Calculate params based on current context
				const params = step.params(currentContext);

				// Execute the task
				this.logger.debug(`Executing step ${index + 1}/${steps.length}: ${step.taskName}`);
				const result = await this.executeTask(step.taskName, params);

				// Stop if the step failed
				if (!result.success) {
					this.logger.error(`Step ${index + 1} (${step.taskName}) failed: ${result.error}`);
					return result as TaskResult<T>;
				}

				// Process the result and update context
				if (step.processResult) {
					currentContext = {
						...currentContext,
						...step.processResult(result, currentContext)
					};
				} else {
					// Default processing: add result content to context with the step's taskName
					currentContext[step.taskName] = result.content;
				}
			}

			// Return final result from context
			return {
				success: true,
				content: currentContext.result || currentContext,
				metadata: {
					steps: steps.length
				}
			};
		} catch (error) {
			this.logger.error(`Error in multi-step task: ${error instanceof Error ? error.message : String(error)}`);
			return {
				success: false,
				error: `Multi-step task failed: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Dispose resources
	 */
	public dispose(): void {
		// Clean up resources if needed
		this.tasks.clear();
	}
}
