import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/configService';

/**
 * Webview panel options
 */
export interface WebviewOptions {
	title: string;
	viewType: string;
	viewColumn?: vscode.ViewColumn;
	preserveFocus?: boolean;
	enableScripts?: boolean;
	retainContextWhenHidden?: boolean;
	localResourceRoots?: vscode.Uri[];
}

/**
 * Webview message handler type
 */
export type WebviewMessageHandler = (message: any) => void;

/**
 * Manages webview panels for the extension
 */
export class WebviewManager implements vscode.Disposable {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private readonly configService: ConfigService;
	private readonly panels = new Map<string, vscode.WebviewPanel>();
	private readonly messageHandlers = new Map<string, WebviewMessageHandler>();
	private readonly panelDisposables = new Map<string, vscode.Disposable[]>();
	private readonly resourcesPath: string;
	private readonly mediaPath: string;

	/**
	 * Create a new WebviewManager
	 * @param context Extension context
	 * @param logger Logger instance
	 * @param configService Config service
	 */
	constructor(
		context: vscode.ExtensionContext,
		logger: Logger,
		configService: ConfigService
	) {
		this.context = context;
		this.logger = logger;
		this.configService = configService;
		this.resourcesPath = path.join(context.extensionPath, 'resources');
		this.mediaPath = path.join(context.extensionPath, 'media');
	}

	/**
	 * Create or show a webview panel
	 * @param id Panel identifier
	 * @param options Webview options
	 * @param htmlContent HTML content for the webview
	 * @param messageHandler Message handler function
	 * @returns Webview panel
	 */
	public createOrShowWebview(
		id: string,
		options: WebviewOptions,
		htmlContent: string | (() => string),
		messageHandler?: WebviewMessageHandler
	): vscode.WebviewPanel {
		const {
			title,
			viewType,
			viewColumn = vscode.ViewColumn.Beside,
			preserveFocus = true,
			enableScripts = true,
			retainContextWhenHidden = true,
			localResourceRoots
		} = options;

		// If panel already exists, show it
		if (this.panels.has(id)) {
			const panel = this.panels.get(id)!;
			panel.title = title;
			panel.reveal(viewColumn, preserveFocus);

			// If content is provided as function, update it
			if (typeof htmlContent === 'function') {
				panel.webview.html = htmlContent();
			}

			return panel;
		}

		// Create webview panel
		const resourceRoots = localResourceRoots || [
			vscode.Uri.joinPath(this.context.extensionUri, 'media')
		];

		const panel = vscode.window.createWebviewPanel(
			viewType,
			title,
			{
				viewColumn,
				preserveFocus
			},
			{
				enableScripts,
				retainContextWhenHidden,
				localResourceRoots: resourceRoots
			}
		);

		// Set HTML content
		panel.webview.html = typeof htmlContent === 'function'
			? htmlContent()
			: htmlContent;

		// Store panel
		this.panels.set(id, panel);

		// Track disposables for this panel
		const disposables: vscode.Disposable[] = [];
		this.panelDisposables.set(id, disposables);

		// Register message handler
		if (messageHandler) {
			this.messageHandlers.set(id, messageHandler);
			const messageDisposable = panel.webview.onDidReceiveMessage(
				(message) => messageHandler(message),
				null,
				disposables
			);
			disposables.push(messageDisposable);
		}

		// Handle panel disposal
		panel.onDidDispose(
			() => {
				this.panels.delete(id);
				this.messageHandlers.delete(id);

				// Dispose panel-specific disposables
				const panelDisposables = this.panelDisposables.get(id) || [];
				panelDisposables.forEach(d => d.dispose());
				this.panelDisposables.delete(id);

				this.logger.debug(`Webview panel ${id} disposed`);
			},
			null,
			disposables
		);

		return panel;
	}

	/**
	 * Post message to a webview panel
	 * @param id Panel identifier
	 * @param message Message to post
	 * @returns Whether the message was posted
	 */
	public postMessage(id: string, message: any): boolean {
		const panel = this.panels.get(id);
		if (!panel) {
			return false;
		}
		// @ts-ignore: error TS2322: Type 'Thenable<boolean>' is not assignable to type 'boolean'.

		return panel.webview.postMessage(message);
	}

