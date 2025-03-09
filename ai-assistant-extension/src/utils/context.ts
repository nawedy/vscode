import * as vscode from 'vscode';
import { AuthService } from '../services/authService';
import { ConfigService } from '../services/configService';
import { TelemetryService } from '../services/telemetryService';

export interface ExtensionContext {
	extensionPath: string;
	globalStoragePath: string;
	workspaceState: vscode.Memento;
	globalState: vscode.Memento;
	secrets: vscode.SecretStorage;
}

export class ContextManager {
	private context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	public getContext(): vscode.ExtensionContext {
		return this.context;
	}

	public getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
		return this.context.globalState.get<T>(key, defaultValue);
	}

	public async setGlobalState<T>(key: string, value: T): Promise<void> {
		await this.context.globalState.update(key, value);
	}

	public getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined {
		return this.context.workspaceState.get<T>(key, defaultValue);
	}

	public async setWorkspaceState<T>(key: string, value: T): Promise<void> {
		await this.context.workspaceState.update(key, value);
	}
}

export class Context {
    private static instance: Context;
    private authService: AuthService;
    private configService: ConfigService;
    private telemetryService: TelemetryService;

    private constructor(context: vscode.ExtensionContext) {
        this.authService = new AuthService(context);
        this.configService = new ConfigService(context);
        this.telemetryService = new TelemetryService(context);
    }

    public static getInstance(context?: vscode.ExtensionContext): Context {
        if (!Context.instance) {
            if (!context) {
                throw new Error("Context has not been initialized. Please provide an ExtensionContext.");
            }
            Context.instance = new Context(context);
        }
        return Context.instance;
    }

    public getAuthService(): AuthService {
        return this.authService;
    }

    public getConfigService(): ConfigService {
        return this.configService;
    }

    public getTelemetryService(): TelemetryService {
        return this.telemetryService;
    }
}
