#!/usr/bin/env node

/**
 * Setup script for the AI Assistant extension
 * This script ensures all required directories and files exist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Extension directory
const vscodeRoot = path.resolve(__dirname, '..');
const extensionDir = path.join(vscodeRoot, 'ai-assistant-extension');
const scriptsDir = path.join(extensionDir, 'scripts');

console.log(`Setting up AI Assistant extension in: ${extensionDir}`);

// Ensure scripts directory exists
if (!fs.existsSync(scriptsDir)) {
	console.log(`Creating scripts directory: ${scriptsDir}`);
	fs.mkdirSync(scriptsDir, { recursive: true });
}

// Ensure media directory exists
const mediaDir = path.join(extensionDir, 'media');
if (!fs.existsSync(mediaDir)) {
	console.log(`Creating media directory: ${mediaDir}`);
	fs.mkdirSync(mediaDir, { recursive: true });
}

// Create placeholder icon if it doesn't exist
const iconPath = path.join(mediaDir, 'icon.png');
if (!fs.existsSync(iconPath)) {
	console.log('Creating placeholder icon.png');
	// This is a 1x1 transparent PNG
	const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
	fs.writeFileSync(iconPath, minimalPng);
}

// Make scripts executable (on Unix-like systems)
try {
	if (process.platform !== 'win32') {
		console.log('Making scripts executable...');
		execSync(`chmod +x "${path.join(scriptsDir, 'deploy-extension.js')}"`, { stdio: 'inherit' });
		execSync(`chmod +x "${path.join(scriptsDir, 'simple-build.js')}"`, { stdio: 'inherit' });
		execSync(`chmod +x "${path.join(vscodeRoot, 'scripts', 'deploy-extension.js')}"`, { stdio: 'inherit' });
	}
} catch (error) {
	console.log('Note: Could not make scripts executable. You may need to run them with "node script.js"');
}

console.log('Setup complete!');
console.log('\nTo deploy the extension, run:');
console.log('node scripts/deploy-extension.js ai-assistant-extension --skip-lint --skip-tests');
