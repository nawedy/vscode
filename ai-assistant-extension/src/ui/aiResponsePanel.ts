import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { Logger } from '../utils/logger';

interface ResponseMessage {
	type: 'code' | 'text' | 'error';
	content: string;
	language?: string;
	metadata?: Record<string, unknown>;
}

interface PanelState {
	responses: ResponseMessage[];
	currentLanguage?: string;
}

interface ViewMessage {
	command: string;
	data?: unknown;
}

/**
 * Response data returned by content providers
 */
interface ResponseData {
	content: string;
	[key: string]: unknown;
}

/**
 * Type for response generator function
 */
type ResponseGenerator = (
	updateCallback: (content: string) => void
) => Promise<ResponseData>;

/**
 * Manages AI response panels
 */
export class AIResponsePanel {
	private readonly context: vscode.ExtensionContext;
	private readonly webviewManager: WebviewManager;
	private readonly logger: Logger;
	private panel: vscode.WebviewPanel | undefined;
	private currentContent: string = '';
	private isStreaming: boolean = false;
	private state: PanelState = {
		responses: []
	};

	/**
	 * Create a new AIResponsePanel
	 * @param context Extension context
	 * @param webviewManager Webview manager
	 * @param logger Logger
	 */
	constructor(
		context: vscode.ExtensionContext,
		webviewManager: WebviewManager,
		logger: Logger
	) {
		this.context = context;
		this.webviewManager = webviewManager;
		this.logger = logger;
	}

	/**
	 * Show a response panel with content
	 * @param id Panel ID
	 * @param title Panel title
	 * @param responseGenerator Function that generates the response content
	 * @returns Webview panel
	 */
	public async showResponse(
		id: string,
		title: string,
		responseGenerator: ResponseGenerator
	): Promise<vscode.WebviewPanel> {
		this.logger.info(`Creating response panel: ${id}`);

		// Generate nonce for content security policy
		const nonce = getNonce();

		// Create or show webview panel
		const panel = this.webviewManager.createOrShowWebview(
			id,
			{
				title,
				viewType: 'aiAssistant.responsePanel',
				viewColumn: vscode.ViewColumn.Beside,
				preserveFocus: true,
				enableScripts: true,
				retainContextWhenHidden: true
			},
			// Initial HTML content
			this.getHtmlContent(nonce),
			// Message handler
			(message) => this.handleWebviewMessage(message, panel)
		);

		try {
			// Start generating response and update panel as content is generated
			const result = await responseGenerator((content) => {
				this.updatePanelContent(panel, content);
			});

			// Mark response as finished
			panel.webview.postMessage({
				type: 'finished'
			});

			// Set panel title with completion indicator
			panel.title = title + ' ✓';
		} catch (error) {
			// Handle error in generation
			this.logger.error(`Error generating response: ${error instanceof Error ? error.message : String(error)}`);

			// Show error in panel
			panel.webview.postMessage({
				type: 'error',
				message: error instanceof Error ? error.message : String(error)
			});

			// Set panel title with error indicator
			panel.title = title + ' ⚠️';
		}

		return panel;
	}

	/**
	 * Update the panel content
	 * @param panel Webview panel
	 * @param content New content
	 */
	private updatePanelContent(panel: vscode.WebviewPanel, content: string): void {
		panel.webview.postMessage({
			type: 'append',
			content
		});
	}

	/**
	 * Handle messages from the webview
	 * @param message Message object
	 * @param panel Source webview panel
	 */
	private handleWebviewMessage(message: unknown, panel: vscode.WebviewPanel): void {
		const typedMessage = message as { type: string; content?: string };

		switch (typedMessage.type) {
			case 'insert':
				// Insert content at current editor position
				if (typedMessage.content) {
					this.insertIntoEditor(typedMessage.content);
				}
				break;

			case 'copy':
				// Copy content to clipboard
				if (typedMessage.content) {
					vscode.env.clipboard.writeText(typedMessage.content);
				}
				break;

			case 'close':
				// Close the panel
				panel.dispose();
				break;
		}
	}

