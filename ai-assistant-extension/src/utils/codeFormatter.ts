import * as vscode from 'vscode';
import { Logger } from './logger';

export interface FormattingOptions {
    insertSpaces?: boolean;
    tabSize?: number;
    language?: string;
}

export class CodeFormatter {
    constructor(private readonly logger: Logger) {}

    public async format(code: string, options: FormattingOptions): Promise<string> {
        try {
            const document = await vscode.workspace.openTextDocument({
                content: code,
                language: options.language
            });

            const edits = await vscode.languages.getLanguageConfiguration(
                options.language || 'plaintext'
            ).onEnterRules || [];

            const formatted = await vscode.workspace.applyEdit(
                new vscode.WorkspaceEdit()
            );

            return document.getText();
        } catch (error) {
            this.logger.error(`Formatting failed: ${error instanceof Error ? error.message : String(error)}`);
            return code;
        }
    }

    public async formatFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.commands.executeCommand('editor.action.formatDocument');
        } catch (error) {
            this.logger.error(`File formatting failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
