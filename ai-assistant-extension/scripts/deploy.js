#!/usr/bin/env node

/**
 * Main deployment script for the AI Assistant extension
 * This is an alias to deploy-extension.js for compatibility
 */

const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const scriptPath = path.join(__dirname, 'deploy-extension.js');

function deploy() {
	// Implementation for deployment
}

try {
	// Pass all arguments to deploy-extension.js
	execSync(`node "${scriptPath}" ${args.join(' ')}`, {
		stdio: 'inherit'
	});
} catch (error) {
	console.error('Deployment failed:', error.message);
	process.exit(1);
}
