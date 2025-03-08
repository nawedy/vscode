#!/usr/bin/env node

/**
 * Script to fix common issues in the AI Assistant Extension
 * Usage: node scripts/fix_ai_extension_issues.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'ai-assistant-extension');

console.log(`Running AI extension fix script for: ${extensionDir}`);

// Function to ensure a directory exists
function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		console.log(`Creating directory: ${dirPath}`);
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

// Ensure scripts directory exists
ensureDir(path.join(extensionDir, 'scripts'));

// Check if key files exist and create them if needed
function ensureFileExists(filePath, createContent) {
	if (!fs.existsSync(filePath)) {
		console.log(`Creating missing file: ${filePath}`);
		fs.writeFileSync(filePath, createContent());
	}
}

// Ensure the preDeploymentCheck.js exists
const preDeploymentCheckPath = path.join(extensionDir, 'scripts', 'preDeploymentCheck.js');
ensureFileExists(preDeploymentCheckPath, () => `#!/usr/bin/env node

/**
 * Pre-deployment check script for the AI Assistant extension
 */

const fs = require('fs');
const path = require('path');

const extensionPath = path.resolve(__dirname, '..');
console.log(\`Running pre-deployment checks for: \${extensionPath}\`);

let hasErrors = false;

// Check required files
const requiredFiles = [
	'package.json',
	'README.md',
	'CHANGELOG.md',
	'LICENSE',
	'media/icon.png',
	'media/styles.css',
	'media/responsePanel.js'
];

console.log('\\nChecking required files:');
for (const file of requiredFiles) {
	const filePath = path.join(extensionPath, file);
	if (fs.existsSync(filePath)) {
		console.log(\`✓ \${file}\`);
	} else {
		console.error(\`✗ \${file} - MISSING\`);
		hasErrors = true;
	}
}

// Check package.json for required fields
const packageJsonPath = path.join(extensionPath, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('\\nChecking package.json fields:');
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
		console.log(\`✓ \${field}\`);
	} else {
		console.error(\`✗ \${field} - MISSING\`);
		hasErrors = true;
	}
}

// Version format check
const versionPattern = /^\\d+\\.\\d+\\.\\d+$/;
if (packageJson.version && versionPattern.test(packageJson.version)) {
	console.log(\`✓ version format (\${packageJson.version})\`);
} else {
	console.error(\`✗ version format (\${packageJson.version}) - INVALID\`);
	hasErrors = true;
}

if (hasErrors) {
	console.error('\\n❌ Pre-deployment checks failed. Please fix the issues before deploying.');
	process.exit(1);
} else {
	console.log('\\n✅ All pre-deployment checks passed. Ready for deployment.');
	process.exit(0);
}
`);

// Ensure media directory and files exist
const mediaDir = path.join(extensionDir, 'media');
ensureDir(mediaDir);

// Create an icon if missing
const iconPath = path.join(mediaDir, 'icon.png');
if (!fs.existsSync(iconPath)) {
	console.log(`Creating placeholder icon: ${iconPath}`);
	// Creating a very simple PNG file (1x1 pixel)
	const simplePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
	fs.writeFileSync(iconPath, simplePng);
}

// Run npm install if needed
if (!fs.existsSync(path.join(extensionDir, 'node_modules'))) {
	console.log('Node modules not found, running npm install...');
	try {
		execSync('npm install', {
			cwd: extensionDir,
			stdio: 'inherit'
		});
		console.log('Successfully installed dependencies');
	} catch (error) {
		console.error('Error installing dependencies:', error.message);
	}
}

// Try to compile TypeScript files
console.log('Compiling TypeScript files...');
try {
	execSync('npx tsc -p .', {
		cwd: extensionDir,
		stdio: 'inherit'
	});
	console.log('Successfully compiled TypeScript files');
} catch (error) {
	console.error('TypeScript compilation failed, but continuing with fixes');
}

// Create any missing directories that might be needed
ensureDir(path.join(extensionDir, 'out'));
ensureDir(path.join(extensionDir, 'dist'));

// Try to run the deployment script
console.log('Creating a simple VSIX package...');
try {
	execSync('npx vsce package --no-dependencies', {
		cwd: extensionDir,
		stdio: 'inherit'
	});
	console.log('Successfully created VSIX package');
} catch (error) {
	console.error('Error creating VSIX package:', error.message);
	console.log('You may need to manually fix remaining issues');
}

console.log('AI extension fix script completed');
