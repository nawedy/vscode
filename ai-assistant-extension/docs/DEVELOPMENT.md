# AI Assistant Extension Development Guide

This document provides guidelines and information for developers contributing to the AI Assistant extension.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Architecture Overview](#architecture-overview)
3. [Adding a New Feature](#adding-a-new-feature)
4. [Adding a New Provider](#adding-a-new-provider)
5. [Testing](#testing)
6. [Debugging](#debugging)
7. [Code Style](#code-style)
8. [Documentation](#documentation)
9. [Release Process](#release-process)

## Development Setup

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- Visual Studio Code (latest stable version)

### Getting Started

1. Clone the repository

   ```bash
   git clone https://github.com/microsoft/vscode
   cd vscode
   ```

2. Install dependencies

   ```bash
   cd ai-assistant-extension
   npm install
   ```

3. Open in VS Code

   ```bash
   code .
   ```

4. Launch extension development
   - Press F5 or choose "Run and Debug" from the activity bar
   - Select "Extension Development" launch configuration

## Architecture Overview

The AI Assistant extension is built around these core components:

### Core Components

- **Model Providers**: Classes that implement the `BaseModelProvider` interface to connect to different AI services
- **Command Layer**: Handles VS Code commands and user interactions
- **UI Components**: WebViews and VS Code UI integration
- **Configuration Services**: Manages settings and API keys
- **Prompt Management**: Handles templates and processing for AI prompts
- **Utility Services**: Token counting, context extraction, error handling, etc.

### Key Files and Directories

- `src/extension.ts`: Entry point for the extension
- `src/ai/providers/`: AI provider implementations
- `src/ai/providerManager.ts`: Manager for all AI providers
- `src/commands/`: Command implementations
- `src/ui/`: UI components
- `src/services/`: Service implementations
- `src/utils/`: Utility functions
- `src/prompts/templates/`: Prompt templates

## Adding a New Feature

To add a new feature to the extension:

1. Identify the appropriate component (command, UI, provider, service)
2. Create a new file or extend an existing one
3. Implement the feature following the established patterns
4. Register any new commands in `extension.ts`
5. Add tests for your feature
6. Update documentation

### Example: Adding a New Command

1. Create a file `src/commands/myCommand.ts`
2. Implement the command handler
3. Register the command in `extension.ts`:
   ```typescript
   context.subscriptions.push(
   	vscode.commands.registerCommand("aiAssistant.myCommand", () => {
   		// Command implementation
   	})
   );
   ```
4. Add to command palette in `package.json`:
   ```json
   "contributes": {
     "commands": [
       {
         "command": "aiAssistant.myCommand",
         "title": "AI Assistant: My Command"
       }
     ]
   }
   ```

## Adding a New Provider

To add a new AI service provider:

1. Create a new file `src/ai/providers/myProvider.ts`
2. Implement the `BaseModelProvider` interface
3. Register your provider in `src/ai/providerManager.ts`
4. Add documentation for setting up the provider

### Example Provider Implementation

```typescript
export class MyProvider extends BaseModelProvider {
	constructor(configService: ConfigService, logger: Logger) {
		super("myProvider", "My Provider");
		this.configService = configService;
		this.logger = logger;
	}

	public async initialize(): Promise<boolean> {
		// Initialize the provider
	}

	public async generateCompletion(
		prompt: string,
		options?: ModelRequestOptions
	): Promise<ModelResponse> {
		// Implementation
	}

	// Other required methods
}
```

## Testing

The extension uses the following testing frameworks:

- Mocha for test running
- Chai for assertions
- Sinon for mocking

### Running Tests

```bash
npm test
```

### Writing Tests

- Place tests in the `test/` directory
- Mirror the source file structure
- Name test files with `.test.ts` suffix
- Use descriptive test names with the pattern `it('should do something')`

## Debugging

### Extension Debugging

- Press F5 to start debugging
- Use the "Debug Console" to see logs
- Set breakpoints in the editor

### Provider Debugging

- Enable debug logs in settings: `"aiAssistant.logLevel": "debug"`
- Check the "AI Assistant" output channel in VS Code

### Streaming Response Debugging

1. Set a breakpoint in the streaming handler function
2. Watch the streamed content in the variables panel
3. Step through the streaming process

## Error Handling

The extension uses a centralized error handling approach:

1. Provider-specific errors are mapped to standard categories in `ErrorHandler`
2. User-facing error messages are kept concise and actionable
3. Detailed errors are logged to the output channel
4. Where appropriate, retry mechanisms are provided

### Error Categories

- Authentication errors
- Network errors
- Rate limits
- Token limits
- Server errors
- Invalid requests

## Token Management

To manage token usage and avoid hitting API limits:

1. Use the `TokenOptimizer` to reduce content size
2. Split large requests into smaller chunks
3. Track token usage with `TokenUsageTracker`
4. Provide token usage information to users via the status bar

## Code Style

Follow the VS Code coding guidelines:

1. Use tabs for indentation
2. Use camelCase for variables and functions
3. Use PascalCase for classes and types
4. Use JSDoc comments for public APIs
5. Follow the VS Code naming conventions

## Documentation

Keep documentation up to date:

1. Update `README.md` for user-facing changes
2. Update `PROVIDERS.md` when adding or changing providers
3. Use JSDoc comments for all public APIs
4. Keep prompt templates documented and up to date

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run tests and ensure all pass
4. Create a release PR
5. After review and merge, create a GitHub release
6. Publish to VS Code Marketplace

## Security Considerations

1. Always store API keys securely using the Secret Storage API
2. Never log API keys or sensitive data
3. Use HTTPS for all API communications
4. Review dependencies for vulnerabilities regularly
5. Follow the guidelines in `SECURITY.md`
