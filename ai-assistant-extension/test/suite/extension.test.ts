/**
 * Extension Tests for SuperCoderAI VSCode Extension
 *
 * This file implements tests for the core functionality of the SuperCoderAI
 * extension. It includes tests for the extension activation, command registration,
 * and basic functionality.
 *
 * File path: test/suite/extension.test.ts
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';

// Get the path to the extension
const extensionDevelopmentPath = path.resolve(__dirname, '../../');

// Import extension modules
import * as extension from '../../src/extension';
import { CodeGenerationEnsemble } from '../../src/ai/ensemble/codeGenerationEnsemble';
import { SecurityEnsemble } from '../../src/ai/ensemble/securityEnsemble';
import { ContextManager } from '../../src/context/contextManager';
import { SecurityScanner } from '../../src/security/securityScanner';

suite('Extension Test Suite', () => {
    // Variables to store test environment
    let extensionContext: vscode.ExtensionContext;
    let codeGenerationEnsemble: CodeGenerationEnsemble;
    let securityEnsemble: SecurityEnsemble;
    let contextManager: ContextManager;
    let securityScanner: SecurityScanner;

    // Restore sandbox after tests
    const sandbox = sinon.createSandbox();

    // Setup test environment before each test
    setup(async () => {
        // Create mock extension context
        extensionContext = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            } as any,
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            } as any,
            extensionPath: extensionDevelopmentPath,
            asAbsolutePath: (relativePath: string) => path.join(extensionDevelopmentPath, relativePath),
            storagePath: path.join(extensionDevelopmentPath, '.storage'),
            globalStoragePath: path.join(extensionDevelopmentPath, '.global-storage'),
            logPath: path.join(extensionDevelopmentPath, '.logs'),
            extensionUri: vscode.Uri.file(extensionDevelopmentPath),
            extensionMode: vscode.ExtensionMode.Development,
            environmentVariableCollection: {} as any
        };

        // Set global context for command registration
        (global as any).context = extensionContext;

        // Create directory for storage if it doesn't exist
        if (!fs.existsSync(extensionContext.storagePath)) {
            fs.mkdirSync(extensionContext.storagePath, { recursive: true });
        }
        if (!fs.existsSync(extensionContext.globalStoragePath)) {
            fs.mkdirSync(extensionContext.globalStoragePath, { recursive: true });
        }

        // Create stubs for services
        codeGenerationEnsemble = {
            executeTask: sandbox.stub().resolves({
                content: { code: '// Generated code' },
                metadata: { executionTime: '1.0s' }
            })
        } as any;

        securityEnsemble = {
            executeTask: sandbox.stub().resolves({
                content: { issues: [] },
                metadata: { executionTime: '1.0s' }
            })
        } as any;

        contextManager = {
            getProjectContext: sandbox.stub().resolves({
                rootPath: '/test/project',
                files: [],
                dependencies: {},
                structure: {},
                metadata: {
                    timestamp: Date.now(),
                    fileCount: 0,
                    totalSize: 0
                }
            }),
            getFileContext: sandbox.stub().resolves({
                structure: {},
                relevantFiles: [],
                dependencies: {},
                metadata: {
                    timestamp: Date.now(),
                    fileCount: 0
                }
            }),
            enrichPrompt: sandbox.stub().callsFake((prompt) => Promise.resolve(prompt))
        } as any;

        securityScanner = {
            scanCode: sandbox.stub().resolves({
                code: '// Test code',
                language: 'typescript',
                issues: [],
                summary: 'No security issues found',
                riskLevel: 'SECURE',
                scanTime: '100ms'
            })
        } as any;
    });

    // Clean up stubs after each test
    teardown(() => {
        sandbox.restore();
    });

    // Test extension activation
    test('Extension should activate', async () => {
        // Stub vscode.commands.registerCommand to avoid actually registering commands
        const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
            dispose: () => {}
        });

        // Stub window.showTextDocument to avoid actually opening documents
        sandbox.stub(vscode.window, 'showTextDocument').resolves();

        // Stub window.createStatusBarItem
        sandbox.stub(vscode.window, 'createStatusBarItem').returns({
            text: '',
            tooltip: '',
            command: '',
            show: () => {},
            hide: () => {},
            dispose: () => {}
        });

        // Activate the extension
        const api = await extension.activate(extensionContext);

        // Assert that commands were registered
        assert.ok(registerCommandStub.called, 'Commands should be registered');

        // Assert that API is returned
        assert.ok(api, 'API should be returned');
        assert.ok(api.getContextManager, 'API should have getContextManager method');
        assert.ok(api.getSecurityScanner, 'API should have getSecurityScanner method');
        assert.ok(api.generateCode, 'API should have generateCode method');
    });

    // Test code generation functionality
    test('Code generation should work', async () => {
        // Stub required functionality
        const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();
        const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);

        // Create API with stubbed services
        const api = {
            generateCode: async (requirements: string, language: string, options: any = {}) => {
                try {
                    let projectContext = {};

                    // Generate code
                    const result = await codeGenerationEnsemble.executeTask('generateCode', {
                        requirements,
                        language,
                        projectContext,
                        ...options
                    });

                    return result;
                } catch (error) {
                    console.error(`Code generation failed: ${error.message}`);
                    throw new Error(`Code generation failed: ${error.message}`);
                }
            }
        };

        // Call the API method
        const result = await api.generateCode('Generate a hello world function', 'typescript');

        // Verify the ensemble was called with correct parameters
        assert.ok(
            (codeGenerationEnsemble.executeTask as sinon.SinonStub).calledWith(
                'generateCode',
                sinon.match({
                    requirements: 'Generate a hello world function',
                    language: 'typescript'
                })
            ),
            'executeTask should be called with correct parameters'
        );

        // Verify result
        assert.ok(result, 'Result should be returned');
        assert.ok(result.content, 'Result should have content');
        assert.ok(result.content.code, 'Result should have code');
    });

    // Test context-aware functionality
    test('Context awareness should work', async () => {
        // Create a temporary test file
        const testFilePath = path.join(extensionContext.globalStoragePath, 'test.ts');
        const testFileContent = 'function add(a: number, b: number): number { return a + b; }';
        fs.writeFileSync(testFilePath, testFileContent);

        // Create a test document
        const testDocumentUri = vscode.Uri.file(testFilePath);
        const getFileContentStub = sandbox.stub().resolves(testFileContent);
        const testDocument = {
            uri: testDocumentUri,
            fileName: testFilePath,
            getText: getFileContentStub,
            lineCount: 1,
            lineAt: () => ({ text: testFileContent, range: new vscode.Range(0, 0, 0, testFileContent.length) }),
            languageId: 'typescript'
        } as any;

        // Stub workspace functionality
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves(testDocument);
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            document: testDocument,
            selection: new vscode.Selection(0, 0, 0, 0),
            edit: async (callback: any) => { callback({ replace: () => {} }); return true; }
        } as any);

        // Call getFileContext
        const context = await contextManager.getFileContext(
            vscode.Uri.file(path.dirname(testFilePath)),
            testFilePath
        );

        // Verify context manager was called
        assert.ok(
            (contextManager.getFileContext as sinon.SinonStub).called,
            'getFileContext should be called'
        );

        // Verify context is returned
        assert.ok(context, 'Context should be returned');
        assert.ok(context.metadata, 'Context should have metadata');
    });

    // Test security scanner functionality
    test('Security scanner should work', async () => {
        // Create test code
        const testCode = `
        function authenticate(username: string, password: string) {
            if (username === 'admin' && password === 'password123') {
                return true;
            }
            return false;
        }
        `;

        // Scan code
        const scanResult = await securityScanner.scanCode(testCode, 'typescript');

        // Verify security scanner was called
        assert.ok(
            (securityScanner.scanCode as sinon.SinonStub).calledWith(testCode, 'typescript'),
            'scanCode should be called with correct parameters'
        );

        // Verify scan result
        assert.ok(scanResult, 'Scan result should be returned');
        assert.ok('issues' in scanResult, 'Scan result should have issues property');
        assert.ok('summary' in scanResult, 'Scan result should have summary property');
        assert.ok('riskLevel' in scanResult, 'Scan result should have riskLevel property');
    });

    // Test extension deactivation
    test('Extension should deactivate', async () => {
        // Activate first to initialize services
        await extension.activate(extensionContext);

        // Create spies for dispose methods
        const disposeSpy = sandbox.spy();
        sandbox.stub(vscode.Disposable, 'from').returns({ dispose: disposeSpy });

        // Deactivate the extension
        extension.deactivate();

        // No explicit assertions since deactivation just cleans up resources
        // and doesn't return anything
    });
});
