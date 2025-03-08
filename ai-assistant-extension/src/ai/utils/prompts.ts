/**
 * Document type for model input
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';

/**
 * Document type for model input
 */
export enum DocumentType {
    TEXT = 'text',
    CODE = 'code',
    MARKDOWN = 'markdown',
    JSON = 'json',
    YAML = 'yaml',
    HTML = 'html',
    XML = 'xml',
    CSV = 'csv'
}

/**
 * Document type with extensions
 */
export interface ExtendedDocumentType {
    name: string;
    extensions: string[];
}

/**
 * Generate a prompt for a specific model
 */
export function generatePromptForModel(modelName: string, context: string): string {
    return `Using the ${modelName} model, please analyze the following context: ${context}`;
}

/**
 * Create a completion prompt with token limit
 */
export function createCompletionPrompt(prompt: string, maxTokens: number = 100): string {
    return `Generate a completion for the following prompt: "${prompt}" with a maximum of ${maxTokens} tokens.`;
}

/**
 * Format a prompt for display
 */
export function formatPromptForDisplay(prompt: string): string {
    return `**Prompt:** ${prompt}`;
}

/**
 * Get document type prompt
 */
export function getDocumentTypePrompt(documentType: ExtendedDocumentType): string {
    return `Generate a response based on the document type: ${documentType.name} with extensions: ${documentType.extensions.join(", ")}`;
}

/**
 * Prompt template interface
 */
export interface PromptTemplate {
    id: string;
    template: string;
    description?: string;
    parameters?: string[];
}

/**
 * Utility Prompts
 *
 * Provides common prompt templates and utilities for working with AI prompts.
 */

/**
 * Prompt utilities
 */
export class PromptUtils {
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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error loading prompt file ${filePath}: ${errorMessage}`);
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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error parsing JSON prompt: ${errorMessage}`);
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
}
