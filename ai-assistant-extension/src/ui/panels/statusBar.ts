import * as vscode from 'vscode';

export class StatusBar {
	private statusBarItem: vscode.StatusBarItem;

	constructor() {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'aiAssistant.showStatus';
		this.updateStatus('Ready');
		this.statusBarItem.show();
	}

	public updateStatus(message: string) {
		this.statusBarItem.text = `$(robot) ${message}`;
	}

	public dispose() {
		this.statusBarItem.dispose();
	}
}