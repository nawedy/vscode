# AI Assistant Provider Setup Guide

This guide explains how to set up and configure the different AI model providers available in the AI Assistant extension.

## Table of Contents

1. [OpenAI](#openai)
2. [Anthropic](#anthropic)
3. [Mistral AI](#mistral-ai)
4. [Qwen](#qwen)
5. [DeepSeek](#deepseek)
6. [HuggingFace](#huggingface)
7. [Kimi](#kimi)
8. [XAI](#xai)
9. [Changing Default Provider](#changing-default-provider)
10. [Troubleshooting](#troubleshooting)

## OpenAI

OpenAI provides GPT models like GPT-3.5 and GPT-4.

### Setup Instructions

1. Create an account at [OpenAI Platform](https://platform.openai.com)
2. Navigate to [API Keys](https://platform.openai.com/account/api-keys)
3. Create a new API key
4. In VS Code, open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
5. Search for "AI Assistant: Configure Provider"
6. Select "OpenAI"
7. Enter your API key when prompted

### Available Models

- `gpt-3.5-turbo`: Fast, cost-effective model with good code capabilities
- `gpt-4`: More powerful model with better reasoning and code generation
- `gpt-4-turbo`: Enhanced version with larger context window

### Configuration Options

- **Default Model**: Set your preferred model in settings
- **Base URL**: Can be changed if using Azure OpenAI or other compatible endpoints
- **Temperature**: Controls randomness (0.0-1.0)

## Anthropic

Anthropic provides Claude models, known for their strong instruction following and high context windows.

### Setup Instructions

1. Create an account at [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key
4. In VS Code, use "AI Assistant: Configure Provider" command
5. Select "Anthropic"
6. Enter your API key when prompted

### Available Models

- `claude-instant-1`: Fast and cost-effective model
- `claude-2`: High-quality model with good reasoning
- `claude-3-opus`: Most powerful Claude model
- `claude-3-sonnet`: Balanced performance and speed

### Configuration Options

- **Default Model**: Set your preferred Claude model
- **Temperature**: Controls randomness (0.0-1.0)

## Mistral AI

Mistral AI offers efficient models with strong performance on coding tasks.

### Setup Instructions

1. Create an account at [Mistral AI Platform](https://console.mistral.ai/)
2. Generate a new API key
3. In VS Code, use "AI Assistant: Configure Provider" command
4. Select "Mistral AI"
5. Enter your API key when prompted

### Available Models

- `mistral-tiny`: Fast, efficient model for simpler tasks
- `mistral-small`: Balanced performance and efficiency
- `mistral-medium`: Most capable Mistral model

### Configuration Options

- **Default Model**: Set your preferred Mistral model
- **Temperature**: Controls randomness

## Qwen

Alibaba Cloud's Qwen models support code generation and understanding.

### Setup Instructions

1. Create an Alibaba Cloud account
2. Navigate to [Dashscope Console](https://dashscope.aliyun.com/)
3. Generate an API key
4. In VS Code, use "AI Assistant: Configure Provider" command
5. Select "Qwen"
6. Enter your API key when prompted

### Available Models

- `qwen-turbo`: Fast model for simple coding tasks
- `qwen-plus`: Balanced model for most coding tasks
- `qwen-max`: Most powerful Qwen model

### Configuration Options

- **Default Model**: Set your preferred Qwen model
- **Base URL**: Can be configured if needed

## DeepSeek

DeepSeek provides specialized code models.

### Setup Instructions

1. Create an account at [DeepSeek AI](https://platform.deepseek.com/)
2. Generate an API key
3. In VS Code, use "AI Assistant: Configure Provider" command
4. Select "DeepSeek"
5. Enter your API key when prompted

### Available Models

- `deepseek-coder`: Specialized coding model
- `deepseek-chat`: General purpose chat model

### Configuration Options

- **Default Model**: Choose between available DeepSeek models

## HuggingFace

HuggingFace Inference API allows access to many open models.

### Setup Instructions

1. Create an account on [HuggingFace](https://huggingface.co/)
2. Go to [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. Create a new token with "read" scope
4. In VS Code, use "AI Assistant: Configure Provider" command
5. Select "HuggingFace"
6. Enter your token when prompted

### Available Models

- Various models depending on what's available on HuggingFace
- Default is `meta-llama/Llama-2-13b-chat-hf`

### Configuration Options

- **Model ID**: Set a specific model ID to use
- **Endpoint URL**: Configure for private deployments

## Kimi

Kimi AI provides coding-focused models.

### Setup Instructions

1. Create an account at [Kimi AI](https://kimi.ai)
2. Navigate to API section
3. Generate an API key
4. In VS Code, use "AI Assistant: Configure Provider" command
5. Select "Kimi"
6. Enter your API key when prompted

### Available Models

- `kimi-chat`: Default Kimi chat model

### Configuration Options

- **Temperature**: Controls randomness

## XAI

XAI provides access to Grok models.

### Setup Instructions

1. Create an account at [XAI](https://x.ai)
2. Navigate to API section
3. Create an API key
4. In VS Code, use "AI Assistant: Configure Provider" command
5. Select "XAI"
6. Enter your API key when prompted

### Available Models

- `grok-1`: XAI's Grok model

### Configuration Options

- **Temperature**: Controls randomness
- **Base URL**: Can be configured if needed

## Changing Default Provider

To change which AI provider is used by default:

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Search for "AI Assistant: Select Provider"
3. Choose your preferred provider from the list

You can also set a specific provider in settings:

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "AI Assistant: Default Provider"
3. Select your preferred provider from the dropdown

## Troubleshooting

### API Key Issues

If you're experiencing authentication errors:

1. Verify your API key is correct
2. Ensure you have billing set up for paid providers (OpenAI, Anthropic, etc.)
3. Try regenerating your API key

### Rate Limit Errors

If you hit rate limits:

1. Check your usage dashboard on the provider's website
2. Consider upgrading your plan
3. Try a different provider temporarily

### Network Problems

If you're experiencing network issues:

1. Check your internet connection
2. Verify you're not behind a restrictive firewall
3. If using a VPN, try disabling it

### Model Availability

If a specific model isn't available:

1. Check if the provider has deprecated the model
2. Verify your API tier includes access to that model
3. Try selecting a different model

For further assistance, check the extension logs or file an issue on our GitHub repository.
