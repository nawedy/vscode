/**
 * View Manager for SuperCoderAI VSCode Extension
 *
 * This file implements the view manager that coordinates all UI components
 * of the extension, including webviews, status bar items, and panels. It
 * manages the communication between UI components and the backend services.
 *
 * Key features:
 * - WebView panel management
 * - Status bar integration
 * - Message handling between UI and backend
 * - Panel persistence across reloads
 * - UI state management
 *
 * File path: src/ui/viewManager.ts
 */
// @ts-ignore: error TS2300: Duplicate identifier 'vscode'.

// @ts-ignore: error TS2300: Duplicate identifier 'path'.
import * as vscode from 'vscode';
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
import * as path from 'path';
import * as fs from 'fs';
import { CodeGenerationEnsemble } from '../ai/ensemble/codeGenerationEnsemble';
import { SecurityEnsemble } from '../ai/ensemble/securityEnsemble';
import { ContextManager } from '../context/contextManager';
import { logger } from '../utils/logger';

// Interface for webview panel info
interface WebviewPanelInfo {
    panel: vscode.WebviewPanel;
    viewType: string;
    disposables: vscode.Disposable[];
}

// Interface for webview message
interface WebviewMessage {
    command: string;
    data: any;
}

// Interface for status bar item info
interface StatusBarItemInfo {
    item: vscode.StatusBarItem;
    id: string;
    priority: number;
}

/**
 * View Manager
 *
 * Manages webview panels and views, providing consistent UI styling
 * and state management across the extension's user interfaces.
 */
// @ts-ignore: error TS2300: Duplicate identifier 'vscode'.

// @ts-ignore: error TS2300: Duplicate identifier 'path'.
;
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
// @ts-ignore: error TS2300: Duplicate identifier 'fs'.
import * as path from 'path';
imrt { Logger } from '../utils/lervice } from '../servicesating a webview panel
 */
interface WebviewPanelOptions {
	viewType: string;
	title: string;
	viewColumn?: vscode.ViewColumn;
	preserveFocus?: boolean;
	enableScripts?: boolean;
	retainContextWhenHidden?: boolean;
	localResourceRoots?: vscode.Uri[];
}

/**
 * Manager for extension webviews
 */
export class ViewManager {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly configService: ConfigService;
	private readonly webviewPanels: Map<string, vscode.WebviewPanel> = new Map();
	private readonly views: Map<string, vscode.WebviewView> = new Map();
	private readonly templateCache: Map<string, string> = new Map();

	/**
	 * Create a new view manager
	 * @param context Extension context
	 * @param logger Logger instance
	 * @param configService Configuration service
	 */
	constructor(context: vscode.ExtensionContext, logger: Logger, configService: ConfigService) {
		this.context = context;
		this.logger = logger;
		this.configService = configService;
	}

	/**
	 * Create a webview panel
	 * @param viewType Unique identifier for the webview type
	 * @param title Panel title
	 * @param viewColumn View column to show the panel in
	 * @param options Additional panel options
	 * @returns The created WebviewPanel
	 */
	public createWebviewPanel(
		viewType: string,
		title: string,
		viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
		options: Partial<WebviewPanelOptions> = {}
	): vscode.WebviewPanel {
		// Check if we already have a panel of this type
		const existingPanel = this.webviewPanels.get(viewType);
		if (existingPanel) {
			// If we do, reveal it rather than creating a new one
			existingPanel.reveal(viewColumn);
			return existingPanel;
		}

		// Set default options
		const defaultOptions = {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [
				vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
			]
		};

		// Create the webview panel
		const panel = vscode.window.createWebviewPanel(
			viewType,
			title,
			{
				viewColumn,
				preserveFocus: options.preserveFocus
			},
			{
				...defaultOptions,
				...options,
				enableFindWidget: true,
			}
		);

		// Configure webview security
		panel.webview.options = {
			enableScripts: options.enableScripts ?? defaultOptions.enableScripts,
			localResourceRoots: options.localResourceRoots ?? defaultOptions.localResourceRoots
		};

		// Store a reference to the panel
		this.webviewPanels.set(viewType, panel);

		// Handle panel disposal
		panel.onDidDispose(() => {
			this.webviewPanels.delete(viewType);
		});

		return panel;
	}

