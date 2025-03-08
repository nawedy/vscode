/**
 * Response panel script for AI Assistant extension
 * Handles interactive elements and communication with the extension
 */

(function () {
	// Get VS Code API
	const vscode = acquireVsCodeApi();

	// Cache DOM elements
	const responseElement = document.getElementById('response');
	const btnCopy = document.getElementById('btnCopy');
	const btnInsert = document.getElementById('btnInsert');
	const btnStop = document.getElementById('btnStop');

	// Store state for syntax highlighting
	let highlightPending = false;
	let currentCodeBlock = null;

	// Handle messages from extension
	window.addEventListener('message', event => {
		const message = event.data;

		switch (message.command) {
			case 'reset':
				responseElement.innerHTML = '';
				break;

			case 'append':
				appendContent(message.content);
				// Auto-scroll to bottom
				window.scrollTo(0, document.body.scrollHeight);
				break;

			case 'error':
				showError(message.message);
				break;

			case 'finish':
				// Add a completion indicator
				showCompletionIndicator();
				break;
		}
	});

	/**
	 * Append content with special handling for code blocks
	 */
	function appendContent(content) {
		const escapedContent = escapeHtml(content);

		// For now, just append the content directly
		// In a more advanced implementation, we could add syntax highlighting
		// and parsing of markdown
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = escapedContent
			.replace(/\r\n/g, '\n')
			.replace(/\n/g, '<br>');

		while (tempDiv.firstChild) {
			responseElement.appendChild(tempDiv.firstChild);
		}
	}

	/**
	 * Show an error message
	 */
	function showError(message) {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'error';
		errorDiv.textContent = message;
		responseElement.appendChild(errorDiv);
	}

	/**
	 * Show completion indicator
	 */
	function showCompletionIndicator() {
		const completionDiv = document.createElement('div');
		completionDiv.className = 'completion-indicator';
		completionDiv.textContent = 'Response complete ✓';
		completionDiv.style.color = 'var(--vscode-terminal-ansiGreen)';
		completionDiv.style.marginTop = '10px';
		completionDiv.style.fontStyle = 'italic';
		responseElement.appendChild(completionDiv);
	}

	/**
	 * Escape HTML special characters
	 */
	function escapeHtml(text) {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// Button event listeners
	if (btnCopy) {
		btnCopy.addEventListener('click', () => {
			vscode.postMessage({
				command: 'copyToClipboard',
				content: responseElement.innerText
			});
		});
	}

	if (btnInsert) {
		btnInsert.addEventListener('click', () => {
			vscode.postMessage({
				command: 'insertIntoEditor',
				content: responseElement.innerText
			});
		});
	}

	if (btnStop) {
		btnStop.addEventListener('click', () => {
			vscode.postMessage({
				command: 'stopGeneration'
			});
		});
	}

	// Initialize the response panel
	vscode.postMessage({ command: 'ready' });
})();
