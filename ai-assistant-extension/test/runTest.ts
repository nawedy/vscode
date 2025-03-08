/**
 * Test Runner for SuperCoderAI VSCode Extension
 *
 * This file implements the test runner for the VS Code extension tests.
 * It sets up the test environment and runs the tests.
 *
 * File path: test/runTest.ts
 */

import * as path from 'path';
import * as cp from 'child_process';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // The path to the workspace file - this will be used for tests that need a workspace
        const testWorkspacePath = path.resolve(__dirname, '../test-workspace');

        // Create test workspace if it doesn't exist
        cp.execSync(`mkdir -p ${testWorkspacePath}`);

        // Create a test file in the workspace
        cp.execSync(`echo "function test() { return 'test'; }" > ${testWorkspacePath}/test.ts`);

        // Download VS Code, unzip it, and run the integration tests
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [testWorkspacePath]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
