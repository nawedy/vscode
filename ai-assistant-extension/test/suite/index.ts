/**
 * Test Suite Index for SuperCoderAI VSCode Extension
 *
 * This file implements the test suite runner that discovers and executes all tests.
 *
 * File path: test/suite/index.ts
 */

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
import * as fs from 'fs';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000 // 60 seconds timeout
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        // Find test files
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                return reject(err);
            }

            // If no files found, check if compilation worked
            if (files.length === 0) {
                // Try to find the source TypeScript files
                const tsFiles = glob.sync('**/**.test.ts', { cwd: testsRoot });

                if (tsFiles.length > 0) {
                    console.error('Tests found but not compiled to JavaScript:');
                    tsFiles.forEach(file => console.error(`- ${file}`));
                    return reject(new Error('Test files found but not compiled to JavaScript'));
                } else {
                    console.warn('No test files found');
                }
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    });
}
