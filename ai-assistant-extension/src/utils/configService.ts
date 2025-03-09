import * as vscode from 'vscode';

export interface ConfigurationOptions {
	section?: string;
	scope?: vscode.ConfigurationScope;
}

export class ConfigService {
	private readonly extensionContext: vscode.ExtensionContext;
	private readonly configPrefix: string;

	constructor(context: vscode.ExtensionContext, configPrefix: string = 'aiAssistant') {
		this.extensionContext = context;
		this.configPrefix = configPrefix;
	}

	public get<T>(key: string, defaultValue?: T, options?: ConfigurationOptions): T {
		const fullKey = `${this.configPrefix}.${key}`;
		const config = vscode.workspace.getConfiguration(options?.section, options?.scope);
		return config.get<T>(fullKey, defaultValue as T);
	}

	public async set<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
		const fullKey = `${this.configPrefix}.${key}`;
		const config = vscode.workspace.getConfiguration();
		await config.update(fullKey, value, target);
	}

	public async getSecret(key: string): Promise<string | undefined> {
		return await this.extensionContext.secrets.get(key);
	}

	public async setSecret(key: string, value: string): Promise<void> {
		await this.extensionContext.secrets.store(key, value);
	}

	public async deleteSecret(key: string): Promise<void> {
		await this.extensionContext.secrets.delete(key);
	}

	public getExtensionContext(): vscode.ExtensionContext {
		return this.extensionContext;
	}
}
