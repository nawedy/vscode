#!/usr/bin/env node

/**
 * Script to fix duplicate imports in TypeScript files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Paths to exclude
const excludePaths = [
	'node_modules',
	'out',
	'dist',
	'.vscode-test'
];

// Find all TS files in the project
const findTsFiles = () => {
	return glob.sync('src/**/*.ts', {
		ignore: excludePaths.map(p => `${p}/**/*`)
	});
};

// Parse imports from a file
const parseImports = (content) => {
	const importRegex = /import\s+(?:\*\s+as\s+(\w+)|{\s*([\s\w,]+)\s*}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
	const imports = [];
	let match;

	while ((match = importRegex.exec(content)) !== null) {
		const [fullImport, namespaceImport, namedImports, defaultImport, source] = match;
		imports.push({
			fullImport,
			namespaceImport,
			namedImports: namedImports ? namedImports.trim().split(/\s*,\s*/) : [],
			defaultImport,
			source,
			start: match.index,
			end: match.index + fullImport.length
		});
	}

	return imports;
};

// Find duplicate imports in a file
const findDuplicateImports = (content) => {
	const imports = parseImports(content);
	const importsBySource = {};

	// Group imports by source
	imports.forEach(imp => {
		if (!importsBySource[imp.source]) {
			importsBySource[imp.source] = [];
		}
		importsBySource[imp.source].push(imp);
	});

	// Find sources with multiple imports
	return Object.entries(importsBySource)
		.filter(([_, imps]) => imps.length > 1)
		.map(([source, imps]) => ({ source, imports: imps }));
};

// Fix duplicate imports in a file
const fixDuplicateImports = (filePath) => {
	console.log(`Checking ${filePath}`);

	// Read file content
	const content = fs.readFileSync(filePath, 'utf8');

	// Find duplicates
	const duplicates = findDuplicateImports(content);

	if (duplicates.length === 0) {
		console.log(`  No duplicate imports found`);
		return;
	}

	console.log(`  Found ${duplicates.length} duplicate import sources`);

	// Sort imports by position (descending) to avoid position changes when modifying
	let newContent = content;
	for (const dup of duplicates) {
		console.log(`  - Merging ${dup.imports.length} imports from ${dup.source}`);

		// Sort imports by position (descending)
		const sortedImports = [...dup.imports].sort((a, b) => b.start - a.start);

		// Keep only the first import (last in the file), remove others
		for (let i = 0; i < sortedImports.length - 1; i++) {
			const imp = sortedImports[i];
			newContent = newContent.substring(0, imp.start) + newContent.substring(imp.end);
		}
	}

	// Write fixed content
	fs.writeFileSync(filePath, newContent);
	console.log(`  Updated ${filePath}`);
};

// Process all TypeScript files
const processAllFiles = () => {
	const tsFiles = findTsFiles();
	console.log(`Found ${tsFiles.length} TypeScript files`);

	for (const file of tsFiles) {
		fixDuplicateImports(file);
	}

	console.log('Done processing all files');
};

// Run the script
processAllFiles();
