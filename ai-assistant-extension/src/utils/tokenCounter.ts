import * as vscode from 'vscode';
import { Logger } from './logger';
import { ModelProvider } from '../ai/providers/baseProvider';

export interface TokenCount {
	prompt: number;
	completion: number;
	total: number;
}

export class TokenCounter {
	constructor(private readonly provider: ModelProvider) { }

	public async countPromptTokens(text: string): Promise<number> {
		return await this.provider.countTokens(text);
	}

	public async countTokens(prompt: string, completion: string): Promise<TokenCount> {
		const promptTokens = await this.provider.countTokens(prompt);
		const completionTokens = await this.provider.countTokens(completion);

		return {
			prompt: promptTokens,
			completion: completionTokens,
			total: promptTokens + completionTokens
		};
	}
}
