#!/usr/bin/env node

/**
 * Build script for AI Assistant Extension
 * Usage: node scripts/build.js [--skip-webpack] [--no-dependencies]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);
const skipWebpack = args.includes('--skip-webpack');
const noDependencies = args.includes('--no-dependencies');

// Paths
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'out');
const distDir = path.join(rootDir, 'dist');

console.log('Starting AI Assistant Extension build process');

try {
	// Create output directories if they don't exist
	if (!fs.existsSync(outDir)) {
		fs.mkdirSync(outDir, { recursive: true });
	}

	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
	}

	// Step 1: Compile TypeScript
	console.log('Compiling TypeScript...');
	execSync('tsc -p ./', { cwd: rootDir, stdio: 'inherit' });
	console.log('✓ TypeScript compilation successful');

	// Step 2: Run webpack if not skipped
	if (!skipWebpack) {
		try {
			console.log('Running webpack...');
			execSync('webpack --mode production --devtool hidden-source-map', {
				cwd: rootDir,
				stdio: 'inherit'
			});
			console.log('✓ Webpack build successful');
		} catch (error) {
			console.warn('⚠️ Webpack build failed, falling back to direct TypeScript output');
			console.log('Copying TypeScript output to dist directory...');

			// Copy files from out to dist
			if (process.platform === 'win32') {
				// Windows copy command
				execSync('xcopy /E /I /Y out\\* dist\\', { cwd: rootDir, stdio: 'inherit' });
			} else {
				// Unix/Mac copy command
				execSync('cp -r out/* dist/', { cwd: rootDir, stdio: 'inherit' });
			}
		}
	} else {
		console.log('Copying TypeScript output to dist directory...');
		if (process.platform === 'win32') {
			execSync('xcopy /E /I /Y out\\* dist\\', { cwd: rootDir, stdio: 'inherit' });
		} else {
			execSync('cp -r out/* dist/', { cwd: rootDir, stdio: 'inherit' });
		}
	}

	// Step 3: Build VSIX package
	console.log('Creating VSIX package...');
	const vsceCommand = noDependencies ?
		'npx vsce package --no-dependencies' :
		'npx vsce package';

	execSync(vsceCommand, { cwd: rootDir, stdio: 'inherit' });

	// Find the created VSIX file
	const files = fs.readdirSync(rootDir);
	const vsixFiles = files.filter(f => f.endsWith('.vsix'));

	if (vsixFiles.length > 0) {
		console.log(`\n✅ Build successful! Package created: ${vsixFiles[0]}`);
		console.log(`Package location: ${path.join(rootDir, vsixFiles[0])}`);
	} else {
		console.log('⚠️ Build completed but could not find the .vsix package file');
	}

} catch (error) {
	console.error(`\n❌ Build failed: ${error.message}`);
	process.exit(1);
}
