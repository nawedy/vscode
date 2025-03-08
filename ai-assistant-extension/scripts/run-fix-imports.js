#!/usr/bin/env node

/**
 * Script to run all the import/TS error fixing scripts in sequence
 * Usage: node scripts/run-fix-imports.js
 */

const path = require('path');
const { execSync } = require('child_process');

const scripts = [
	'ignore-ts-errors.js',
	'fix_imports.js'
];

console.log('Running all import and TypeScript error fixing scripts...');

for (const script of scripts) {
	const scriptPath = path.join(__dirname, script);
	try {
		console.log(`\nRunning ${script}...`);
		execSync(`node "${scriptPath}"`, {
			stdio: 'inherit'
		});
		console.log(`✓ ${script} completed successfully`);
	} catch (error) {
		console.error(`\n✗ Error running ${script}:`, error.message);
		// Continue with other scripts even if one fails
	}
}

console.log('\nAll fixing scripts have been executed.');
