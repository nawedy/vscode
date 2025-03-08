import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

/**
 * Manages prompt templates for the extension
 */
export class PromptManager {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private templates: Map<string, string> = new Map();
	private promptsPath: string;

	constructor(context: vscode.ExtensionContext, logger: Logger) {
		this.context = context;
		this.logger = logger;
		this.promptsPath = path.join(context.extensionPath, 'resources', 'prompts');
	}

	/**
	 * Load all prompt templates from disk
	 */
	public async loadTemplates(): Promise<void> {
		this.logger.info('Loading prompt templates');

		try {
			const files = await fs.promises.readdir(this.promptsPath);

			for (const file of files) {
				if (file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.prompt')) {
					const templateName = path.basename(file, path.extname(file));
					const filePath = path.join(this.promptsPath, file);

					try {
						const templateContent = await fs.promises.readFile(filePath, 'utf8');
						this.templates.set(templateName, templateContent);
						this.logger.debug(`Loaded template: ${templateName}`);
					} catch (error) {
						this.logger.error(`Failed to load template ${templateName}: ${error}`);
					}
				} else if (file.endsWith('.json')) {
					// Load JSON-based prompts
					const templateName = path.basename(file, '.json');
					const filePath = path.join(this.promptsPath, file);

					try {
						const templateContent = await fs.promises.readFile(filePath, 'utf8');
						const templateData = JSON.parse(templateContent);

						// Check if it's a template with a "template" field or a collection
						if (templateData.template && typeof templateData.template === 'string') {
							this.templates.set(templateName, templateData.template);
							this.logger.debug(`Loaded JSON template: ${templateName}`);
						} else if (typeof templateData === 'object') {
							// Load each prompt in the collection
							for (const [key, value] of Object.entries(templateData)) {
								if (typeof value === 'string') {
									this.templates.set(`${templateName}-${key}`, value);
								} else if (value && typeof value === 'object' && 'template' in value && typeof value.template === 'string') {
									this.templates.set(`${templateName}-${key}`, value.template);
								}
							}
							this.logger.debug(`Loaded JSON template collection: ${templateName}`);
						}
					} catch (error) {
						this.logger.error(`Failed to load JSON template ${templateName}: ${error}`);
					}
				}
			}

			this.logger.info(`Loaded ${this.templates.size} prompt templates`);
		} catch (error) {
			this.logger.error(`Failed to load prompt templates: ${error}`);
		}
	}

	/**
	 * Check if a template exists
	 * @param templateName Template name
	 */
	public async hasTemplate(templateName: string): Promise<boolean> {
		return this.templates.has(templateName);
	}

	/**
	 * Apply a template with variables
	 * @param templateName Template name
	 * @param variables Variables to replace in the template
	 */
	public async applyTemplate(templateName: string, variables: Record<string, any>): Promise<string> {
		const template = this.templates.get(templateName);

		if (!template) {
			throw new Error(`Template not found: ${templateName}`);
		}

		let prompt = template;

		// Replace variables in the template
		for (const [key, value] of Object.entries(variables)) {
			const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
			prompt = prompt.replace(regex, String(value || ''));
		}

		return prompt;
	}

	/**
	 * Get a list of available templates
	 */
	public async listTemplates(): Promise<string[]> {
		return Array.from(this.templates.keys());
	}
}

/**
 * Utility Prompts
 *
 * Provides common prompt templates and utilities for working with AI prompts.
 */

/**
 * Prompt template data
 */
export interface PromptTemplate {
	id: string;
	template: string;
	description?: string;
	parameters?: string[];
}

/**
 * Prompt utilities
 */
export class PromptUtils {
	/**
	 * Replace placeholders in a template string
	 * @param template Template string
	 * @param values Values to replace placeholders
	 * @returns Rendered template
	 */
	static replaceParameters(template: string, values: Record<string, any>): string {
		let result = template;
		for (const [key, value] of Object.entries(values)) {
			const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
			result = result.replace(placeholder, String(value));
		}
		return result;
	}

	/**
	 * Load prompt templates from a file
	 * @param filePath Path to prompt file
	 * @param logger Logger instance
	 * @returns Array of prompt templates
	 */
	static loadPromptsFromFile(filePath: string, logger: Logger): PromptTemplate[] {
		try {
			if (!fs.existsSync(filePath)) {
				logger.warn(`Prompt file not found: ${filePath}`);
				return [];
			}

			const content = fs.readFileSync(filePath, 'utf8');
			const extension = path.extname(filePath).toLowerCase();

			if (extension === '.json') {
				return this.parseJsonPrompts(content, logger);
			} else {
				return [this.parseTextPrompt(content, filePath)];
			}
		} catch (error) {
			logger.error(`Error loading prompt file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	/**
	 * Parse JSON prompt file
	 * @param content JSON file content
	 * @param logger Logger instance
	 * @returns Array of prompt templates
	 */
	private static parseJsonPrompts(content: string, logger: Logger): PromptTemplate[] {
		try {
			const data = JSON.parse(content);

			// Handle array of prompts
			if (Array.isArray(data)) {
				return data.filter(item => item.id && item.template);
			}
			// Handle single prompt object
			else if (data.id && data.template) {
				return [data];
			}

			logger.warn('Invalid prompt format: must be an array or object with id and template');
			return [];
		} catch (error) {
			logger.error(`Error parsing JSON prompt: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	/**
	 * Parse text prompt file
	 * @param content Text file content
	 * @param filePath File path
	 * @returns Prompt template
	 */
	private static parseTextPrompt(content: string, filePath: string): PromptTemplate {
		const fileName = path.basename(filePath, path.extname(filePath));

		// Extract parameters from content
		const paramMatches = content.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
		const parameters = [...new Set(paramMatches.map(match => {
			const param = match.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
			return param ? param[1] : '';
		}))].filter(Boolean);

		return {
			id: fileName,
			template: content,
			parameters
		};
	}

	/**
	 * Format code snippets for inclusion in prompts
	 * @param code Code to format
	 * @param language Programming language
	 * @returns Formatted code
	 */
	static formatCodeForPrompt(code: string, language: string): string {
		return `\`\`\`${language}\n${code}\n\`\`\``;
	}

	/**
	 * Extract code blocks from AI response
	 * @param response AI model response
	 * @param language Expected language (optional)
	 * @returns Extracted code or original response if no code blocks found
	 */
	static extractCodeFromResponse(response: string, language?: string): string {
		// Look for code blocks with or without language specifier
		const codeBlockRegex = /```[\s\S]*?```/g;
		const match = response.match(codeBlockRegex);
		return match ? match[0] : response;
	}
}
