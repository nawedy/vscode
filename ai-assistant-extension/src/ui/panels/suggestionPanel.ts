// @ts-ignore: error TS2305: Module '"../../ai/modelManager"' has no exported member 'AIModel'.
// @ts-ignore: error TS2305: Module '"../../ai/modelManager"' has no exported member 'AIModel'.
// @ts-ignore: error TS2305: Module '"../../ai/modelManager"' has no exported member 'AIModel'.
// @ts-ignore: error TS2305: Module '"../../ai/modelManager"' has no exported member 'AIModel'.
// @ts-ignore: error TS2305: Module '"../../ai/modelManager"' has no exported member 'AIModel'.
// @ts-ignore: error TS2305: Module '"../../ai/modelManager"' has no exported member 'AIModel'.
import * as vscode from 'vscode';
import { AIModel } from '../../ai/modelManager';

export class SuggestionPanel {
	private panel: vscode.WebviewPanel | undefined;
	private readonly extensionUri: vscode.Uri;

	constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri;
	}

	public createOrShow(context: vscode.ExtensionContext, aiModel: AIModel): void {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
		} else {
			this.panel = vscode.window.createWebviewPanel(
				'aiAssistantSuggestions',
				'AI Suggestions',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [this.extensionUri]
				}
			);

			this.panel.onDidDispose(() => this.panel = undefined, null, context.subscriptions);
			this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), null, context.subscriptions);
		}

		this.updatePanel(aiModel);
	}

	private updatePanel(aiModel: AIModel): void {
		if (!this.panel) {
			return;
		}

		const suggestions = aiModel.getSuggestions();
		this.panel.webview.html = this.getHtmlForWebview(suggestions);
	}

	private getHtmlForWebview(suggestions: string[]): string {
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>AI Suggestions</title>
				<style>
					body { font-family: Arial, sans-serif; }
					.suggestion { margin: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
				</style>
			</head>
			<body>
				<h1>AI Suggestions</h1>
				${suggestions.map(s => `<div class="suggestion">${s}</div>`).join('')}
			</body>
			</html>
		`;
	}

	private handleMessage(message: any): void {
		switch (message.command) {
			case 'close':
				this.panel?.dispose();
				break;
		}
	}
}