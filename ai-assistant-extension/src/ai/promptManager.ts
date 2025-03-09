import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface Prompt {
	id: string;
	template: string;
	description?: string;
	variables?: string[];
	category?: string;
}

interface PromptTemplate {
	id: string;
	content: string;
	description?: string;
	variables: string[];
	metadata?: Record<string, unknown>;
}

export interface RenderOptions {
	template: string;
	variables: Record<string, unknown>;
	fallback?: string;
}

interface TemplateContent {
	content: string;
	metadata?: {
		description?: string;
		variables?: string[];
		[key: string]: unknown;
	};
}

interface RenderResult {
	rendered: string;
	success: boolean;
	error?: string;
}

/**
 * Manages prompt templates for AI requests
 */
export class PromptManager {
	private readonly context: vscode.ExtensionContext;
	private readonly logger: Logger;
	private templates: Map<string, PromptTemplate> = new Map();
	private readonly templateDir = 'src/prompts/templates';
	private prompts: Map<string, Prompt> = new Map();

	/**
	 * Create a new PromptManager
	 * @param context Extension context
	 * @param logger Logger instance
	 */
	constructor(context: vscode.ExtensionContext, logger: Logger) {
		this.context = context;
		this.logger = logger;
	}

	/**
	 * Load all prompt templates
	 */
	public async loadTemplates(): Promise<void> {
		try {
			this.logger.info('Loading prompt templates');

			const templatesPath = path.join(this.context.extensionPath, this.templateDir);

			// Check if templates directory exists
			if (!fs.existsSync(templatesPath)) {
				this.logger.warn(`Templates directory not found: ${templatesPath}`);
				return;
			}

			// Read all template files
			const templateFiles = fs.readdirSync(templatesPath).filter(file => file.endsWith('.md'));

			for (const file of templateFiles) {
				try {
					const templatePath = path.join(templatesPath, file);
					const content = fs.readFileSync(templatePath, 'utf8');
					const templateName = path.basename(file, '.md');

					this.templates.set(templateName, { id: templateName, content, variables: [] });
					this.logger.debug(`Loaded template: ${templateName}`);
				} catch (error) {
					this.logger.error(`Error loading template ${file}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			this.logger.info(`Loaded ${this.templates.size} prompt templates`);
		} catch (error) {
			this.logger.error(`Failed to load prompt templates: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Get a template by name
	 * @param templateName Template name
	 * @returns Template content or undefined if not found
	 */
	public getTemplate(templateName: string): string | undefined {
		const template = this.templates.get(templateName);
		return template?.content;
	}

	/**
	 * Get all available template names
	 * @returns Array of template names
	 */
	public getTemplateNames(): string[] {
		return Array.from(this.templates.keys());
	}

	/**
	 * Apply variables to a template
	 * @param templateName Template name
	 * @param variables Template variables
	 * @returns Processed template or undefined if template not found
	 */
	public processTemplate(templateName: string, variables: Record<string, string>): string | undefined {
		const template = this.getTemplate(templateName);

		if (!template) {
			this.logger.warn(`Template not found: ${templateName}`);
			return undefined;
		}

		// Replace template variables
		let result = template;
		for (const [key, value] of Object.entries(variables)) {
			const placeholder = `{{${key}}}`;
			result = result.replace(new RegExp(placeholder, 'g'), value);
		}

		return result;
	}

	/**
	 * Create a new template
	 * @param templateName Template name
	 * @param content Template content
	 * @returns Whether the template was created successfully
	 */
	public async createTemplate(templateName: string, content: string): Promise<boolean> {
		try {
			// Sanitize template name
			const safeName = templateName.replace(/[^a-z0-9]/gi, '').toLowerCase();
			const fileName = `${safeName}.md`;
			const templatePath = path.join(this.context.extensionPath, this.templateDir, fileName);

			// Write template file
			fs.writeFileSync(templatePath, content, 'utf8');

			// Add to loaded templates
			this.templates.set(safeName, { id: safeName, content, variables: [] });

			this.logger.info(`Created new template: ${safeName}`);
			return true;
		} catch (error) {
			this.logger.error(`Failed to create template ${templateName}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Update an existing template
	 * @param templateName Template name
	 * @param content New template content
	 * @returns Whether the template was updated successfully
	 */
	public async updateTemplate(templateName: string, content: string): Promise<boolean> {
		try {
			if (!this.templates.has(templateName)) {
				this.logger.warn(`Cannot update non-existent template: ${templateName}`);
				return false;
			}

			const templatePath = path.join(this.context.extensionPath, this.templateDir, `${templateName}.md`);

			// Write updated template file
			fs.writeFileSync(templatePath, content, 'utf8');

			// Update in-memory template
			this.templates.set(templateName, { id: templateName, content, variables: [] });

			this.logger.info(`Updated template: ${templateName}`);
			return true;
		} catch (error) {
			this.logger.error(`Failed to update template ${templateName}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	public render(
		templateId: string,
		variables: Record<string, unknown>,
		fallback?: string
	): RenderResult {
		const template = this.templates.get(templateId);
		if (!template) {
			return {
				rendered: fallback || '',
				success: false,
				error: `Template not found: ${templateId}`
			};
		}

		try {
			let result = template.content;
			for (const [key, value] of Object.entries(variables)) {
				const placeholder = `{{${key}}}`;
				result = result.replace(new RegExp(placeholder, 'g'), String(value));
			}

			return {
				rendered: result,
				success: true
			};
		} catch (error) {
			return {
				rendered: fallback || '',
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	public registerTemplate(template: PromptTemplate): void {
		this.templates.set(template.id, template);
		this.logger.info(`Registered template: ${template.id}`);
	}

	public getTemplate(id: string): string | undefined {
		return this.prompts.get(id)?.template;
	}

	public render(id: string, variables: Record<string, any>): string | undefined {
		const template = this.getTemplate(id);
		if (!template) {
			return undefined;
		}

		let result = template;
		for (const [key, value] of Object.entries(variables)) {
			const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
			result = result.replace(regex, String(value));
		}

		return result;
	}
}
