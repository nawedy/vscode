# Deployment Guide for AI Assistant Extension

This document describes the process for deploying the AI Assistant Extension to the Visual Studio Code Marketplace.

## Prerequisites

Before deployment, ensure you have:

1. [Node.js](https://nodejs.org/) 16.x or later installed
2. [VS Code Extension Manager](https://github.com/microsoft/vscode-vsce) (`vsce`) installed globally
   ```bash
   npm install -g @vscode/vsce
   ```
3. A Personal Access Token (PAT) for the VS Code Marketplace
   - Create one at [Azure DevOps](https://dev.azure.com)
   - Ensure it has "Marketplace > Manage" scope

## Manual Deployment Steps

### 1. Prepare for Deployment

Run pre-deployment checks to ensure everything is set up correctly:

```bash
npm run predeployment-check
```

This will verify that all required files exist and have the correct content.

### 2. Update Version

Increment the extension version using the version script:

```bash
npm run version [major|minor|patch]
```

This will:

- Update the version in package.json
- Update the CHANGELOG.md
- Commit the changes and create a git tag (if in a git repository)

### 3. Package the Extension

Create a .vsix package file:

```bash
npm run package
```

The packaged extension will be created in the root directory.

### 4. Deploy to VS Code Marketplace

Deploy the extension:

```bash
# First set your PAT as an environment variable
export VSCE_PAT=your_personal_access_token

# Deploy without publishing
npm run deploy

# Or deploy and publish to marketplace
npm run deploy:publish
```

## Automated Deployment via GitHub Actions

This repository includes GitHub Actions workflows for CI/CD:

1. **On Pull Request/Push:** The extension will be built and tested
2. **On Release:** The extension will be built, tested, and published to the marketplace

To create a release:

1. Create a new tag: `git tag v1.0.1`
2. Push the tag: `git push origin v1.0.1`
3. Create a release on GitHub using this tag
4. The GitHub Actions workflow will automatically publish the extension

## Deployment Checklist

Before each deployment, verify:

- [x] All tests pass
- [x] Lint checks pass
- [x] Version has been incremented
- [x] CHANGELOG.md has been updated
- [x] README.md is up to date
- [x] License information is accurate
- [x] Extension icon and branding are present
- [x] Key features are documented
- [x] Pre-deployment checks pass

## Troubleshooting

Common deployment issues:

1. **Authentication Errors:**

   - Check that your PAT is valid and has the correct permissions
   - Verify the PAT hasn't expired

2. **Package Validation Errors:**

   - Run `vsce validate` to check for issues before publishing
   - Common issues include missing files referenced in package.json

3. **Version Conflicts:**
   - Ensure you're not trying to publish a version that already exists in the marketplace
   - Always increment the version before deploying

## Post-Deployment

After deployment:

1. Verify the extension appears correctly in the marketplace
2. Test installation from the marketplace
3. Tag the repository with the released version
4. Start planning the next version
