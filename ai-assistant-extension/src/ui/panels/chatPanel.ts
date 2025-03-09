import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { WebviewManager } from '../webviewManager';
import { ChatInterface } from '../webview/chatInterface';

export class ChatPanel {
	public static async create(
		context: vscode.ExtensionContext,
		webviewManager: WebviewManager,
		logger: Logger
	): Promise<vscode.WebviewPanel> {
		const panel = webviewManager.createWebviewPanel({
			title: "AI Assistant Chat",
			viewType: 'aiAssistant.chat',
			preserveFocus: true,
			retainContextWhenHidden: true
		});

		const chatInterface = new ChatInterface(panel.webview, logger);
		await chatInterface.initialize();

		panel.onDidDispose(() => {
			chatInterface.dispose();
		});

		return panel;
	}
}
