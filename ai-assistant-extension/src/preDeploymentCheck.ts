import * as path from 'path';
import { Logger } from './utils/logger';
import { PreDeploymentCheck } from './utils/preDeploymentCheck';

const logger = new Logger('predeployment');

async function main() {
	const extensionPath = path.resolve(__dirname, '..');
	logger.info(`Running pre-deployment checks for: ${extensionPath}`);

	const preDeploymentCheck = new PreDeploymentCheck(logger);
	const success = await preDeploymentCheck.runChecks(extensionPath);

	if (success) {
		logger.info('✅ All pre-deployment checks passed. Ready for deployment.');
		process.exit(0);
	} else {
		logger.error('❌ Pre-deployment checks failed. Please fix the issues before deploying.');
		process.exit(1);
	}
}

main().catch(error => {
	logger.error(`Error during pre-deployment check: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
