#!/usr/bin/env node

/**
 * Pre-deployment check script for the AI Assistant extension
 */

const fs = require('fs');
const path = require('path');

const extensionPath = path.resolve(__dirname, '..');
console.log(`Running pre-deployment checks for: ${extensionPath}`);

let hasErrors = false;

// Check required files
const requiredFiles = [
	'package.json',
	'README.md',
	'CHANGELOG.md',
	'LICENSE',
	'media/icon.png'
];

console.log('\nChecking required files:');
for (const file of requiredFiles) {
	const filePath = path.join(extensionPath, file);
	if (fs.existsSync(filePath)) {
		console.log(`✓ ${file}`);
	} else {
		console.error(`✗ ${file} - MISSING`);
		hasErrors = true;
	}
}

// Check package.json for required fields
const packageJsonPath = path.join(extensionPath, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('\nChecking package.json fields:');
const requiredFields = [
	'name',
	'displayName',
	'version',
	'publisher',
	'description',
	'engines',
	'categories',
	'activationEvents',
	'main',
	'contributes'
];

for (const field of requiredFields) {
	if (packageJson[field]) {
		console.log(`✓ ${field}`);
	} else {
		console.error(`✗ ${field} - MISSING`);
		hasErrors = true;
	}
}

// Version format check
const versionPattern = /^\d+\.\d+\.\d+$/;
if (packageJson.version && versionPattern.test(packageJson.version)) {
	console.log(`✓ version format (${packageJson.version})`);
} else {
	console.error(`✗ version format (${packageJson.version || 'undefined'}) - INVALID`);
	hasErrors = true;
}

if (hasErrors) {
	console.error('\n❌ Pre-deployment checks failed. Please fix the issues before deploying.');
	process.exit(1);
} else {
	console.log('\n✅ All pre-deployment checks passed. Ready for deployment.');
	process.exit(0);
}

function runPreDeploymentCheck() {
	// Implementation for running pre-deployment check
}