	/**
	 * Close a webview panel
	 * @param id Panel identifier
	 */
	public closePanel(id: string): void {
		const panel = this.panels.get(id);
		if (panel) {
			panel.dispose();
		}
	}

	/**
	 * Create HTML with proper resource URIs for webview
	 * @param panel Webview panel
	 * @param templatePath Path to HTML template relative to extension root
	 * @param replacements Map of placeholder keys to replacement values
	 * @returns HTML content with proper resource URIs
	 */
	public createHtmlFromTemplate(
		panel: vscode.WebviewPanel,
		templatePath: string,
		replacements: Map<string, string> = new Map()
	): string {
		const templateUri = vscode.Uri.joinPath(
			this.context.extensionUri,
			templatePath
		);
		const templateContent = fs.readFileSync(templateUri.fsPath, 'utf8');

		// Replace any placeholders
		let html = templateContent;
		for (const [key, value] of replacements.entries()) {
			html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
		}

		// Process resources (scripts, styles)
		html = this.processResources(panel, html);

		return html;
	}

	/**
	 * Process resources in HTML content, replacing paths with webview URIs
	 * @param panel Webview panel
	 * @param html HTML content
	 * @returns Processed HTML with proper resource URIs
	 */
	private processResources(panel: vscode.WebviewPanel, html: string): string {
		// Replace {{root}} with the extension URI
		html = html.replace(/{{root}}/g, this.context.extensionUri.toString());

		// Process <script> tags
		html = html.replace(
			/<script\s+src="([^"]+)"\s*><\/script>/g,
			(match, src) => {
				if (src.startsWith('http')) {
					// External URL, don't modify
					return match;
				}

				// Convert to webview URI
				const resourcePath = src.startsWith('/')
					? src.substring(1)
					: src;
				const resourceUri = vscode.Uri.joinPath(
					this.context.extensionUri,
					resourcePath
				);
				const webviewUri = panel.webview.asWebviewUri(resourceUri);

				// Use nonce for security
				const nonce = this.generateNonce();
				return `<script nonce="${nonce}" src="${webviewUri}"></script>`;
			}
		);

		// Process <link> tags (stylesheets)
		html = html.replace(
			/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g,
			(match, href) => {
				if (href.startsWith('http')) {
					// External URL, don't modify
					return match;
				}

				// Convert to webview URI
				const resourcePath = href.startsWith('/')
					? href.substring(1)
					: href;
				const resourceUri = vscode.Uri.joinPath(
					this.context.extensionUri,
					resourcePath
				);
				const webviewUri = panel.webview.asWebviewUri(resourceUri);

				return `<link rel="stylesheet" href="${webviewUri}">`;
			}
		);

		// Process <img> tags
		html = html.replace(
			/<img\s+src="([^"]+)"/g,
			(match, src) => {
				if (src.startsWith('http') || src.startsWith('data:')) {
					// External URL or data URI, don't modify
					return match;
				}

				// Convert to webview URI
				const resourcePath = src.startsWith('/')
					? src.substring(1)
					: src;
				const resourceUri = vscode.Uri.joinPath(
					this.context.extensionUri,
					resourcePath
				);
				const webviewUri = panel.webview.asWebviewUri(resourceUri);

				return `<img src="${webviewUri}"`;
			}
		);

		// Add Content Security Policy
		if (!html.includes('<meta http-equiv="Content-Security-Policy"')) {
			const csp = this.generateCSP(panel);
			html = html.replace(
				/<head>/i,
				`<head>\n${csp}`
			);
		}

		return html;
	}

	/**
	 * Generate Content Security Policy for a webview
	 * @param panel Webview panel
	 * @returns CSP meta tag
	 */
	private generateCSP(panel: vscode.WebviewPanel): string {
		const nonce = this.generateNonce();

		return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src ${panel.webview.cspSource} 'nonce-${nonce}'; img-src ${panel.webview.cspSource} https: data:; font-src ${panel.webview.cspSource};">`;
	}

	/**
	 * Generate a random nonce for CSP
	 * @returns Random nonce value
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
	 * Dispose all webview panels
	 */
	public dispose(): void {
		// Dispose all panels
		for (const panel of this.panels.values()) {
			panel.dispose();
		}

		this.panels.clear();
		this.messageHandlers.clear();

		// Dispose all panel-specific disposables
		for (const disposables of this.panelDisposables.values()) {
			disposables.forEach(d => d.dispose());
		}
		this.panelDisposables.clear();
	}

	/**
	 * Get a webview URI for a resource
	 * @param extensionUri Extension URI
	 * @param pathComponents Path components relative to extension root
	 * @returns Webview URI
	 */
	public getWebviewUri(extensionUri: vscode.Uri, pathComponents: string[]): vscode.Uri {
		return vscode.Uri.joinPath(extensionUri, ...pathComponents);
	}

	/**
	 * Get a webview resource URI
	 * @param webview Webview to get resource URI for
	 * @param relativePath Path relative to extension root
	 * @returns URI for the resource
	 */
	public getResourceUri(webview: vscode.Webview, relativePath: string): vscode.Uri {
		return webview.asWebviewUri(vscode.Uri.file(
			path.join(this.context.extensionPath, relativePath)
		));
	}

	/**
	 * Get HTML content for response panel
	 * @returns HTML content
	 */
	public getResponsePanelHtml(): string {
		// Try to load from file first
		const htmlPath = path.join(this.mediaPath, 'responsePanel.html');

		try {
			if (fs.existsSync(htmlPath)) {
				return fs.readFileSync(htmlPath, 'utf8');
			}
		} catch (error) {
			this.logger.warn(`Failed to load responsePanel.html: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Fall back to generated HTML
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AI Assistant Response</title>
	<style>
		body {
			padding: 0;
			color: var(--vscode-editor-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-editor-font-size);
			background-color: var(--vscode-editor-background);
		}
		#response {
			white-space: pre-wrap;
			padding: 10px;
			overflow-wrap: break-word;
		}
		.actions {
			display: flex;
			margin: 10px;
			gap: 8px;
		}
		button {
			padding: 6px 12px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			cursor: pointer;
		}
		button:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.error {
			color: var(--vscode-errorForeground);
			background-color: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			padding: 8px;
			margin: 8px 0;
		}
		pre {
			background-color: var(--vscode-textCodeBlock-background);
			padding: 8px;
			border-radius: 3px;
			overflow: auto;
		}
		code {
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
		}
	</style>
</head>
<body>
	<div class="actions">
		<button id="btnCopy">Copy</button>
		<button id="btnInsert">Insert Into Editor</button>
	</div>
	<div id="response"></div>
	<script>
		(function() {
			const vscode = acquireVsCodeApi();
			const responseElement = document.getElementById('response');
			const btnCopy = document.getElementById('btnCopy');
			const btnInsert = document.getElementById('btnInsert');

			// Handle messages from extension
			window.addEventListener('message', event => {
				const message = event.data;

				switch (message.command) {
					case 'reset':
						responseElement.innerHTML = '';
						break;
					case 'append':
						// Handle code blocks with syntax highlighting
						responseElement.innerHTML += message.content
							.replace(/\\n/g, '\\n')
							.replace(/\\r/g, '\\r');
						// Auto-scroll to bottom
						window.scrollTo(0, document.body.scrollHeight);
						break;
					case 'error':
						const errorDiv = document.createElement('div');
						errorDiv.className = 'error';
						errorDiv.textContent = message.message;
						responseElement.appendChild(errorDiv);
						break;
					case 'finish':
						// Maybe add some visual indication that the response is complete
						break;
				}
			});

			// Copy button handler
			btnCopy.addEventListener('click', () => {
				vscode.postMessage({
					command: 'copyToClipboard',
					content: responseElement.innerText
				});
			});

			// Insert button handler
			btnInsert.addEventListener('click', () => {
				vscode.postMessage({
					command: 'insertIntoEditor',
					content: responseElement.innerText
				});
			});
		})();
	</script>
</body>
</html>`;
	}
}
