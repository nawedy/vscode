/**
 * Telemetry Service
 *
 * Provides telemetry tracking functionality for the extension.
 * Respects user privacy settings and allows users to opt-out.
 */

import * as vscode from 'vscode';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';

/**
 * Telemetry event type
 */
export enum TelemetryEventType {
	Command = 'command',
	ModelRequest = 'model_request',
	Error = 'error',
	Performance = 'performance',
	Feature = 'feature'
}

/**
 * Telemetry event data
 */
export interface TelemetryEvent {
	type: TelemetryEventType;
	name: string;
	properties?: Record<string, string | number | boolean>;
	measurements?: Record<string, number>;
}

/**
 * Service for tracking telemetry events
 */
export class TelemetryService {
	private readonly configService: ConfigService;
	private readonly logger: Logger;
	private isEnabled: boolean = true;
	private sessionId: string;
	private machineId: string;

	/**
	 * Create a new telemetry service
	 * @param configService Configuration service
	 * @param logger Logger
	 */
	constructor(configService: ConfigService, logger: Logger) {
		this.configService = configService;
		this.logger = logger;
		this.sessionId = this.generateId();
		this.machineId = '';

		// Check if telemetry is enabled in user settings
		this.updateTelemetryStatus();

		// Generate anonymous machine ID if telemetry is enabled
		this.initializeMachineId();
	}

	/**
	 * Update telemetry status based on settings
	 */
	public updateTelemetryStatus(): void {
		// First check global VS Code telemetry setting
		const vscodeTelemetryEnabled = vscode.env.isTelemetryEnabled;

		// Then check extension-specific setting
		const extensionTelemetryEnabled = this.configService.get<boolean>(
			'telemetry.enabled',
			true
		);

		// Telemetry is enabled only if both global and extension settings allow it
		this.isEnabled = vscodeTelemetryEnabled && extensionTelemetryEnabled;
		this.logger.info(`Telemetry ${this.isEnabled ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Track a telemetry event
	 * @param event Telemetry event to track
	 */
	public trackEvent(event: TelemetryEvent): void {
		if (!this.isEnabled) {
			return;
		}

		try {
			// Add common properties
			const enrichedProperties = {
				...event.properties,
				sessionId: this.sessionId,
				extensionVersion: this.configService.getExtensionVersion()
			};

			// Log telemetry event for debugging
			this.logger.debug(`Telemetry event: ${event.type}:${event.name}`);

			// In a real implementation, this would send the event to a telemetry service
			// For now, we just log it locally
			this.sendTelemetryEvent(event.type, event.name, enrichedProperties, event.measurements);
		} catch (error) {
			this.logger.error(`Error tracking telemetry event: ${error instanceof Error ? error.message : String(error)}`);
			// Don't throw - telemetry errors should not affect functionality
		}
	}

	/**
	 * Track a command execution
	 * @param commandName Command name
	 * @param properties Additional properties
	 * @param measurements Performance measurements
	 */
	public trackCommand(commandName: string, properties?: Record<string, string | number | boolean>, measurements?: Record<string, number>): void {
		this.trackEvent({
			type: TelemetryEventType.Command,
			name: commandName,
			properties,
			measurements
		});
	}

	/**
	 * Track a model request
	 * @param modelId Model ID
	 * @param providerId Provider ID
	 * @param requestType Request type
	 * @param properties Additional properties
	 * @param measurements Performance measurements
	 */
	public trackModelRequest(modelId: string, providerId: string, requestType: string, properties?: Record<string, string | number | boolean>, measurements?: Record<string, number>): void {
		this.trackEvent({
			type: TelemetryEventType.ModelRequest,
			name: requestType,
			properties: {
				...properties,
				modelId,
				providerId
			},
			measurements
		});
	}

	/**
	 * Track an error
	 * @param errorName Error name
	 * @param errorMessage Error message
	 * @param properties Additional properties
	 */
	public trackError(errorName: string, errorMessage: string, properties?: Record<string, string | number | boolean>): void {
		// Never include full error details or stack traces in telemetry
		// Just include the error name and generic information
		this.trackEvent({
			type: TelemetryEventType.Error,
			name: errorName,
			properties: {
				...properties,
				errorType: errorName
			}
		});
	}

	/**
	 * Track performance measurements
	 * @param operationName Operation name
	 * @param durationMs Duration in milliseconds
	 * @param properties Additional properties
	 */
	public trackPerformance(operationName: string, durationMs: number, properties?: Record<string, string | number | boolean>): void {
		this.trackEvent({
			type: TelemetryEventType.Performance,
			name: operationName,
			properties,
			measurements: {
				durationMs
			}
		});
	}

	/**
	 * Send telemetry event to service
	 * @param type Event type
	 * @param name Event name
	 * @param properties Event properties
	 * @param measurements Event measurements
	 */
	private sendTelemetryEvent(
		type: TelemetryEventType,
		name: string,
		properties?: Record<string, string | number | boolean>,
		measurements?: Record<string, number>
	): void {
		// In a real implementation, this would send the event to Application Insights,
		// Google Analytics, or another telemetry service.
		// For now, we just log it locally for debugging purposes.

		if (!this.isEnabled) {
			return;
		}

		// Debug logging only in development mode
		if (this.configService.isDevelopmentMode()) {
			this.logger.debug(
				`TELEMETRY: ${type}:${name}\n` +
				`Properties: ${JSON.stringify(properties)}\n` +
				`Measurements: ${JSON.stringify(measurements)}`
			);
		}
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	/**
	 * Initialize machine ID for telemetry
	 */
	private async initializeMachineId(): Promise<void> {
		if (!this.isEnabled) {
			return;
		}

		try {
			// Try to get machine ID from global state
			const context = this.configService.getExtensionContext();
			const storedId = context.globalState.get<string>('telemetry.machineId');

			if (storedId) {
				this.machineId = storedId;
			} else {
				// Generate a new anonymous ID
				this.machineId = this.generateId();
				await context.globalState.update('telemetry.machineId', this.machineId);
			}
		} catch (error) {
			this.logger.error(`Error initializing machine ID: ${error instanceof Error ? error.message : String(error)}`);
			// Generate a temporary ID for the session
			this.machineId = this.generateId();
		}
	}

	/**
	 * Dispose telemetry service
	 */
	public dispose(): void {
		// Clean up any resources if needed
	}
}
