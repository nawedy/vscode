#!/usr/bin/env node

/**
 * Script to deploy the AI Assistant extension
 * Usage: node scripts/deploy-extension.js [--publish] [--skip-lint] [--skip-tests]
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const shouldPublish = args.includes('--publish');
const skipLint = args.includes('--skip-lint');
const skipTests = args.includes('--skip-tests');
const forceInstall = args.includes('--force-install');

// Extension directory path
const extensionPath = path.resolve(__dirname, '..');
console.log(`Deploying extension from: ${extensionPath}`);

// Check if package.json exists
if (!fs.existsSync(path.join(extensionPath, 'package.json'))) {
	console.error('package.json not found. Are you in the right directory?');
	process.exit(1);
}

// Check if node_modules exists or force install is requested
if (forceInstall || !fs.existsSync(path.join(extensionPath, 'node_modules'))) {
	console.log('Installing dependencies...');
	execSync('npm install', { cwd: extensionPath, stdio: 'inherit' });
}

// Run pre-deployment checks
console.log('Running pre-deployment checks...');
try {
	execSync('node ./scripts/preDeploymentCheck.js', {
		cwd: extensionPath,
		stdio: 'inherit'
	});
	console.log('✅ Pre-deployment checks passed');
} catch (error) {
	console.error('❌ Pre-deployment checks failed');
	process.exit(1);
}

// Run linting if not skipped
if (!skipLint) {
	console.log('Running linter...');
	try {
		execSync('npm run lint', { cwd: extensionPath, stdio: 'inherit' });
		console.log('✅ Linting passed');
	} catch (error) {
		console.error('❌ Linting failed');
		console.log('Trying to auto-fix issues...');

		try {
			execSync('npm run fix-all', { cwd: extensionPath, stdio: 'inherit' });
			console.log('✅ Auto-fixes applied');
		} catch (fixError) {
			console.error('❌ Auto-fixes failed, but continuing with deployment');
		}
	}
}

// Run tests if not skipped
if (!skipTests) {
	console.log('Running tests...');
	try {
		execSync('npm test', { cwd: extensionPath, stdio: 'inherit' });
		console.log('✅ Tests passed');
	} catch (error) {
		console.error('❌ Tests failed. Run with --skip-tests to bypass tests.');
		process.exit(1);
	}
}

// Build the extension
console.log('Building extension...');
try {
	try {
		execSync('npm run build', { cwd: extensionPath, stdio: 'inherit' });
	} catch (buildError) {
		console.log('Webpack build failed, falling back to simple build...');
		execSync('npm run build-simple', { cwd: extensionPath, stdio: 'inherit' });
	}
	console.log('✅ Build completed');
} catch (error) {
	console.error('❌ Build failed');
	process.exit(1);
}

// Package the extension
console.log('Packaging extension...');
const vsceCommand = shouldPublish ? 'vsce publish' : 'vsce package';

try {
	execSync(vsceCommand, { cwd: extensionPath, stdio: 'inherit' });

	if (shouldPublish) {
		console.log('✅ Extension published successfully!');
	} else {
		// Find the created VSIX file
		const files = fs.readdirSync(extensionPath);
		const vsixFiles = files.filter(f => f.endsWith('.vsix'));

		if (vsixFiles.length > 0) {
			console.log(`✅ Extension packaged successfully: ${vsixFiles[0]}`);
			console.log(`Full path: ${path.join(extensionPath, vsixFiles[0])}`);
		} else {
			console.log('✅ Extension packaging seems to have completed, but couldn\'t find .vsix file.');
		}
	}
} catch (error) {
	console.error('❌ Packaging failed');
	process.exit(1);
}
