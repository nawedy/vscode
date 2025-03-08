#!/usr/bin/env node

/**
 * Version management script for the extension
 * Usage: npm run version [major|minor|patch]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read version argument
const versionType = process.argv[2] || 'patch';
const allowedTypes = ['major', 'minor', 'patch'];

if (!allowedTypes.includes(versionType)) {
	console.error(`Invalid version type: ${versionType}`);
	console.error(`Allowed values: ${allowedTypes.join(', ')}`);
	process.exit(1);
}

// Read current package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Split version into components
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate new version
let newMajor = major;
let newMinor = minor;
let newPatch = patch;

switch (versionType) {
	case 'major':
		newMajor += 1;
		newMinor = 0;
		newPatch = 0;
		break;
	case 'minor':
		newMinor += 1;
		newPatch = 0;
		break;
	case 'patch':
		newPatch += 1;
		break;
}

const newVersion = `${newMajor}.${newMinor}.${newPatch}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated version: ${currentVersion} -> ${newVersion}`);

// Update changelog.md
try {
	const now = new Date();
	const dateString = now.toISOString().split('T')[0];

	const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
	let changelog = fs.readFileSync(changelogPath, 'utf8');

	// Check if there's an Unreleased section
	if (changelog.includes('## [Unreleased]')) {
		// Replace Unreleased with new version
		changelog = changelog.replace(
			'## [Unreleased]',
			`## [${newVersion}] - ${dateString}\n\n### Added\n\n- New features in version ${newVersion}\n\n## [Unreleased]`
		);
	} else {
		// Add a new version section after the header
		const headerEndPos = changelog.indexOf('\n\n') + 2;
		changelog = changelog.slice(0, headerEndPos) +
			`## [${newVersion}] - ${dateString}\n\n### Added\n\n- New features in version ${newVersion}\n\n` +
			changelog.slice(headerEndPos);
	}

	fs.writeFileSync(changelogPath, changelog);
	console.log(`Updated CHANGELOG.md with version ${newVersion}`);
} catch (error) {
	console.error(`Error updating CHANGELOG.md: ${error.message}`);
}

// Git commit and tag if we're in a git repository
try {
	if (fs.existsSync(path.join(__dirname, '..', '.git'))) {
		// Commit changes
		execSync(`git add package.json CHANGELOG.md`, { stdio: 'inherit' });
		execSync(`git commit -m "Bump version to ${newVersion}"`, { stdio: 'inherit' });

		// Create tag
		execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

		console.log(`Created git commit and tag v${newVersion}`);
	}
} catch (error) {
	console.error(`Error with git operations: ${error.message}`);
}
