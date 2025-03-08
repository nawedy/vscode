import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { PromptManager } from '../../src/ai/promptManager';
import { Logger } from '../../src/utils/logger';

// Mock extension context
const mockContext = {
	extensionPath: '/mock/extension/path',
	subscriptions: [],
	extensionUri: { fsPath: '/mock/extension/path' } as any,
	// Add other required properties
	workspaceState: {
		get: () => { },
		update: () => Promise.resolve(),
		keys: () => []
	},
	globalState: {
		get: () => { },
		update: () => Promise.resolve(),
		keys: () => []
	},
	secrets: {
		get: () => Promise.resolve(''),
		store: () => Promise.resolve(),
		delete: () => Promise.resolve()
	},
	storageUri: null,
	globalStorageUri: { fsPath: '/mock/global/storage' } as any,
	logUri: { fsPath: '/mock/logs' } as any,
	extensionMode: 1
};

suite('PromptManager Tests', () => {
	let promptManager: PromptManager;
	let logger: Logger;
	let fsReadDirStub: sinon.SinonStub;
	let fsReadFileStub: sinon.SinonStub;
	let fsExistsStub: sinon.SinonStub;
	let fsWriteFileStub: sinon.SinonStub;

	setup(() => {
		// Set up stubs
		logger = new Logger('test');
		fsExistsStub = sinon.stub(fs, 'existsSync').returns(true);
		fsReadDirStub = sinon.stub(fs, 'readdirSync').returns(['codeExplanation.md', 'codeGeneration.md']);
		fsReadFileStub = sinon.stub(fs, 'readFileSync');
		fsWriteFileStub = sinon.stub(fs, 'writeFileSync');

		// Stub template file contents
		fsReadFileStub.withArgs(sinon.match(/codeExplanation\.md$/)).returns('# Code Explanation\n\nExplain the {{language}} code:\n\n```{{language}}\n{{code}}\n```');
		fsReadFileStub.withArgs(sinon.match(/codeGeneration\.md$/)).returns('# Code Generation\n\nGenerate {{language}} code for:\n\n{{description}}');

		// Create prompt manager
		promptManager = new PromptManager(mockContext as any, logger);
	});

	teardown(() => {
		sinon.restore();
	});

	test('loadTemplates should load templates from directory', async () => {
		await promptManager.loadTemplates();

		assert.strictEqual(promptManager.getTemplateNames().length, 2);
		assert.ok(promptManager.getTemplate('codeExplanation'));
		assert.ok(promptManager.getTemplate('codeGeneration'));
	});

	test('loadTemplates should handle missing directory', async () => {
		// Make the directory not exist
		fsExistsStub.returns(false);

		await promptManager.loadTemplates();

		assert.strictEqual(promptManager.getTemplateNames().length, 0);
	});

	test('loadTemplates should handle file read errors', async () => {
		// Make one file throw an error
		fsReadFileStub.withArgs(sinon.match(/codeExplanation\.md$/)).throws(new Error('File read error'));

		await promptManager.loadTemplates();

		// Should still load the other template
		assert.strictEqual(promptManager.getTemplateNames().length, 1);
		assert.strictEqual(promptManager.getTemplate('codeExplanation'), undefined);
		assert.ok(promptManager.getTemplate('codeGeneration'));
	});

	test('getTemplate should return template by name', async () => {
		await promptManager.loadTemplates();

		const template = promptManager.getTemplate('codeExplanation');
		assert.ok(template);
		assert.ok(template.includes('{{language}}'));
		assert.ok(template.includes('{{code}}'));
	});

	test('getTemplate should return undefined for non-existent template', async () => {
		await promptManager.loadTemplates();

		const template = promptManager.getTemplate('nonExistentTemplate');
		assert.strictEqual(template, undefined);
	});

	test('getTemplateNames should return all template names', async () => {
		await promptManager.loadTemplates();

		const templateNames = promptManager.getTemplateNames();
		assert.deepStrictEqual(templateNames.sort(), ['codeExplanation', 'codeGeneration'].sort());
	});

	test('processTemplate should replace variables in template', async () => {
		await promptManager.loadTemplates();

		const variables = {
			language: 'typescript',
			code: 'function test() { return 42; }'
		};

		const processed = promptManager.processTemplate('codeExplanation', variables);

		assert.ok(processed);
		assert.ok(processed.includes('typescript'));
		assert.ok(processed.includes('function test() { return 42; }'));
		assert.ok(!processed.includes('{{language}}'));
		assert.ok(!processed.includes('{{code}}'));
	});

	test('processTemplate should return undefined for non-existent template', async () => {
		await promptManager.loadTemplates();

		const processed = promptManager.processTemplate('nonExistentTemplate', {});
		assert.strictEqual(processed, undefined);
	});

	test('processTemplate should leave unmatched variables', async () => {
		await promptManager.loadTemplates();

		const variables = {
			language: 'typescript',
			// Missing 'code' variable
		};

		const processed = promptManager.processTemplate('codeExplanation', variables);

		assert.ok(processed);
		assert.ok(processed.includes('typescript'));
		assert.ok(processed.includes('{{code}}'));
	});

	test('createTemplate should create a new template file', async () => {
		const templateName = 'testTemplate';
		const content = '# Test Template\n\nTest content';

		const result = await promptManager.createTemplate(templateName, content);

		assert.strictEqual(result, true);
		assert.strictEqual(fsWriteFileStub.calledOnce, true);

		// Check template was added to internal map
		assert.strictEqual(promptManager.getTemplate('testtemplate'), content);
	});

	test('createTemplate should sanitize template names', async () => {
		const templateName = 'Test-Template 123!';
		const content = '# Test Template\n\nTest content';

		await promptManager.createTemplate(templateName, content);

		// Filename should be sanitized
		const writeCall = fsWriteFileStub.firstCall;
		assert.ok(writeCall.args[0].includes('testtemplate123.md'));
	});

	test('createTemplate should handle errors', async () => {
		fsWriteFileStub.throws(new Error('File write error'));

		const result = await promptManager.createTemplate('errorTemplate', 'content');

		assert.strictEqual(result, false);
	});

	test('updateTemplate should update an existing template', async () => {
		await promptManager.loadTemplates();

		const content = '# Updated Code Explanation\n\nNew content';
		const result = await promptManager.updateTemplate('codeExplanation', content);

		assert.strictEqual(result, true);
		assert.strictEqual(fsWriteFileStub.calledOnce, true);

		// Check template was updated in internal map
		assert.strictEqual(promptManager.getTemplate('codeExplanation'), content);
	});

	test('updateTemplate should not update non-existent templates', async () => {
		await promptManager.loadTemplates();

		const result = await promptManager.updateTemplate('nonExistentTemplate', 'content');

		assert.strictEqual(result, false);
		assert.strictEqual(fsWriteFileStub.called, false);
	});

	test('updateTemplate should handle errors', async () => {
		await promptManager.loadTemplates();

		fsWriteFileStub.throws(new Error('File write error'));
		const result = await promptManager.updateTemplate('codeExplanation', 'content');

		assert.strictEqual(result, false);
	});
});
