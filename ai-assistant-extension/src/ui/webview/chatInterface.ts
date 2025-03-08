import * as vscode from 'vscode';

export class ChatInterface {
    private panel: vscode.WebviewPanel | undefined;

    constructor() {
        this.createChatInterface();
    }

    private createChatInterface() {
        this.panel = vscode.window.createWebviewPanel(
            'chatInterface',
            'AI Chat',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'src', 'ui', 'webview')]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.panel.onDidDispose(() => this.panel = undefined);
    }

    private getWebviewContent(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AI Chat</title>
                <link rel="stylesheet" href="${this.panel!.webview.asWebviewUri(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'src', 'ui', 'webview', 'styles.css'))}">
            </head>
            <body>
                <div id="chat-container">
                    <div id="messages"></div>
                    <input type="text" id="user-input" placeholder="Type your message here..." />
                    <button id="send-button">Send</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const sendButton = document.getElementById('send-button');
                    const userInput = document.getElementById('user-input');
                    const messages = document.getElementById('messages');

                    sendButton.addEventListener('click', () => {
                        const message = userInput.value;
                        if (message) {
                            messages.innerHTML += '<div class="user-message">' + message + '</div>';
                            userInput.value = '';
                            vscode.postMessage({ command: 'sendMessage', text: message });
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'receiveMessage') {
                            messages.innerHTML += '<div class="ai-message">' + message.text + '</div>';
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}