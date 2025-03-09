import * as vscode from 'vscode';
import { PromptManager } from '../ai/promptManager';
import { Logger } from '../utils/logger';

export interface PromptCommandOptions {
	language?: string;
	position?: vscode.Position;
	selection?: vscode.Selection;
	templateId?: string;
}

/**
 * Commands for working with prompts
 */
export class PromptCommands {
    private readonly context: vscode.ExtensionContext;
    private readonly promptManager: PromptManager;
    private readonly logger: Logger;

    /**
     * Create a new PromptCommands instance
     * @param context Extension context
     * @param promptManager Prompt manager
     * @param logger Logger
     */
    constructor(context: vscode.ExtensionContext, promptManager: PromptManager, logger: Logger) {
        this.context = context;
        this.promptManager = promptManager;
        this.logger = logger;
    }

    /**
     * Register prompt-related commands
     */
    public registerCommands(): vscode.Disposable[] {
        this.logger.info('Registering prompt commands');

        const disposables: vscode.Disposable[] = [];

        disposables.push(
            vscode.commands.registerCommand('aiAssistant.openPromptTemplate', this.openPromptTemplate.bind(this)),
            vscode.commands.registerCommand('aiAssistant.createPromptTemplate', this.createPromptTemplate.bind(this)),
            vscode.commands.registerCommand('aiAssistant.customPrompt', this.runCustomPrompt.bind(this))
        );

        return disposables;
    }

    /**
     * Command to open a prompt template
     */
    private async openPromptTemplate(): Promise<void> {
        try {
            // Get list of templates
            const templateNames = this.promptManager.getTemplateNames();

            if (templateNames.length === 0) {
                vscode.window.showInformationMessage('No prompt templates available');
                return;
            }

            // Let user select a template
            const selected = await vscode.window.showQuickPick(templateNames, {
                placeHolder: 'Select a prompt template to view'
            });

            if (!selected) {
                return;
            }

            // Get template content
            const templateContent = this.promptManager.getTemplate(selected);
            if (!templateContent) {
                vscode.window.showErrorMessage(`Template '${selected}' not found`);
                return;
            }

            // Create a new untitled document with the template
            const document = await vscode.workspace.openTextDocument({
                content: templateContent,
                language: 'markdown'
            });

            await vscode.window.showTextDocument(document);

        } catch (error) {
            this.logger.error(`Error opening prompt template: ${error instanceof Error ? error.message : String(error)}`);
            vscode.window.showErrorMessage(`Failed to open template: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Command to create a new prompt template
     */
    private async createPromptTemplate(): Promise<void> {
        try {
            // Ask for template name
            const templateName = await vscode.window.showInputBox({
                prompt: 'Enter a name for your new template',
                placeHolder: 'e.g., customCodeReview'
            });

            if (!templateName) {
                return;
            }

            // Create basic template structure
            const templateContent = `# ${templateName} Template

You are an expert software developer tasked with ${templateName}.

## Instructions

1. First instruction
2. Second instruction
3. Third instruction

## Input

\`\`\`{{language}}
{{code}}
\`\`\`

## Output Format

Please provide your response in the following format:

- Section 1
- Section 2
- Section 3
`;

            // Create new template file
            const success = await this.promptManager.createTemplate(templateName, templateContent);

            if (success) {
                vscode.window.showInformationMessage(`Created new template: ${templateName}`);

                // Open the new template for editing
                const document = await vscode.workspace.openTextDocument({
                    content: templateContent,
                    language: 'markdown'
                });

                await vscode.window.showTextDocument(document);

            } else {
                vscode.window.showErrorMessage(`Failed to create template: ${templateName}`);
            }
        } catch (error) {
            this.logger.error(`Error creating prompt template: ${error instanceof Error ? error.message : String(error)}`);
            vscode.window.showErrorMessage(`Failed to create template: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Command to run a custom prompt on selected code
     */
    private async runCustomPrompt(): Promise<void> {
        try {
            // Get the selected code
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText) {
                vscode.window.showWarningMessage('No text selected');
                return;
            }

            // Get prompt from user
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter your prompt for the selected code',
                placeHolder: 'e.g., Explain the complexity of this algorithm'
            });

            if (!prompt) {
                return;
            }

            // Execute the command with the custom prompt
            vscode.commands.executeCommand('aiAssistant.executeCustomPrompt', {
                prompt,
                code: selectedText,
                language: editor.document.languageId
            });

        } catch (error) {
            this.logger.error(`Error running custom prompt: ${error instanceof Error ? error.message : String(error)}`);
            vscode.window.showErrorMessage(`Failed to run custom prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async runPrompt(prompt: string, options: PromptCommandOptions = {}): Promise<void> {
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			const template = options.templateId ?
				this.promptManager.getTemplate(options.templateId) :
				undefined;

			const variables = {
				selection: options.selection ?
					editor.document.getText(options.selection) : '',
				language: options.language || editor.document.languageId,
				position: options.position || editor.selection.active
			};

			const processedPrompt = template ?
				this.promptManager.render(template, variables) :
				prompt;

			// Execute prompt
			await vscode.commands.executeCommand('aiAssistant.executePrompt', processedPrompt);
		} catch (error) {
			this.logger.error(`Error running prompt: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	public async savePrompt(name: string, prompt: string): Promise<void> {
		// ...existing code...
	}

	public async loadPrompt(name: string): Promise<string | undefined> {
		// ...existing code...
	}
}
