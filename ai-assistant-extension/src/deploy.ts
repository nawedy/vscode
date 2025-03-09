import * as path from 'path';
import { DeploymentHelper } from './deployment';
import { Logger } from './utils/logger';

/**
 * Main deployment script for the extension
 */
async function deploy(): Promise<void> {
	const logger = new Logger('deployment');
	logger.info('Starting deployment process');

	try {
		const extensionPath = path.resolve(__dirname, '..');
		logger.info(`Extension path: ${extensionPath}`);

		// Create deployment helper
		const deploymentHelper = new DeploymentHelper(logger, extensionPath);

		// Prepare for deployment
		logger.info('Preparing for deployment...');
		const prepared = await deploymentHelper.prepareForDeployment();

		if (!prepared) {
			logger.error('Deployment preparation failed');
			process.exit(1);
		}

		// Check if we should deploy to marketplace
		const shouldPublish = process.argv.includes('--publish');

		if (shouldPublish) {
			// Deploy to marketplace
			logger.info('Deploying to VS Code Marketplace...');
			const deployed = await deploymentHelper.deployToMarketplace();

			if (!deployed) {
				logger.error('Deployment to marketplace failed');
				process.exit(1);
			}

			logger.info('✅ Extension successfully deployed to VS Code Marketplace');
		} else {
			logger.info('✅ Extension successfully packaged and ready for deployment');
			logger.info('To publish to marketplace, run: npm run deploy -- --publish');
		}
	} catch (error) {
		logger.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

// Run the deployment
deploy().catch(error => {
	console.error(`Fatal deployment error: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});

class Deploy {
	runDeployment() {
		// Implementation for running deployment
	}
}