	/**
	 * Insert content into the active editor
	 * @param content Content to insert
	 */
	private insertIntoEditor(content: string): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active text editor to insert content into');
			return;
		}

		editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.active, content);
		});
	}

	/**
	 * Get the HTML content for the response panel
	 * @param nonce Content security nonce
	 * @returns HTML content
	 */
	private getHtmlContent(nonce: string = getNonce()): string {
		// Get media paths
		const scriptUri = this.webviewManager.getWebviewUri(
			this.context.extensionUri,
			['media', 'responsePanel.js']
		);
		const styleUri = this.webviewManager.getWebviewUri(
			this.context.extensionUri,
			['media', 'styles.css']
		);

		// Get CSP source from webview panel
		const panel = this.webviewManager.createWebviewPanel({
			title: 'Temporary',
			viewType: 'temp'
		});
		const cspSource = panel.webview.cspSource;
		panel.dispose();

		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}';">
				<title>AI Response</title>
				<link rel="stylesheet" href="${styleUri}">
			</head>
			<body>
				<div class="container">
					<div class="response-container">
						<pre class="response" id="response"></pre>
						<div class="loading" id="loading">
							<div class="loader"></div>
						</div>
					</div>
					<div class="error-message" id="error-message"></div>
					<div class="toolbar">
						<button id="copy-button" class="action-button" title="Copy to clipboard">Copy</button>
						<button id="insert-button" class="action-button" title="Insert at cursor position">Insert at Cursor</button>
						<button id="close-button" class="action-button" title="Close panel">Close</button>
					</div>
				</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>
		`;
	}

	/**
	 * Format content for the response panel
	 * @param content Raw content
	 * @returns Formatted content
	 */
	public formatContent(content: string): string {
		// Basic formatting for now
		return content
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	/**
	 * Create a standalone response panel
	 * @param title Panel title
	 * @param content Initial content
	 * @returns Webview panel
	 */
	public createStandalonePanel(title: string, content: string = ''): vscode.WebviewPanel {
		// Generate nonce for content security policy
		const nonce = getNonce();

		const panel = this.webviewManager.createOrShowWebview(
			`standalone-${Date.now()}`, // Generate unique ID
			{
				title,
				viewType: 'aiAssistant.responsePanel',
				viewColumn: vscode.ViewColumn.Beside,
				preserveFocus: true,
				enableScripts: true
			},
			this.getHtmlContent(nonce),
			(message) => this.handleWebviewMessage(message, panel)
		);

		// Set initial content
		if (content) {
			this.updatePanelContent(panel, content);
		}

		return panel;
	}

	/**
	 * Update a panel's title
	 * @param panel Webview panel
	 * @param title New title
	 */
	public updatePanelTitle(panel: vscode.WebviewPanel, title: string): void {
		panel.title = title;
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		if (this.panel) {
			this.panel.dispose();
			this.panel = undefined;
		}
	}

	/**
	 * Add a response message to the panel state
	 * @param message Response message to add
	 */
	public addResponse(message: ResponseMessage): void {
		this.state.responses.push(message);
		this.updateView();
	}

	/**
	 * Update the panel view based on current state
	 */
	private updateView(): void {
		if (!this.panel) {
			return;
		}

		// Implementation would be needed here based on requirements
		// For now, just sending the current state to the webview
		this.panel.webview.postMessage({
			type: 'updateState',
			state: this.state
		});
	}

	/**
	 * Handle messages from the webview
	 * @param message Message from webview
	 */
	private async handleMessage(message: ViewMessage): Promise<void> {
		// Implementation would be needed here based on requirements
		// This would handle specific message types from the webview
		switch (message.command) {
			case 'requestState':
				if (this.panel) {
					this.panel.webview.postMessage({
						type: 'updateState',
						state: this.state
					});
				}
				break;

			// Add other command handlers as needed
		}
	}
}

/**
 * Generate a nonce string
 * @returns Random nonce string
 */
function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
