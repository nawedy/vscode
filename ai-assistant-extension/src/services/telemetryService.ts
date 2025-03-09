/**
 * Telemetry Service
 *
 * Provides telemetry tracking functionality for the extension.
 * Respects user privacy settings and allows users to opt-out.
 */

import * as vscode from 'vscode';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';
import { ModelCapability } from '../ai/providers/baseProvider';

interface TelemetryEvent {
	eventName: string;
	properties?: Record<string, string>;
	measurements?: Record<string, number>;
	timestamp: number;
}

interface ModelRequestMetrics {
	durationMs: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Service for tracking telemetry events
 */
export class TelemetryService {
	private readonly logger: Logger;
	private readonly events: TelemetryEvent[] = [];
	private readonly configService: ConfigService;
	private isEnabled: boolean = true;
	private sessionId: string;
	private machineId: string;

	constructor(
		private readonly context: vscode.ExtensionContext,
		logger: Logger
	) {
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

	public trackEvent(
		eventName: string,
		properties?: Record<string, string>,
		measurements?: Record<string, number>
	): void {
		const event: TelemetryEvent = {
			eventName,
			properties,
			measurements,
			timestamp: Date.now()
		};

		this.events.push(event);
		this.logger.debug(`Tracked event: ${eventName}`);
	}

	public trackError(
		source: string,
		error: string,
		properties?: Record<string, string>
	): void {
		this.trackEvent('error', {
			source,
			error,
			...properties
		});
	}

	public trackModelRequest(
		modelId: string,
		providerId: string,
		capability: ModelCapability,
		properties: Record<string, unknown>,
		metrics: ModelRequestMetrics
	): void {
		this.trackEvent('modelRequest', {
			modelId,
			providerId,
			capability,
			...Object.fromEntries(
				Object.entries(properties).map(([k, v]) => [k, String(v)])
			)
		}, metrics);
	}

	public async flushEvents(): Promise<void> {
		// Save events to storage
		await this.context.globalState.update('telemetry.events', this.events);
		this.events.length = 0;
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
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
			const storedId = this.context.globalState.get<string>('telemetry.machineId');

			if (storedId) {
				this.machineId = storedId;
			} else {
				// Generate a new anonymous ID
				this.machineId = this.generateId();
				await this.context.globalState.update('telemetry.machineId', this.machineId);
			}
		} catch (error) {
			this.logger.error(`Error initializing machine ID: ${error instanceof Error ? error.message : String(error)}`);
			// Generate a temporary ID for the session
			this.machineId = this.generateId();
		}
	}

	public dispose(): void {
		this.flushEvents().catch(err =>
			this.logger.error(`Error flushing telemetry events: ${err instanceof Error ? err.message : String(err)}`)
		);
	}
}
