#!/usr/bin/env node

/**
 * Simple wrapper script to run the ignore-ts-errors script with error handling
 * Usage: node scripts/run-ignore-ts-errors.js
 */

const path = require('path');
const { execSync } = require('child_process');

// Script path
const scriptPath = path.join(__dirname, 'ignore-ts-errors.js');

try {
	console.log('Running TypeScript error suppression script...');

	execSync(`node "${scriptPath}"`, {
		stdio: 'inherit'
	});

	console.log('TypeScript error suppression completed successfully.');
} catch (error) {
	console.error('Error running TypeScript error suppression script:', error.message);
	process.exit(1);
}
