# AI Assistant Extension for VS Code

An AI-powered coding assistant that helps with code generation, explanation, refactoring, and optimization.

## Features

- **Explain Code**: Get explanations for selected code snippets
- **Generate Code**: Generate code based on your descriptions
- **Refactor Code**: Improve and refactor your existing code
- **Optimize Code**: Get suggestions for performance optimization
- **Document Code**: Automatically generate documentation for your code

## Requirements

- VS Code 1.75.0 or higher
- Internet connection for cloud providers
- Local LLM setup for offline use (optional)

## Extension Settings

- `ai-assistant.providers`: List of enabled AI providers
- `ai-assistant.activeProviderId`: ID of the active AI provider
- `ai-assistant.localLLM.apiUrl`: API URL for local LLM service
- `ai-assistant.context.maxDepth`: Maximum depth for related file context

## Usage

1. Select code in the editor
2. Use command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and search for "AI Assistant" commands
3. Choose the action you want the assistant to perform

## Development

### Prerequisites

- Node.js 14.x or higher
- npm 6.x or higher

### Building the Extension

1. Clone the repository:

   ```
   git clone https://github.com/microsoft/vscode-ai-assistant.git
   ```

2. Install dependencies:

   ```
   cd vscode-ai-assistant
   npm install
   ```

3. Build the extension:
   ```
   npm run compile
   ```

### Testing

Run the tests with:

```
npm test
```

### Packaging

Create a VSIX package with:

```
npm run package
```

## Contributing

We welcome contributions to this extension! Please see our [contribution guidelines](CONTRIBUTING.md) for more information.

## License

This extension is licensed under the [MIT License](LICENSE.md).

## Release Notes

### 1.0.0

- Initial release of the AI Assistant extension
- Basic response panel functionality
- Configurable settings
- Markdown rendering support
