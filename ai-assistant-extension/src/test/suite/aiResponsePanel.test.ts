import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { AIResponsePanel } from '../../ui/aiResponsePanel';
import { WebviewManager } from '../../ui/webviewManager';
import { Logger } from '../../utils/logger';

suite('AIResponsePanel Test Suite', () => {
	let aiResponsePanel: AIResponsePanel;
	let webviewManager: WebviewManager;
	let logger: Logger;
	let context: vscode.ExtensionContext;
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();

		// Mock logger
		logger = {
			info: sandbox.stub(),
			error: sandbox.stub(),
			warn: sandbox.stub(),
			debug: sandbox.stub()
		} as any;

		// Mock webview manager
		webviewManager = {
			createOrShowWebview: sandbox.stub().returns({
				webview: {
					postMessage: sandbox.stub(),
					onDidReceiveMessage: sandbox.stub()
				},
				onDidDispose: sandbox.stub(),
				dispose: sandbox.stub(),
				title: '',
				reveal: sandbox.stub()
			}),
			getWebviewUri: sandbox.stub().returns(vscode.Uri.parse('mock://uri')),
			cspSource: 'mock-source:'
		} as any;

		// Mock extension context
		context = {
			extensionUri: vscode.Uri.parse('mock://extension'),
			subscriptions: []
		} as any;

		// Create instance of the panel
		aiResponsePanel = new AIResponsePanel(context, webviewManager, logger);
	});

	teardown(() => {
		sandbox.restore();
	});

	test('showResponse should create a webview panel', async () => {
		// Setup response generator mock
		const responseGenerator = sandbox.stub().resolves({ content: 'Test content' });
		const updateCallbackSpy = sandbox.spy();
		responseGenerator.callsFake(async (callback: any) => {
			updateCallbackSpy(callback);
			callback('Test content');
			return { content: 'Test content' };
		});

		// Call the method
		const panel = await aiResponsePanel.showResponse('test-id', 'Test Title', responseGenerator);

		// Verify webview was created
		assert.strictEqual(
			(webviewManager.createOrShowWebview as sinon.SinonStub).calledOnce,
			true,
			'createOrShowWebview should be called once'
		);

		// Verify response generator was called
		assert.strictEqual(responseGenerator.calledOnce, true, 'responseGenerator should be called once');

		// Verify update callback was passed to generator
		assert.strictEqual(updateCallbackSpy.calledOnce, true, 'update callback should be passed to generator');

		// Verify panel was returned
		assert.ok(panel, 'Panel should be returned');
	});

	test('formatContent should escape HTML characters', () => {
		const input = '<div>Test & content</div>';
		const expected = '&lt;div&gt;Test & content&lt;/div&gt;';

		const result = aiResponsePanel.formatContent(input);

		assert.strictEqual(result, expected);
	});

	test('createStandalonePanel should create a panel with initial content', () => {
		// Call the method
		const panel = aiResponsePanel.createStandalonePanel('Test Panel', 'Initial content');

		// Verify webview was created
		assert.strictEqual(
			(webviewManager.createOrShowWebview as sinon.SinonStub).calledOnce,
			true,
			'createOrShowWebview should be called once'
		);

		// Verify panel was returned
		assert.ok(panel, 'Panel should be returned');

		// Verify content was set
		const postMessageStub = panel.webview.postMessage as sinon.SinonStub;
		assert.strictEqual(postMessageStub.calledOnce, true, 'postMessage should be called once');
		assert.deepStrictEqual(
			postMessageStub.firstCall.args[0],
			{ type: 'append', content: 'Initial content' },
			'Initial content should be set'
		);
	});
});
