#!/usr/bin/env node

/**
 * Changelog management script for the extension
 * Usage: npm run changelog [feature|fix|docs|refactor] "Your change description"
 */

const fs = require('fs');
const path = require('path');

// Read arguments
const changeType = process.argv[2] || 'feature';
const description = process.argv[3] || null;

if (!description) {
	console.error('Please provide a change description');
	console.error('Usage: npm run changelog [feature|fix|docs|refactor] "Your change description"');
	process.exit(1);
}

// Map change type to section
const typeToSection = {
	'feature': 'Added',
	'fix': 'Fixed',
	'docs': 'Documentation',
	'refactor': 'Changed'
};

const section = typeToSection[changeType] || 'Added';

// Read current CHANGELOG.md
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf8');

// Check for Unreleased section
if (!changelog.includes('## [Unreleased]')) {
	// Add Unreleased section
	const headerEndPos = changelog.indexOf('\n\n') + 2;
	changelog = changelog.slice(0, headerEndPos) +
		`## [Unreleased]\n\n` +
		changelog.slice(headerEndPos);
}

// Find the correct position to add the entry
let sectionPos = changelog.indexOf(`### ${section}`, changelog.indexOf('## [Unreleased]'));

if (sectionPos === -1) {
	// Section doesn't exist, add it
	const unreleasedPos = changelog.indexOf('## [Unreleased]');
	const nextSectionPos = changelog.indexOf('###', unreleasedPos);

	if (nextSectionPos === -1) {
		// No other sections, add after Unreleased
		const insertPos = changelog.indexOf('\n\n', unreleasedPos) + 2;
		changelog = changelog.slice(0, insertPos) +
			`### ${section}\n\n- ${description}\n\n` +
			changelog.slice(insertPos);
	} else {
		// Add before other section
		changelog = changelog.slice(0, nextSectionPos) +
			`### ${section}\n\n- ${description}\n\n` +
			changelog.slice(nextSectionPos);
	}
} else {
	// Section exists, add entry
	const insertPos = changelog.indexOf('\n', sectionPos) + 1;
	changelog = changelog.slice(0, insertPos) +
		`- ${description}\n` +
		changelog.slice(insertPos);
}

// Write back to file
fs.writeFileSync(changelogPath, changelog);
console.log(`Added "${description}" to ${section} section in CHANGELOG.md`);

function updateChangelog() {
	// Implementation for updating changelog
}
