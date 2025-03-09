#!/usr/bin/env node

/**
 * Simple build script for AI Assistant Extension
 * This script bypasses webpack and uses direct TypeScript compilation
 * for a more reliable build process.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Extension directory path
const extensionDir = path.resolve(__dirname, '..');
const distDir = path.join(extensionDir, 'dist');
const outDir = path.join(extensionDir, 'out');

console.log('Starting simple build process...');

function simpleBuild() {
	// Implementation for simple build
}

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
	if (process.platform === 'win32') {
		execSync('xcopy /E /I /Y out\\* dist\\', { cwd: extensionDir, stdio: 'inherit' });
	} else {
		execSync('cp -R ./out/* ./dist/', { cwd: extensionDir, stdio: 'inherit' });
	}
	console.log('Files copied successfully');

	// Step 3: Copy any necessary media files
	const mediaDir = path.join(extensionDir, 'media');
	const distMediaDir = path.join(distDir, 'media');

	if (fs.existsSync(mediaDir)) {
		console.log('Copying media files...');
		if (!fs.existsSync(distMediaDir)) {
			fs.mkdirSync(distMediaDir, { recursive: true });
		}

		if (process.platform === 'win32') {
			execSync('xcopy /E /I /Y media\\* dist\\media\\', { cwd: extensionDir, stdio: 'inherit' });
		} else {
			execSync('cp -R ./media/* ./dist/media/', { cwd: extensionDir, stdio: 'inherit' });
		}
	}

	console.log('\n✅ Build successful!');

} catch (error) {
	console.error(`\n❌ Build failed: ${error.message}`);
	process.exit(1);
}
