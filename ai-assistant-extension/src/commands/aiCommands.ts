import * as vscode from 'vscode';
import { ModelManager } from '../ai/modelManager';
import { Logger } from '../utils/logger';
import { ViewManager } from '../ui/viewManager';

export class AICommands {
	constructor(
		private readonly modelManager: ModelManager,
		private readonly viewManager: ViewManager,
		private readonly logger: Logger
	) {}

	public async explain(): Promise<void> {
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			const selection = editor.selection;
			const text = selection.isEmpty ?
				editor.document.getText() :
				editor.document.getText(selection);

			await this.viewManager.showAIResponsePanel(
				'explain',
				'Code Explanation',
				async update => {
					const response = await this.modelManager.generateCompletion(
						`Explain this code:\n\n${text}`,
						{ stream: true }
					);
					return { content: response.content };
				}
			);
		} catch (error) {
			this.logger.error(`Error in explain command: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public async refactor(): Promise<void> {
		// ...existing code...
	}

	public async optimize(): Promise<void> {
		// ...existing code...
	}
}
