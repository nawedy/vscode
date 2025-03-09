/**
 * Command Registration
 *
 * Centralized command registration for the SuperCoderAI extension.
 * This file aggregates and registers all commands from various modules,
 * ensuring proper initialization and error handling.
 *
 * Features:
 * - Unified command registration
 * - Error handling and logging
 * - Command categorization
 * - Telemetry integration
 *
 * File path: src/commands/index.ts
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { AICommands } from './aiCommands';
import { ConfigureProvidersCommand } from './configureProvidersCommand';
import { ContextAwareCommands } from './contextAwareCommands';
import { PromptCommands } from './promptCommands';
import { SecurityCommands } from './securityCommands';
import { ModelManager } from '../ai/modelManager';
import { PromptManager } from '../ai/promptManager';
import { ViewManager } from '../ui/viewManager';
import { ContextManager } from '../context/contextManager';
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
import { SecurityEnsemble } from '../ai/ensemble/securityEnsemble';
import { RefactoringEnsemble } from '../ai/ensemble/refactoringEnsemble';

/**
 * Service dependencies for commands
 */
export interface ServiceDependencies {
	logger: Logger;
	configService: ConfigService;
	modelManager: ModelManager;
	promptManager: PromptManager;
	viewManager: ViewManager;
	contextManager: ContextManager;
}

/**
 * Register all commands for the extension
 * @param context Extension context
 * @param services Service dependencies
 */
export async function registerCommands(
	context: vscode.ExtensionContext,
	services: ServiceDependencies
): Promise<void> {
	const { logger, configService, modelManager, promptManager, viewManager, contextManager } = services;

	logger.info('Registering extension commands');

	try {
		// Initialize ensembles
		const codeGenerationEnsemble = new CodeGenerationEnsemble(configService, logger, promptManager);
		const securityEnsemble = new SecurityEnsemble(configService, logger, promptManager);
		const refactoringEnsemble = new RefactoringEnsemble(configService, logger, promptManager);

		// Register basic AI commands
		const aiCommands = new AICommands(context, modelManager.getProviderManager(), logger);
		aiCommands.register();

		// Register context-aware commands
		const contextAwareCommands = new ContextAwareCommands(
			context,
			logger,
			contextManager,
			viewManager,
			configService
		);
		contextAwareCommands.register();

		// Register provider configuration command
		const configureProviders = new ConfigureProvidersCommand(
			context,
			modelManager.getProviderManager(),
			logger,
			configService
		);
		configureProviders.register();

		// Register prompt commands
		const promptCommands = new PromptCommands(
			context,
			promptManager,
			modelManager.getProviderManager(),
			logger
		);
		promptCommands.register();

		// Register security commands
		const securityCommands = new SecurityCommands(
			context,
			securityEnsemble,
			logger
		);
		securityCommands.register();

		logger.info('Extension commands registered successfully');
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Failed to register extension commands: ${errorMessage}`);
	}
}