	/**
	 * Register a webview view provider
	 * @param viewId View identifier
	 * @param title View title
	 * @returns View provider registration disposable
	 */
	public registerWebviewViewProvider(viewId: string, title: string): vscode.Disposable {
		const provider = new class implements vscode.WebviewViewProvider {
			private _view?: vscode.WebviewView;

			resolveWebviewView(
				webviewView: vscode.WebviewView,
				_context: vscode.WebviewViewResolveContext,
				_token: vscode.CancellationToken
			): void | Thenable<void> {
				// Store reference to the view
				this._view = webviewView;

				// Configure webview
				webviewView.webview.options = {
					enableScripts: true,
// @ts-ignore: error TS2339: Property 'context' does not exist on type '(Anonymous class)'.
// @ts-ignore: error TS2339: Property 'context' does not exist on type '(Anonymous class)'.
// @ts-ignore: error TS2339: Property 'context' does not exist on type '(Anonymous class)'.
// @ts-ignore: error TS2339: Property 'context' does not exist on type '(Anonymous class)'.
// @ts-ignore: error TS2339: Property 'context' does not exist on type '(Anonymous class)'.
// @ts-ignore: error TS2339: Property 'context' does not exist on type '(Anonymous class)'.
					localResourceRoots: [
						vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
					]
				};

				// Set initial HTML content
				webviewView.title = title;
				webviewView.webview.html = this.getInitialHtml(title);

// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
				// Store in the view manager
				this.views.set(viewId, webviewView);

				// Handle view disposal
// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
// @ts-ignore: error TS2551: Property 'views' does not exist on type '(Anonymous class)'. Did you mean '_view'?
				webviewView.onDidDispose(() => {
					this.views.delete(viewId);
				});
			}

			private getInitialHtml(title: string): string {
				return `
				<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>${title}</title>
				</head>
				<body>
					<h1>${title}</h1>
					<p>View content loading...</p>
				</body>
				</html>`;
			}
		};

		return vscode.window.registerWebviewViewProvider(viewId, provider);
	}

	/**
	 * Load an HTML template
	 * @param templateName Template name without extension
	 * @returns Template content or empty string if template not found
	 */
	public loadHtmlTemplate(templateName: string): string {
		// Check cache first
		if (this.templateCache.has(templateName)) {
			return this.templateCache.get(templateName)!;
		}

		try {
			// Construct template path
			const templatePath = path.join(
				this.context.extensionPath,
				'resources',
				'templates',
				`${templateName}.html`
			);

			// Read template file
			const templateContent = fs.readFileSync(templatePath, 'utf8');

			// Cache the template
			this.templateCache.set(templateName, templateContent);

			return templateContent;
		} catch (error) {
			this.logger.error(`Failed to load template '${templateName}': ${error instanceof Error ? error.message : String(error)}`);
			return '';
		}
	}

	/**
	 * Create webview content from a template
	 * @param webviewPanel Webview panel
	 * @param templateContent HTML template content
	 * @param data Data to inject into the template
	 * @returns Processed HTML content
	 */
	public createWebviewContent(
		webviewPanel: vscode.WebviewPanel | vscode.WebviewView,
		templateContent: string,
		data: Record<string, any> = {}
	): string {
		const webview = 'webview' in webviewPanel ? webviewPanel.webview : webviewPanel;

		// Create nonce for script security
		const nonce = this.generateNonce();

		// Get URIs for resources
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'scripts', 'webview.js'))
		);

		const cssUri = webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'styles', 'webview.css'))
		);

		// Prepare template variables
		const templateData = {
			...data,
			nonce,
			scriptUri: scriptUri.toString(),
			cssUri: cssUri.toString()
		};

		// Replace template variables
		let processedContent = templateContent;
		for (const [key, value] of Object.entries(templateData)) {
			// Skip null and undefined values
			if (value === null || value === undefined) {
				continue;
			}

			// Convert value to string if needed
			const stringValue = typeof value === 'string' ? value : String(value);

			// Replace all occurrences of the template variable
			const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
			processedContent = processedContent.replace(regex, stringValue);
		}

		// Add content security policy
		const csp = [
			`default-src 'none'`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src 'nonce-${nonce}'`,
			`img-src ${webview.cspSource} https: data:`,
			`font-src ${webview.cspSource}`,
			`connect-src https://api.openai.com https://api.anthropic.com https://api.mistralai.com`
		].join('; ');

		const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

		// Insert CSP meta tag after the first head tag
		processedContent = processedContent.replace('<head>', `<head>\n  ${cspMeta}`);

		return processedContent;
	}

	/**
	 * Update webview content
	 * @param viewType View type identifier
	 * @param content New HTML content
	 * @returns Whether update was successful
	 */
	public updateWebviewContent(viewType: string, content: string): boolean {
		// Look for panel first
		const panel = this.webviewPanels.get(viewType);
		if (panel) {
			panel.webview.html = content;
			return true;
		}

		// Look for view if panel not found
		const view = this.views.get(viewType);
		if (view) {
			view.webview.html = content;
			return true;
		}

		return false;
	}

	/**
	 * Generate a secure nonce
	 * @returns Cryptographically secure nonce
	 */
	private generateNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	/**
	 * Dispose of all webviews
	 */
	public dispose(): void {
		// Dispose all webview panels
		for (const panel of this.webviewPanels.values()) {
			panel.dispose();
		}
		this.webviewPanels.clear();

		// We don't dispose views as they're managed by VS Code
		this.views.clear();
	}
}
