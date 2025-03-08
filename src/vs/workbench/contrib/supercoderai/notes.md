# SuperCoderVS - VSCode Fork with SuperCoderAI Integration

SuperCoderVS is a fork of Visual Studio Code that deeply integrates the SuperCoderAI context-aware coding assistant directly into the editor. Unlike the standard VSCode extension, this fork provides deeper integration capabilities, including:

- Native IDE integration with minimal performance overhead
- Custom UI panels and components optimized for AI interaction
- Seamless context management and visualization
- Real-time code suggestions and inline completions
- Advanced dependency visualization and navigation
- Direct file modification capabilities with complete context awareness

## Key Differences from VSCode Extension

While the SuperCoderAI extension provides many powerful features, this fork offers several advantages:

1. **Performance**: Direct integration with editor core for faster context processing
2. **UI Integration**: Custom webviews and panels deeply integrated with the IDE
3. **Context Management**: Native filesystem watchers and indexing for real-time context updates
4. **Suggestion Quality**: Deeper editor context for more accurate and relevant suggestions
5. **Visualization**: Custom rendering for dependency graphs and context visualization

## Getting Started

### Prerequisites

- Node.js 16 or newer
- Yarn
- Git

### Building from Source

1. Clone the repository:

```bash
git clone https://github.com/supercoderai/vscode-fork.git
cd vscode-fork
```

2. Install dependencies:

```bash
yarn
```

3. Build:

```bash
yarn watch
```

4. Launch:

```bash
yarn code
```

## Core Components

SuperCoderVS extends the base VSCode architecture with the following components:

### AI Integration Core

The AI Integration Core (`src/vs/workbench/contrib/supercoderai`) contains the central components for SuperCoderAI integration:

- `contextManager.ts`: Manages context gathering and indexing
- `aiService.ts`: Handles communication with the SuperCoderAI backend
- `suggestionProvider.ts`: Provides real-time code suggestions
- `dependencyVisualizer.ts`: Visualizes project dependencies
- `codeGeneration.ts`: Handles AI-powered code generation

### Custom UI Components

SuperCoderVS adds custom UI components to provide a seamless AI-assisted coding experience:

- AI Assistant Panel: Smart assistant panel with context-aware capabilities
- Inline Suggestions: Enhanced inline completion UI
- Dependency Visualization: Interactive dependency graph visualization
- Context Explorer: Visual explorer for codebase context
- Diff Review: Enhanced diff view for code suggestions

### Extended Editor APIs

SuperCoderVS extends the editor APIs to enable deeper AI integration:

- Context-aware completion providers
- Enhanced document tracking and analysis
- Language-specific semantic understanding
- Dependency tracking and visualization
- Real-time suggestion visualization

## Key Features

### Context-Aware Code Generation

- Smart code generation with full project understanding
- Multi-file implementations with dependency resolution
- Context-sensitive suggestions based on project standards

### Intelligent Refactoring

- Global refactoring with project-wide awareness
- Smart variable renaming with semantic understanding
- Code structure improvements with context sensitivity

### Advanced Visualization

- Interactive dependency graphs
- Context relevance visualization
- Code impact analysis

### Task Planning and Management

- AI-powered project planning
- Task breakdown and management
- Implementation order suggestions

## Configuration

SuperCoderVS adds several configuration options:

```json
{
  "supercoder.apiUrl": "http://localhost:8000",
  "supercoder.contextAwareness": true,
  "supercoder.maxFilesInContext": 20,
  "supercoder.inlineSuggestions": true,
  "supercoder.showDependencyGraph": true,
  "supercoder.aiProvider": "default"
}
```

## Contributing

Please see our [contribution guidelines](CONTRIBUTING.md) for details on how to contribute to SuperCoderVS.

## License

SuperCoderVS is licensed under the [MIT License](LICENSE).
