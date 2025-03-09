import * as vscode from 'vscode';
import { marked } from 'marked';
import { highlight, highlightAuto } from 'highlight.js';
import { Logger } from './logger';

export interface RenderOptions {
	codeBlockHighlight?: boolean;
	inlineLinks?: boolean;
	tableFormatting?: boolean;
}

/**
 * Renderer options
 */
interface RendererOptions {
	darkMode?: boolean;
	syntaxHighlight?: boolean;
	linkify?: boolean;
}

/**
 * Utility class for rendering Markdown content
 */
export class MarkdownRenderer {
	constructor(
		private readonly logger: Logger
	) {}

	/**
	 * Render markdown to HTML
	 * @param markdown Markdown content
	 * @param options Renderer options
	 * @returns HTML content
	 */
	public static renderToHtml(markdown: string, options: RendererOptions = {}): string {
		const renderer = new marked.Renderer();

		// Configure code block rendering with syntax highlighting
		renderer.code = (code, language) => {
			if (options.syntaxHighlight && language) {
				try {
					const highlighted = highlight(code, { language }).value;
					return `<pre class="hljs"><code class="language-${language}">${highlighted}</code></pre>`;
				} catch (e) {
					// If language isn't supported, use generic highlighting
					return `<pre class="hljs"><code>${highlightAuto(code).value}</code></pre>`;
				}
			}

			// Without syntax highlighting
			return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
		};

		// Configure link rendering
		renderer.link = (href, title, text) => {
			const titleAttr = title ? ` title="${title}"` : '';
			if (options.linkify) {
				return `<a href="${href}"${titleAttr} class="external-link">${text}</a>`;
			} else {
				// Use VSCode workspace URI scheme for internal links
				return `<a href="command:vscode.open?${encodeURIComponent(JSON.stringify({ uri: href }))}"${titleAttr}>${text}</a>`;
			}
		};

		// Configure table rendering
		renderer.table = (header, body) => {
			return `<div class="table-container"><table>
				<thead>${header}</thead>
				<tbody>${body}</tbody>
			</table></div>`;
		};

		// Set up marked options
		const markedOptions: marked.MarkedOptions = {
			renderer,
			gfm: true,
			breaks: true,
			smartLists: true
		};

		// Render the markdown
		const html = marked.parse(markdown, markedOptions);

		// Add dark mode class if needed
		const themeClass = options.darkMode ? 'theme-dark' : 'theme-light';

		return `
			<div class="markdown-body ${themeClass}">
				${html}
			</div>
		`;
	}

	public render(markdown: string, options: RenderOptions = {}): vscode.Uri {
		try {
			// Create temporary markdown file
			const tempUri = this.createTempMarkdownFile(markdown);

			// Apply formatting options
			let content = markdown;
			if (options.codeBlockHighlight) {
				content = this.highlightCodeBlocks(content);
			}
			if (options.inlineLinks) {
				content = this.processInlineLinks(content);
			}
			if (options.tableFormatting) {
				content = this.formatTables(content);
			}

			return tempUri;
		} catch (error) {
			this.logger.error(`Error rendering markdown: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	private createTempMarkdownFile(content: string): vscode.Uri {
		// Implementation would create a temp file and return its URI
		return vscode.Uri.file('temp.md');
	}

	private highlightCodeBlocks(markdown: string): string {
		// Implementation for code block highlighting
		return markdown;
	}

	private processInlineLinks(markdown: string): string {
		// Implementation for inline link processing
		return markdown;
	}

	private formatTables(markdown: string): string {
		// Implementation for table formatting
		return markdown;
	}

	/**
	 * Escape HTML content to prevent XSS
	 * @param html HTML content
	 * @returns Escaped HTML
	 */
	private static escapeHtml(html: string): string {
		return html
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * Extract code blocks from markdown
	 * @param markdown Markdown content
	 * @returns Array of code blocks with language info
	 */
	public static extractCodeBlocks(markdown: string): Array<{ language: string; code: string }> {
		const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
		const codeBlocks: Array<{ language: string; code: string }> = [];

		let match;
		while ((match = codeBlockRegex.exec(markdown)) !== null) {
			codeBlocks.push({
				language: match[1] || 'text',
				code: match[2]
			});
		}

		return codeBlocks;
	}

	/**
	 * Parse code editing instructions from markdown
	 * @param markdown Markdown content
	 * @returns Object containing file paths and their changes
	 */
	public static parseEditInstructions(markdown: string): Record<string, string> {
		const fileChanges: Record<string, string> = {};
		const fileBlockRegex = /### ([\S]+)\n\n([\s\S]*?)(?=\n### |$)/g;

		let match;
		while ((match = fileBlockRegex.exec(markdown)) !== null) {
			const filePath = match[1];
			const changes = match[2].trim();
			fileChanges[filePath] = changes;
		}

		return fileChanges;
	}
}
