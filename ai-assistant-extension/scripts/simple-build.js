#!/usr/bin/env node

/**
 * Simple build script for AI Assistant Extension
 * This script bypasses webpack and uses direct TypeScript compilation
 * and vsce packaging for a more reliable build process.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Extension directory path
const extensionDir = path.resolve(__dirname, '..');
const distDir = path.join(extensionDir, 'dist');
const outDir = path.join(extensionDir, 'out');

console.log('Starting simple build process...');

try {
	// Ensure output directories exist
	if (!fs.existsSync(outDir)) {
		fs.mkdirSync(outDir, { recursive: true });
	}
	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
	}

	// Step 1: Compile TypeScript
	console.log('Compiling TypeScript...');
	execSync('npx tsc -p ./', {
		cwd: extensionDir,
		stdio: 'inherit'
	});
	console.log('TypeScript compilation completed');

	// Step 2: Copy compiled files to dist directory
	console.log('Copying files to dist directory...');
	execSync('cp -R ./out/* ./dist/', {
		cwd: extensionDir,
		stdio: 'inherit'
	});
	console.log('Files copied successfully');

	// Step 3: Create extension package
	console.log('Creating extension package...');
	execSync('npx vsce package --no-dependencies', {
		cwd: extensionDir,
		stdio: 'inherit'
	});
	console.log('Extension package created successfully');

	// Find and report the created .vsix file
	const files = fs.readdirSync(extensionDir);
	const vsixFiles = files.filter(f => f.endsWith('.vsix'));
	if (vsixFiles.length > 0) {
		console.log(`\n✅ Build successful! Package created: ${vsixFiles[0]}`);
		console.log(`Full path: ${path.join(extensionDir, vsixFiles[0])}`);
	} else {
		console.log('⚠️ Build completed but could not find .vsix package file');
	}

} catch (error) {
	console.error(`\n❌ Build failed: ${error.message}`);
	process.exit(1);
}
