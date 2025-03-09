/**
 * View Manager
 *
 * Manages the various views and webviews used by the extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { AIResponsePanel, ResponseData, ResponseGenerator } from './aiResponsePanel';
import { WebviewManager } from './webviewManager';
import { ChatPanel } from './panels/chatPanel';
import { SecurityDashboard } from './panels/securityDashboard';
import { SuggestionPanel } from './panels/suggestionPanel';

interface ViewOptions {
	enableScripts?: boolean;
	retainContextWhenHidden?: boolean;
	localResourceRoots?: vscode.Uri[];
}

interface ViewState {
	panel: vscode.WebviewPanel;
	disposables: vscode.Disposable[];
}

interface WebviewContent {
	html: string;
	scripts: string[];
	styles: string[];
}

/**
 * Response update callback type
 */
type ResponseUpdateCallback = (content: string) => void;

/**
 * Response content type
 */
interface ResponseContent {
	content: string;
	metadata?: Record<string, unknown>;
}

/**
 * Manages all UI views for the extension
 */
export class ViewManager implements vscode.Disposable {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly configService: ConfigService;
	private aiResponsePanel: AIResponsePanel | undefined;
	private webviewManager: WebviewManager;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly views: Map<string, ViewState> = new Map();
	private readonly panels: Map<string, vscode.WebviewPanel> = new Map();

	/**
	 * Create a new view manager
	 * @param context Extension context
	 * @param logger Logger instance
	 * @param configService Configuration service
	 */
	constructor(
		context: vscode.ExtensionContext,
		logger: Logger,
		configService: ConfigService
	) {
		this.context = context;
		this.logger = logger;
		this.configService = configService;

		// Create the webview manager
		this.webviewManager = new WebviewManager(context, logger, configService);

		// Store in context for reuse
		context.globalState.update('webviewManager', this.webviewManager);
	}

	/**
	 * Show the AI response panel
	 * @param id Panel ID
	 * @param title Panel title
	 * @param contentProvider Function to provide content
	 * @returns The response content
	 */
	public async showAIResponsePanel(
		id: string,
		title: string,
		contentProvider: (updateCallback: ResponseUpdateCallback) => Promise<ResponseContent>
	): Promise<ResponseData> {
		// Create a response panel if needed
		if (!this.aiResponsePanel) {
			this.aiResponsePanel = new AIResponsePanel(this.context, this.webviewManager, this.logger);
		}

		// Adapt the contentProvider to match the expected type
		const adaptedProvider: ResponseGenerator = async (update) => {
			const result = await contentProvider(update);
			return {
				content: result.content,
				...(result.metadata || {})
			};
		};

		// Show the response
		const response = await this.aiResponsePanel.showResponse(id, title, adaptedProvider);
		return {
			content: response.content,
			...Object.fromEntries(
				Object.entries(response).filter(([key]) => key !== 'panel')
			)
		};
	}

	/**
	 * Create a webview panel
	 * @param viewType View type identifier
	 * @param title Panel title
	 * @param showOptions View column options
	 * @param options Webview options
	 * @returns The created webview panel
	 */
	public createWebviewPanel(
		viewType: string,
		title: string,
		column: vscode.ViewColumn,
		options?: ViewOptions
	): vscode.WebviewPanel {
		const panel = vscode.window.createWebviewPanel(
			viewType,
			title,
			column,
			{
				enableScripts: options?.enableScripts ?? true,
				retainContextWhenHidden: options?.retainContextWhenHidden ?? false,
				localResourceRoots: options?.localResourceRoots
			}
		);

		const disposables: vscode.Disposable[] = [];
		this.views.set(viewType, { panel, disposables });

		// Add disposal handler
		panel.onDidDispose(() => {
			disposables.forEach(d => d.dispose());
			this.views.delete(viewType);
		}, null, disposables);

		return panel;
	}

	/**
	 * Create webview content for a panel
	 * @param panel Webview panel
	 * @param content Content configuration
	 */
	public createWebviewContent(
		panel: vscode.WebviewPanel,
		content: WebviewContent
	): void {
		// Get the HTML content
		let htmlContent = content.html;

		// Process scripts
		if (content.scripts && content.scripts.length > 0) {
			const scriptTags = content.scripts.map(script => {
				const scriptUri = this.webviewManager.getResourceUri(panel.webview, script);
				return `<script src="${scriptUri}"></script>`;
			}).join('\n');

			htmlContent = htmlContent.replace('</body>', `${scriptTags}\n</body>`);
		}

		// Process styles
		if (content.styles && content.styles.length > 0) {
			const styleTags = content.styles.map(style => {
				const styleUri = this.webviewManager.getResourceUri(panel.webview, style);
				return `<link rel="stylesheet" href="${styleUri}">`;
			}).join('\n');

			htmlContent = htmlContent.replace('</head>', `${styleTags}\n</head>`);
		}

		// Set the HTML content
		panel.webview.html = htmlContent;
	}

	/**
	 * Show a notification with progress
	 * @param title Notification title
	 * @param task Task to perform
	 * @returns Result of the task
	 */
	public async showProgressNotification<T>(
		title: string,
		task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
	): Promise<T> {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title,
				cancellable: true
			},
			task
		);
	}

	/**
	 * Show a notification
	 * @param message Notification message
	 * @param type Notification type
	 */
	public showNotification(
		message: string,
		type: 'info' | 'warning' | 'error' = 'info'
	): void {
		switch (type) {
			case 'info':
				vscode.window.showInformationMessage(message);
				break;
			case 'warning':
				vscode.window.showWarningMessage(message);
				break;
			case 'error':
				vscode.window.showErrorMessage(message);
				break;
		}
	}

	/**
	 * Show chat panel
	 */
	public async showChatPanel(): Promise<void> {
		let panel = this.panels.get('chat');
		if (panel) {
			panel.reveal();
			return;
		}

		panel = await ChatPanel.create(this.context, this.webviewManager, this.logger);
		this.panels.set('chat', panel);

		panel.onDidDispose(() => {
			this.panels.delete('chat');
		});
	}

	/**
	 * Show security dashboard
	 */
	public async showSecurityDashboard(): Promise<void> {
		let panel = this.panels.get('security');
		if (panel) {
			panel.reveal();
			return;
		}

		panel = await SecurityDashboard.create(this.context, this.webviewManager, this.logger);
		this.panels.set('security', panel);

		panel.onDidDispose(() => {
			this.panels.delete('security');
		});
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		if (this.aiResponsePanel) {
			this.aiResponsePanel.dispose();
		}

		this.webviewManager.dispose();
		this.disposables.forEach(d => d.dispose());
		this.panels.forEach(panel => panel.dispose());
		this.panels.clear();
	}
}
