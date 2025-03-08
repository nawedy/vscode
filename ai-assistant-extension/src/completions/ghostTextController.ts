/**
 * GhostTextController
 *
 * Controls the display of ghost text in the editor.
 * Ghost text appears as faded text suggestions that can be accepted or ignored.
 */

import * as vscode from 'vscode';

/**
 * Controller for ghost text decorations
 */
export class GhostTextController {
	private editor: vscode.TextEditor | undefined;
	private ghostTextDecoration: vscode.TextEditorDecorationType;
	private disposables: vscode.Disposable[] = [];

	/**
	 * Create a new ghost text controller
	 */
	constructor() {
		this.ghostTextDecoration = vscode.window.createTextEditorDecorationType({
			color: 'rgba(128, 128, 128, 0.5)',
			light: {
				color: 'rgba(128, 128, 128, 0.5)'
			},
			dark: {
				color: 'rgba(169, 169, 169, 0.5)'
			},
			rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen
		});

		// Clear decorations when active editor changes
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(() => this.clearGhostText())
		);
	}

	/**
	 * Show ghost text in the editor
	 * @param editor Text editor
	 * @param text Ghost text to show
	 * @param position Position to show ghost text at
	 */
	public showGhostText(editor: vscode.TextEditor, text: string, position: vscode.Position): void {
		this.clearGhostText();
		this.editor = editor;

		const range = new vscode.Range(position, position);
		editor.setDecorations(this.ghostTextDecoration, [{
			range,
			renderOptions: {
				after: {
					contentText: text,
					color: 'rgba(128, 128, 128, 0.5)'
				}
			}
		}]);
	}

	/**
	 * Show ghost text across multiple lines
	 * @param editor Text editor
	 * @param text Ghost text to show
	 * @param range Range to show ghost text at
	 */
	public showMultilineGhostText(editor: vscode.TextEditor, text: string, range: vscode.Range): void {
		this.clearGhostText();
		this.editor = editor;

		// Create decorations at the end of each line in the range
		const decorations: vscode.DecorationOptions[] = [];
		const lines = text.split('\n');

		for (let i = range.start.line; i <= range.end.line && (i - range.start.line) < lines.length; i++) {
			const lineText = lines[i - range.start.line];
			const lineRange = new vscode.Range(
				new vscode.Position(i, editor.document.lineAt(i).text.length),
				new vscode.Position(i, editor.document.lineAt(i).text.length)
			);

			decorations.push({
				range: lineRange,
				renderOptions: {
					after: {
						contentText: lineText,
						color: 'rgba(128, 128, 128, 0.5)'
					}
				}
			});
		}

		editor.setDecorations(this.ghostTextDecoration, decorations);
	}

	/**
	 * Clear ghost text
	 */
	public clearGhostText(): void {
		if (this.editor) {
			this.editor.setDecorations(this.ghostTextDecoration, []);
			this.editor = undefined;
		}
	}

	/**
	 * Dispose resources
	 */
	public dispose(): void {
		this.clearGhostText();
		this.ghostTextDecoration.dispose();
		this.disposables.forEach(d => d.dispose());
	}
}
