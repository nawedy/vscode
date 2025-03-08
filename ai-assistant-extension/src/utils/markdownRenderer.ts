import * as vscode from 'vscode';
import * as marked from 'marked';
import * as hljs from 'highlight.js';

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
// @ts-ignore: error TS2339: Property 'highlight' does not exist on type 'typeof import("highlight.js")'.
// @ts-ignore: error TS2339: Property 'highlight' does not exist on type 'typeof import("highlight.js")'.
// @ts-ignore: error TS2339: Property 'highlight' does not exist on type 'typeof import("highlight.js")'.
// @ts-ignore: error TS2339: Property 'highlight' does not exist on type 'typeof import("highlight.js")'.
// @ts-ignore: error TS2339: Property 'highlight' does not exist on type 'typeof import("highlight.js")'.
// @ts-ignore: error TS2339: Property 'highlight' does not exist on type 'typeof import("highlight.js")'.
				try {
					const highlighted = hljs.highlight(code, { language }).value;
					return `<pre class="hljs"><code class="language-${language}">${highlighted}</code></pre>`;
				} catch (e) {
// @ts-ignore: error TS2339: Property 'highlightAuto' does not exist on type 'typeof import("highlight.js")'.
					// If language isn't supported, use generic highlighting
					return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`;
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
