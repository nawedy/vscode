# AI Assistant Extension Troubleshooting Guide

This document provides solutions for common issues that may arise when using the AI Assistant extension.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Provider-Specific Issues](#provider-specific-issues)
3. [Performance Issues](#performance-issues)
4. [Token and Rate Limit Issues](#token-and-rate-limit-issues)
5. [Extension Not Working](#extension-not-working)
6. [Debugging Steps](#debugging-steps)
7. [Collecting Logs](#collecting-logs)

## Common Issues

### API Key Not Working

**Symptoms:** Authentication errors when using providers, "Invalid API key" errors.

**Solutions:**

1. Verify your API key is correct in the extension settings
2. Ensure you have billing set up (if required) for the provider
3. Try regenerating a new API key from the provider's website
4. Check if the API key has the correct permissions

### Connection Problems

**Symptoms:** "Network error" messages, timeouts, or connection refused errors.

**Solutions:**

1. Check your internet connection
2. Check if your firewall or proxy is blocking connections
3. Verify the provider's service status
4. If using a VPN, try disabling it

### No Response from AI

**Symptoms:** Request starts but never completes, or shows loading indefinitely.

**Solutions:**

1. Check for network issues
2. Increase the request timeout in settings
3. Try a different provider or model
4. Reduce the size of your request

### Code Not Highlighted Correctly

**Symptoms:** Code appears as plain text in the response panel.

**Solutions:**

1. Make sure your code was properly selected
2. Try using the proper markdown code blocks in custom prompts
3. Check if syntax highlighting is enabled in settings

## Provider-Specific Issues

### OpenAI

**"Rate limit reached" errors:**

- Wait a few minutes and try again
- Check your usage dashboard on OpenAI's website
- Consider upgrading your plan

**"Content policy violation" errors:**

- Ensure your content follows OpenAI's content policy
- Modify your prompt to avoid flagged content

### Anthropic

**"Invalid API key" errors despite correct key:**

- Verify the key format is correct
- Check if you're using the latest API version
- Anthropic may have rotated your API key

**Context length errors:**

- Reduce the size of your prompt
- Use a model with larger context window
- Enable token optimization in settings

### Mistral AI

**Model availability issues:**

- Check if your account has access to the selected model
- Verify the selected endpoint is correct
- Try different models to see which ones are available

### Qwen

**Regional availability:**

- Some models may be restricted by region
- Check that your account has access to the selected model
- Verify you're using the correct API endpoint

## Performance Issues

### Slow Responses

**Symptoms:** AI takes a very long time to generate responses.

**Solutions:**

1. Try a faster model (typically smaller models are faster)
2. Reduce the complexity of your prompts
3. Use more specific and concise prompts
4. Check your network latency
5. Enable streaming responses

### High Memory Usage

**Symptoms:** VS Code becomes sluggish when using the extension.

**Solutions:**

1. Reduce the size of the response panel
2. Clear old responses
3. Close other extensions
4. Restart VS Code after heavy usage

## Token and Rate Limit Issues

### Token Limits

**Symptoms:** "Context length exceeded" or "Input too long" errors.

**Solutions:**

1. Select smaller code snippets
2. Enable automatic token optimization in settings
3. Use a model with larger context window
4. Split your request into smaller parts

### Rate Limits

**Symptoms:** "Rate limit exceeded" errors.

**Solutions:**

1. Wait before making more requests
2. Reduce the frequency of your requests
3. Consider upgrading your API plan
4. Use a different provider temporarily

## Extension Not Working

### Extension Doesn't Activate

**Symptoms:** Commands not showing up, or not responding.

**Solutions:**

1. Check the output panel for errors (View → Output → AI Assistant)
2. Reload the window (Ctrl+Shift+P/Cmd+Shift+P → "Developer: Reload Window")
3. Ensure the extension is enabled
4. Check for conflicting extensions

### Commands Missing

**Symptoms:** Some AI Assistant commands are not showing in the command palette.

**Solutions:**

1. Make sure the extension is properly activated
2. Check if the missing commands are disabled in settings
3. Reset the extension settings to default

### Provider Not Available

**Symptoms:** Provider is listed but not selectable or showing as unavailable.

**Solutions:**

1. Check if you've configured the API key
2. Verify the provider's service status
3. Enable the provider in settings

## Debugging Steps

Follow these steps to troubleshoot issues:

1. **Enable debug logs:**

   - Open Settings (Ctrl+,/Cmd+,)
   - Search for "AI Assistant: Log Level"
   - Set to "Debug"

2. **Check logs:**

   - Open Output panel (View → Output)
   - Select "AI Assistant" from the dropdown

3. **Try basic commands:**

   - Run a simple "Explain Code" command on a small code snippet
   - Check if it completes successfully

4. **Verify configuration:**

   - Check that API keys are correctly configured
   - Verify provider settings

5. **Test network connectivity:**
   - Try accessing the provider's website in your browser
   - Check if other internet services are working

## Collecting Logs

If you need to report an issue:

1. Enable debug logging as described above
2. Reproduce the issue
3. Copy the full log from the Output panel
4. Remove any API keys or sensitive information
5. Include the logs in your issue report

When reporting issues, please include:

- Extension version
- VS Code version
- Provider and model being used
- Steps to reproduce
- Error messages and logs
- Expected vs. actual behavior
