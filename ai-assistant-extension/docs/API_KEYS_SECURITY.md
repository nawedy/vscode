# API Keys Security Guide

This document provides guidelines for securely managing API keys with the AI Assistant extension.

## Table of Contents

1. [How API Keys Are Stored](#how-api-keys-are-stored)
2. [Best Practices for API Key Management](#best-practices-for-api-key-management)
3. [Understanding API Key Permissions](#understanding-api-key-permissions)
4. [Key Rotation and Security](#key-rotation-and-security)
5. [Shared Environment Safety](#shared-environment-safety)
6. [Enterprise Deployment](#enterprise-deployment)
7. [What to Do If a Key Is Compromised](#what-to-do-if-a-key-is-compromised)

## How API Keys Are Stored

The AI Assistant extension uses VS Code's secure storage system to protect your API keys:

- **Windows:** Keys are stored in the Windows Credential Manager
- **macOS:** Keys are stored in the macOS Keychain
- **Linux:** Keys are stored using `libsecret` if available, or in an encrypted file

This secure storage ensures that:

- API keys are not stored in plain text
- Keys are encrypted at rest
- Keys are not included in settings sync
- Keys are not exposed in the VS Code UI

## Best Practices for API Key Management

### Creating API Keys

When creating API keys for use with the extension:

1. Create dedicated API keys specifically for VS Code usage
2. Set minimum required permissions (read-only when possible)
3. Apply usage limits when the provider allows it
4. Name your keys descriptively (e.g., "VS Code AI Assistant")

### Using API Keys

For secure usage:

1. Never share your API keys with others
2. Don't include API keys in code, comments, or documentation
3. Don't paste API keys in chat messages or emails
4. Use the secure key input provided by the extension

### Storing API Keys

For additional security:

1. Consider using environment-specific keys for different workspaces
2. For teams, use a secure key management solution rather than sharing keys
3. Use a password manager to back up your keys securely

## Understanding API Key Permissions

Different providers have different permission models for API keys:

### OpenAI

OpenAI API keys can have:

- Usage limits (set dollar amount caps)
- Organization restrictions
- Model restrictions

### Anthropic

Anthropic API keys have:

- Per model access controls
- Usage tracking

### Mistral AI

Mistral API keys support:

- Model-specific permissions
- Usage quotas

### Best Practice

Always create keys with the minimal permissions needed. For most use cases with this extension, you need only:

- Read access to models
- Permission to make completion requests
- NO write access to training data or company resources

## Key Rotation and Security

Regular key rotation enhances security:

1. **Schedule regular key rotation** (e.g., every 30-90 days)
2. **Revoke unused keys** through the provider's dashboard
3. **Monitor key usage** to detect abnormal patterns
4. **Update keys in the extension** after rotation by using the provider configuration commands

## Shared Environment Safety

In shared workspaces or pair programming scenarios:

1. **Never store API keys** in shared workspace settings
2. **Use user-level settings** only for API key configuration
3. **Be cautious with screen sharing** when entering or displaying keys
4. **Temporarily disable the extension** when presenting your screen if needed

## Enterprise Deployment

For organizations deploying this extension to multiple developers:

1. **Consider a proxy service** that provides access to AI services without exposing keys to individual developers
2. **Use organization-wide API keys** with proper monitoring
3. **Implement centralized key management and rotation**
4. **Configure content filtering** at the organization level
5. **Establish clear usage policies** to prevent misuse

## What to Do If a Key Is Compromised

If you suspect an API key has been compromised:

1. **Immediately revoke the key** through the provider's website/dashboard
2. **Generate a new key** if you still need access
3. **Monitor for unauthorized usage** in your provider's dashboard
4. **Check usage history** for any suspicious activity
5. **Report the incident** to your security team if it's a work API key

### Provider-Specific Key Revocation Instructions

#### OpenAI

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Find the key in question
3. Click "Delete" or "Revoke"

#### Anthropic

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Delete the compromised key

#### Mistral AI

1. Log in to [Mistral AI Platform](https://console.mistral.ai/)
2. Navigate to API Keys
3. Revoke the compromised key

#### Other Providers

Follow similar steps in the provider's dashboard or console.

## Additional Resources

- [OpenAI API Key Best Practices](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [VS Code Secret Storage API Documentation](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x00-header/)
