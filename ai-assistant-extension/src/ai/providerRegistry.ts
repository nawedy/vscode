/**
 * Provider Registry
 *
 * Central registry for all AI model providers.
 * Manages provider initialization, discovery, and selection.
 */

import * as vscode from 'vscode';
import { BaseModelProvider, ModelCapability } from './providers/baseProvider';
import { OpenAIProvider } from './providers/openaiProvider';
import { AnthropicProvider } from './providers/anthropicProvider';
import { LocalLLMProvider } from './providers/localLLMProvider';
import { AzureOpenAIProvider } from './providers/azureOpenAIProvider';
import { HuggingFaceProvider } from './providers/huggingfaceProvider';
import { MistralProvider } from './providers/mistralProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import { QwenProvider } from './providers/qwenProvider';
import { XAIProvider } from './providers/xaiProvider';
import { KimiProvider } from './providers/kimiProvider';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';

/**
 * Registry for model providers
 */
export class ProviderRegistry {
	private providers: Map<string, BaseModelProvider> = new Map();
	private readonly logger: Logger;
	private readonly configService: ConfigService;

	constructor(logger: Logger, configService: ConfigService) {
		this.logger = logger;
		this.configService = configService;
	}

	public registerProvider(provider: BaseModelProvider): void {
		if (this.providers.has(provider.id)) {
			this.logger.warn(`Provider ${provider.id} already registered, overwriting`);
		}
		this.providers.set(provider.id, provider);
		this.logger.info(`Registered provider: ${provider.id}`);
	}

	public getProvider(providerId: string): BaseModelProvider | undefined {
		return this.providers.get(providerId);
	}

	public getAllProviders(): BaseModelProvider[] {
		return Array.from(this.providers.values());
	}

	public async initializeProviders(): Promise<void> {
		for (const provider of this.providers.values()) {
			try {
				await provider.initialize();
			} catch (error) {
				this.logger.error(`Failed to initialize provider ${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	public dispose(): void {
		for (const provider of this.providers.values()) {
			provider.dispose();
		}
		this.providers.clear();
	}
}
