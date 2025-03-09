#!/usr/bin/env node

/**
 * Main script to deploy extensions within the VS Code repository
 * Usage: node scripts/deploy-extension.js [extension-folder] [--publish] [--skip-lint] [--skip-tests]
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Get arguments
const args = process.argv.slice(2);
const extensionFolder = args.find(arg => !arg.startsWith('--')) || 'ai-assistant-extension';
const otherArgs = args.filter(arg => arg.startsWith('--'));

// Check if extension folder exists
const extensionPath = path.join(__dirname, '..', extensionFolder);
if (!fs.existsSync(extensionPath)) {
	console.error(`Extension folder not found: ${extensionPath}`);
	process.exit(1);
}

// Check if package.json exists in extension folder
const packageJsonPath = path.join(extensionPath, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
	console.error(`package.json not found in extension folder: ${packageJsonPath}`);
	process.exit(1);
}

console.log(`Deploying extension: ${extensionFolder}`);

// Check if deploy-extension.js script exists in the extension folder
const extensionDeployScriptPath = path.join(extensionPath, 'scripts', 'deploy-extension.js');

if (fs.existsSync(extensionDeployScriptPath)) {
	// Use the extension's own deploy script if it exists
	console.log('Using extension\'s deploy script');
	try {
		execSync(`node "${extensionDeployScriptPath}" ${otherArgs.join(' ')}`, {
			stdio: 'inherit'
		});
		console.log('Deployment completed successfully');
	} catch (error) {
		console.error('Deployment failed:', error.message);
		process.exit(1);
	}
} else {
	console.error(`Extension deploy script not found: ${extensionDeployScriptPath}`);
	console.error('Please create a deploy-extension.js script in the extension\'s scripts folder');
	process.exit(1);
}

function deployExtension() {
	// Implementation for deploying extension
}
