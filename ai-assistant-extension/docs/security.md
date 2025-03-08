# AI Assistant Security Guide

This document provides information about the security practices implemented in the AI Assistant extension, as well as recommendations for secure usage.

## Table of Contents

1. [API Key Storage](#api-key-storage)
2. [Data Handling](#data-handling)
3. [Code Submission](#code-submission)
4. [Provider Selection](#provider-selection)
5. [Local Models](#local-models)
6. [Security Best Practices](#security-best-practices)
7. [Security Audit Results](#security-audit-results)

## API Key Storage

The AI Assistant extension handles API keys with the following security measures:

- **Secure Storage**: API keys are stored in VS Code's built-in SecretStorage, which leverages your operating system's secure credential storage:

  - macOS: Keychain
  - Windows: Windows Credential Manager
  - Linux: libsecret (if available) or encrypted file

- **No Plain Text**: API keys are never stored in plain text configuration files

- **Secure Transmission**: When API keys are used to authenticate with AI providers, they are transmitted only over HTTPS

- **No Logging**: API keys are never written to log files

## Data Handling

When you use the AI Assistant extension, certain data may be sent to the AI provider:

- **Code Snippets**: The code you select for explanation, refactoring, etc.
- **Context Information**: File type, language ID, and surrounding code (if enabled)
- **User Prompts**: Any text you enter in prompts

The extension implements these safeguards:

- **Minimal Context**: By default, only the selected code is sent to the AI provider
- **Consent**: You must explicitly select code or initiate requests
- **Transparency**: The status bar indicates when requests are being made
- **No Automatic Collection**: The extension does not automatically analyze your workspace

## Code Submission

To minimize exposure of sensitive code:

1. **Review Before Sending**: Always review the code you're about to send to an AI provider
2. **Avoid Sensitive Data**: Do not include API keys, tokens, passwords, or other secrets in code sent to AI
3. **Use Token Limiting**: Enable token limiting to prevent accidentally sending large files
4. **Check Provider Terms**: Be aware of the data retention policies of your selected AI provider

## Provider Selection

Different AI providers have different security and privacy policies:

- **OpenAI**: May retain data for service improvement
- **Anthropic**: Offers data retention controls for enterprise users
- **Open Models**: Models like Mistral, Llama may have different guarantees
- **Local Models**: Provide maximum privacy but lower capability

### Provider Security Comparison

| Provider     | Data Retention               | Data Usage                   | Enterprise Options |
| ------------ | ---------------------------- | ---------------------------- | ------------------ |
| OpenAI       | 30 days                      | Training (opt-out available) | Yes                |
| Anthropic    | 30 days                      | No training without consent  | Yes                |
| Mistral      | Varies by tier               | No training without consent  | Yes                |
| Qwen         | Follows Alibaba Cloud policy | No training without consent  | Yes                |
| Local Models | None (data stays local)      | None                         | N/A                |

## Local Models

For maximum security, you can configure the extension to use local models:

1. Install a local model server like Ollama, LM Studio, or LocalAI
2. Configure the extension to use the local endpoint
3. Note that local models typically have lower capabilities than cloud-based options

## Security Best Practices

1. **Keep the Extension Updated**: Security improvements are regularly added
2. **Review Permissions**: Check which providers you've authorized
3. **Regenerate API Keys**: Periodically regenerate your AI provider API keys
4. **Use Workspace Isolation**: Use separate VS Code workspaces for different projects with varying sensitivity
5. **Check Logs**: Periodically review the extension logs for any unusual activity
6. **Use Trusted Providers**: Prefer well-established providers for sensitive work

## Security Audit Results

The AI Assistant extension undergoes regular security reviews:

- **Authentication**: ✅ Secure API key storage implemented
- **Data Transmission**: ✅ All data transmitted over HTTPS
- **Code Analysis**: ✅ No automatic code analysis without user consent
- **Dependency Security**: ✅ Regular scanning for vulnerable dependencies
- **Error Handling**: ✅ Error messages don't reveal sensitive information

Last security audit: May 2023

---

If you discover a security vulnerability, please report it by [filing an issue](https://github.com/microsoft/vscode/issues) with the title beginning with [SECURITY].
