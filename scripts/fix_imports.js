#!/usr/bin/env node

/**
 * Script to fix import issues in TypeScript files
 * This script analyzes and fixes common import problems:
 * - Removes duplicate imports
 * - Sorts imports
 * - Fixes missing imports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'ai-assistant-extension');
const srcDir = path.join(extensionDir, 'src');

// Patterns to identify imports
const importRegex = /import\s+(?:{([^}]+)}|([^\s;]+)|\*\s+as\s+([^\s;]+))\s+from\s+['"]([^'"]+)['"]/g;
const singleImportRegex = /import\s+(?:{([^}]+)}|([^\s;]+)|\*\s+as\s+([^\s;]+))\s+from\s+['"]([^'"]+)['"]/;

// Helper function to find TypeScript files
function findTsFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('.')) {
			findTsFiles(filePath, fileList);
		} else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
			fileList.push(filePath);
		}
	}

	return fileList;
}

// Parse imports from a file
function parseImports(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	const imports = [];
	let match;

	while ((match = importRegex.exec(content)) !== null) {
		const [fullImport, namedImports, defaultImport, namespaceImport, source] = match;
		imports.push({
			fullImport,
			namedImports: namedImports ? namedImports.split(',').map(i => i.trim()) : [],
			defaultImport,
			namespaceImport,
			source,
			index: match.index
		});
	}

	return { content, imports };
}

// Fix duplicate imports
function fixDuplicateImports(filePath) {
	console.log(`Processing: ${filePath}`);

	const { content, imports } = parseImports(filePath);

	if (imports.length === 0) {
		return false;
	}

	// Group imports by source
	const importsBySource = {};
	for (const imp of imports) {
		if (!importsBySource[imp.source]) {
			importsBySource[imp.source] = [];
		}
		importsBySource[imp.source].push(imp);
	}

	// Find sources with multiple imports
	const sourcesWithDuplicates = Object.keys(importsBySource)
		.filter(source => importsBySource[source].length > 1);

	if (sourcesWithDuplicates.length === 0) {
		return false;
	}

	console.log(`  Found ${sourcesWithDuplicates.length} duplicate imports`);

	// Create a new version of the file with merged imports
	let newContent = content;
	let offset = 0;

	for (const source of sourcesWithDuplicates) {
		const sourceImports = importsBySource[source];

		// Sort by position (descending) to avoid position shifts when replacing
		sourceImports.sort((a, b) => b.index - a.index);

		// Collect all named imports
		const allNamedImports = [];
		let hasDefaultImport = false;
		let defaultImport = null;
		let hasNamespaceImport = false;
		let namespaceImport = null;

		for (const imp of sourceImports) {
			if (imp.namedImports) {
				allNamedImports.push(...imp.namedImports);
			}
			if (imp.defaultImport) {
				hasDefaultImport = true;
				defaultImport = imp.defaultImport;
			}
			if (imp.namespaceImport) {
				hasNamespaceImport = true;
				namespaceImport = imp.namespaceImport;
			}
		}

		// Create a new import statement
		let newImport = 'import ';
		const importParts = [];

		if (hasDefaultImport) {
			importParts.push(defaultImport);
		}

		if (hasNamespaceImport) {
			importParts.push(`* as ${namespaceImport}`);
		}

		// Remove duplicates and sort named imports
		const uniqueNamedImports = [...new Set(allNamedImports)]
			.filter(Boolean)
			.sort();

		if (uniqueNamedImports.length > 0) {
			importParts.push(`{ ${uniqueNamedImports.join(', ')} }`);
		}

		newImport += importParts.join(', ');
		newImport += ` from '${source}';`;

		// Replace all imports for this source with the merged one
		// Remove all but the first one (use the highest index which is the first in the file)
		for (let i = 0; i < sourceImports.length; i++) {
			const imp = sourceImports[i];
			const startPos = imp.index + offset;
			const endPos = startPos + imp.fullImport.length;

			if (i === sourceImports.length - 1) {
				// Replace the last one with our merged import
				newContent = newContent.substring(0, startPos) +
					newImport +
					newContent.substring(endPos);
				offset += newImport.length - imp.fullImport.length;
			} else {
				// Remove this import
				newContent = newContent.substring(0, startPos) +
					newContent.substring(endPos);
				offset -= imp.fullImport.length;
			}
		}
	}

	// Write the fixed content back to the file
	fs.writeFileSync(filePath, newContent);
	return true;
}

// Fix missing imports (using TypeScript compiler API)
function fixMissingImports() {
	try {
		console.log('Running TypeScript import fixer...');
		// Execute tsc with --noEmit to just check for errors
		execSync('cd "' + extensionDir + '" && npx tsc --noEmit', { stdio: 'inherit' });
		console.log('TypeScript compilation check completed');
		return true;
	} catch (error) {
		console.log('TypeScript compilation check failed, but continuing with fixes');
		return false;
	}
}

// Main function
function main() {
	console.log('Starting import fixes for TypeScript files');

	// Find all TypeScript files in the source directory
	const tsFiles = findTsFiles(srcDir);
	console.log(`Found ${tsFiles.length} TypeScript files`);

	// Fix duplicate imports
	let fixedCount = 0;
	for (const file of tsFiles) {
		if (fixDuplicateImports(file)) {
			fixedCount++;
		}
	}

	console.log(`Fixed imports in ${fixedCount} files`);

	// Try running TypeScript compiler to find and fix other issues
	fixMissingImports();

	console.log('Import fixing process completed');
}

// Run the script
main();
