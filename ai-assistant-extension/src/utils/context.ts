import { ExtensionContext } from 'vscode';
import { AuthService } from '../services/authService';
import { ConfigService } from '../services/configService';
import { TelemetryService } from '../services/telemetryService';

export class Context {
    private static instance: Context;
    private authService: AuthService;
    private configService: ConfigService;
    private telemetryService: TelemetryService;

// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
    private constructor(context: ExtensionContext) {
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
        this.authService = new AuthService(context);
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 1.
        this.configService = new ConfigService(context);
        this.telemetryService = new TelemetryService(context);
    }

    public static getInstance(context?: ExtensionContext): Context {
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