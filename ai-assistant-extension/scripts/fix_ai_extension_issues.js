#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const extensionDir = path.resolve(__dirname, '..');
const srcDir = path.join(extensionDir, 'src');

// Run TypeScript compiler in noEmit mode to find issues
console.log('Checking for TypeScript issues...');
try {
	execSync('tsc --noEmit', { stdio: 'inherit', cwd: extensionDir });
} catch (error) {
	console.log('TypeScript compilation check failed');
}

// Fix common type issues
function fixTypeIssues(filePath) {
	let content = fs.readFileSync(filePath, 'utf8');

	// Fix 'any' types
	content = content.replace(/: any([,}\)])/g, ': unknown$1');
	content = content.replace(/: any\[\]/g, ': unknown[]');

	// Fix missing type imports
	content = content.replace(
		/import {([^}]*)}/g,
		(match, imports) => {
			// Add common missing types
			if (imports.includes('vscode') && !imports.includes('Disposable')) {
				imports += ', Disposable';
			}
			return `import {${imports}}`;
		}
	);

	// Fix missing return types
	content = content.replace(
		/async (\w+)\((.*?)\)(?! *:)/g,
		'async $1($2): Promise<void>'
	);

	fs.writeFileSync(filePath, content);
}

// Process all TypeScript files
function processDirectory(dir) {
	const files = fs.readdirSync(dir);

	files.forEach(file => {
		const fullPath = path.join(dir, file);
		if (fs.statSync(fullPath).isDirectory()) {
			processDirectory(fullPath);
		} else if (file.endsWith('.ts')) {
			console.log(`Processing ${fullPath}`);
			fixTypeIssues(fullPath);
		}
	});
}

processDirectory(srcDir);
console.log('Finished processing files');
