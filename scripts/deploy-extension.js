#!/usr/bin/env node

/**
 * Main script to deploy extensions within the VS Code repository
 * Usage: node scripts/deploy-extension.js [extension-folder] [--publish] [--skip-lint] [--skip-tests] [--force-install]
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

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
	spawnSync('node', ['scripts/deploy-extension.js', ...otherArgs], {
		cwd: extensionPath,
		stdio: 'inherit'
	});
} else {
	// Use the simple deployment approach
	console.log('No specific deploy script found, using general approach');

	// Check if node_modules exists
	if (!fs.existsSync(path.join(extensionPath, 'node_modules'))) {
		console.log('Installing dependencies...');
		spawnSync('npm', ['install'], { cwd: extensionPath, stdio: 'inherit' });
	}

	// Run the deploy command if it exists in package.json
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	if (packageJson.scripts && packageJson.scripts.deploy) {
		console.log('Running extension\'s deploy script from package.json');
		spawnSync('npm', ['run', 'deploy', ...otherArgs], {
			cwd: extensionPath,
			stdio: 'inherit'
		});
	} else {
		console.log('Building extension...');
		spawnSync('npm', ['run', 'build'], {
			cwd: extensionPath,
			stdio: 'inherit'
		});

		console.log('Packaging extension...');
		const shouldPublish = otherArgs.includes('--publish');
		const vsceCommand = shouldPublish ? 'publish' : 'package';
		spawnSync('npx', ['vsce', vsceCommand], {
			cwd: extensionPath,
			stdio: 'inherit'
		});
	}
}

console.log('Deployment process completed');
