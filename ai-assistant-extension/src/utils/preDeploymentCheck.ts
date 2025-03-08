import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Handles pre-deployment checks for the extension
 */
export class PreDeploymentCheck {
	private readonly logger: Logger;

	/**
	 * Creates a new pre-deployment check utility
	 * @param logger Logger instance
	 */
	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Run all pre-deployment checks
	 * @param extensionPath Path to the extension root
	 * @returns Promise that resolves to true if all checks passed
	 */
	public async runChecks(extensionPath: string): Promise<boolean> {
		try {
			this.logger.info('Running pre-deployment checks');

			// Check required files
			const requiredFiles = this.checkRequiredFiles(extensionPath);
			if (!requiredFiles) {
				return false;
			}

			// Check package.json for required fields
			const packageJsonCheck = this.checkPackageJson(extensionPath);
			if (!packageJsonCheck) {
				return false;
			}

			// Check README
			const readmeCheck = this.checkReadme(extensionPath);
			if (!readmeCheck) {
				return false;
			}

			// Media files check
			const mediaCheck = this.checkMediaFiles(extensionPath);
			if (!mediaCheck) {
				return false;
			}

			// All checks passed
			this.logger.info('All pre-deployment checks passed successfully');
			return true;
		} catch (error) {
			this.logger.error(`Error during pre-deployment checks: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Check that all required files exist
	 * @param extensionPath Path to the extension root
	 * @returns true if all required files exist
	 */
	private checkRequiredFiles(extensionPath: string): boolean {
		const requiredFiles = [
			'package.json',
			'README.md',
			'CHANGELOG.md',
			'LICENSE',
			'src/extension.ts',
			'media/styles.css',
			'media/responsePanel.js'
		];

		const missingFiles = requiredFiles.filter(file => {
			const filePath = path.join(extensionPath, file);
			return !fs.existsSync(filePath);
		});

		if (missingFiles.length > 0) {
			this.logger.error(`Missing required files: ${missingFiles.join(', ')}`);
			return false;
		}

		return true;
	}

	/**
	 * Validate package.json for required fields
	 * @param extensionPath Path to the extension root
	 * @returns true if package.json has all required fields
	 */
	private checkPackageJson(extensionPath: string): boolean {
		const packageJsonPath = path.join(extensionPath, 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

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

		const missingFields = requiredFields.filter(field => !packageJson[field]);
		if (missingFields.length > 0) {
			this.logger.error(`Missing required fields in package.json: ${missingFields.join(', ')}`);
			return false;
		}

		// Check version format
		const versionPattern = /^\d+\.\d+\.\d+$/;
		if (!versionPattern.test(packageJson.version)) {
			this.logger.error(`Invalid version format: ${packageJson.version}`);
			return false;
		}

		// Check commands
		if (!packageJson.contributes?.commands || packageJson.contributes.commands.length === 0) {
			this.logger.error('No commands defined in package.json');
			return false;
		}

		return true;
	}

	/**
	 * Check README.md for required sections
	 * @param extensionPath Path to the extension root
	 * @returns true if README has required sections
	 */
	private checkReadme(extensionPath: string): boolean {
		const readmePath = path.join(extensionPath, 'README.md');
		const readmeContent = fs.readFileSync(readmePath, 'utf8');

		const requiredSections = [
			'# ', // Heading
			'## Features',
			'## Requirements',
			'## Installation',
			'## Usage'
		];

		const missingSections = requiredSections.filter(section => !readmeContent.includes(section));
		if (missingSections.length > 0) {
			this.logger.error(`Missing required sections in README.md: ${missingSections.join(', ')}`);
			return false;
		}

		return true;
	}

	/**
	 * Check for required media files
	 * @param extensionPath Path to the extension root
	 * @returns true if all required media files exist
	 */
	private checkMediaFiles(extensionPath: string): boolean {
		const mediaPath = path.join(extensionPath, 'media');
		if (!fs.existsSync(mediaPath)) {
			this.logger.error('Media directory does not exist');
			return false;
		}

		const requiredFiles = ['styles.css', 'responsePanel.js'];
		const missingFiles = requiredFiles.filter(file => {
			return !fs.existsSync(path.join(mediaPath, file));
		});

		if (missingFiles.length > 0) {
			this.logger.error(`Missing required media files: ${missingFiles.join(', ')}`);
			return false;
		}

		return true;
	}
}
