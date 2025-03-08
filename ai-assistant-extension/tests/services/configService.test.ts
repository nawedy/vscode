import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ConfigService } from '../../src/services/configService';
import { Logger } from '../../src/utils/logger';

suite('ConfigService Tests', () => {
	let configService: ConfigService;
	let mockSecrets: any;
	let mockConfig: any;
	let updateStub: sinon.SinonStub;
	let getConfigStub: sinon.SinonStub;
	let logger: Logger;

	setup(() => {
		// Mock VS Code APIs
		mockSecrets = {
			get: sinon.stub(),
			store: sinon.stub().resolves(),
			delete: sinon.stub().resolves()
		};

		updateStub = sinon.stub().resolves();

		mockConfig = {
			get: sinon.stub(),
			update: updateStub
		};

		getConfigStub = sinon.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

		logger = new Logger('test');

		// Create config service with mocked secrets
		configService = new ConfigService(mockSecrets, logger);
	});

	teardown(() => {
		sinon.restore();
	});

	test('initialize should not throw errors', async () => {
		await assert.doesNotReject(async () => {
			await configService.initialize();
		});
	});

	test('get should retrieve configuration values', () => {
		const expectedValue = 'test-value';
		mockConfig.get.withArgs('testSetting', undefined).returns(expectedValue);

		const result = configService.get('testSetting');

		assert.strictEqual(result, expectedValue);
		assert.strictEqual(getConfigStub.calledOnce, true);
		assert.strictEqual(getConfigStub.firstCall.args[0], 'aiAssistant');
	});

	test('get should return default value if setting not found', () => {
		const defaultValue = 'default-value';
		mockConfig.get.withArgs('nonExistentSetting', defaultValue).returns(defaultValue);

		const result = configService.get('nonExistentSetting', defaultValue);

		assert.strictEqual(result, defaultValue);
	});

	test('getSecret should retrieve secrets', async () => {
		const secretKey = 'test-secret-key';
		const secretValue = 'test-secret-value';
		mockSecrets.get.withArgs(secretKey).resolves(secretValue);

		const result = await configService.getSecret(secretKey);

		assert.strictEqual(result, secretValue);
		assert.strictEqual(mockSecrets.get.calledOnce, true);
		assert.strictEqual(mockSecrets.get.firstCall.args[0], secretKey);
	});

	test('getSecret should handle errors', async () => {
		mockSecrets.get.rejects(new Error('Test error'));

		const result = await configService.getSecret('test-key');

		assert.strictEqual(result, undefined);
	});

	test('setSecret should store secrets', async () => {
		const secretKey = 'test-secret-key';
		const secretValue = 'test-secret-value';

		await configService.setSecret(secretKey, secretValue);

		assert.strictEqual(mockSecrets.store.calledOnce, true);
		assert.strictEqual(mockSecrets.store.firstCall.args[0], secretKey);
		assert.strictEqual(mockSecrets.store.firstCall.args[1], secretValue);
	});

	test('setSecret should propagate errors', async () => {
		const testError = new Error('Test error');
		mockSecrets.store.rejects(testError);

		await assert.rejects(async () => {
			await configService.setSecret('key', 'value');
		}, testError);
	});

	test('deleteSecret should remove secrets', async () => {
		const secretKey = 'test-secret-key';

		await configService.deleteSecret(secretKey);

		assert.strictEqual(mockSecrets.delete.calledOnce, true);
		assert.strictEqual(mockSecrets.delete.firstCall.args[0], secretKey);
	});

	test('update should modify configuration settings', async () => {
		const settingKey = 'testSetting';
		const settingValue = 'new-value';

		await configService.update(settingKey, settingValue);

		assert.strictEqual(updateStub.calledOnce, true);
		assert.strictEqual(updateStub.firstCall.args[0], settingKey);
		assert.strictEqual(updateStub.firstCall.args[1], settingValue);
		assert.strictEqual(updateStub.firstCall.args[2], vscode.ConfigurationTarget.Global);
	});

	test('getProviderIds should return provider IDs', () => {
		const expectedProviders = ['openai', 'anthropic'];
		mockConfig.get.withArgs('providers', []).returns(expectedProviders);

		const result = configService.getProviderIds();

		assert.deepStrictEqual(result, expectedProviders);
	});

	test('reloadConfiguration should not throw errors', async () => {
		await assert.doesNotReject(async () => {
			await configService.reloadConfiguration();
		});
	});
});
