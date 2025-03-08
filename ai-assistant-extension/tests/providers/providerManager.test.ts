import * as assert from 'assert';
import * as sinon from 'sinon';
import { ProviderManager } from '../../src/ai/providerManager';
import { ModelCapability } from '../../src/ai/providers/baseProvider';
import { Logger } from '../../src/utils/logger';

// Mock configuration service
class MockConfigService {
	private secrets: Map<string, string> = new Map();
	private settings: Map<string, any> = new Map();

	async getSecret(key: string): Promise<string | undefined> {
		return this.secrets.get(key);
	}

	async setSecret(key: string, value: string): Promise<void> {
		this.secrets.set(key, value);
	}

	get<T>(key: string, defaultValue?: T): T {
		return this.settings.get(key) ?? defaultValue as T;
	}

	async update(key: string, value: any): Promise<void> {
		this.settings.set(key, value);
	}

	// Set up test data
	setupMockData() {
		// API keys for testing
		this.secrets.set('openai.apiKey', 'test-openai-key');
		this.secrets.set('anthropic.apiKey', 'test-anthropic-key');
		this.secrets.set('mistral.apiKey', 'test-mistral-key');

		// Provider configurations
		this.settings.set('providers.openai.defaultModel', 'gpt-3.5-turbo');
		this.settings.set('providers.anthropic.defaultModel', 'claude-2');
		this.settings.set('providers.mistral.defaultModel', 'mistral-medium');

		// Default provider
		this.settings.set('defaultProvider', 'openai');
	}
}

// Mock provider
class MockProvider {
	public id: string;
	public name: string;
	private _isReady = false;
	public capabilities: ModelCapability[] = [];

	constructor(id: string, name: string, capabilities: ModelCapability[] = []) {
		this.id = id;
		this.name = name;
		this.capabilities = capabilities;
	}

	async initialize(): Promise<boolean> {
		this._isReady = true;
		return true;
	}

	isReady(): boolean {
		return this._isReady;
	}

	async getDefaultModelForCapability(capability: ModelCapability): Promise<string | null> {
		return this.capabilities.includes(capability) ? `${this.id}-model` : null;
	}

	dispose(): void {
		this._isReady = false;
	}
}

describe('Provider Manager Integration Tests', function () {
	let configService: MockConfigService;
	let logger: Logger;
	let providerManager: ProviderManager;

	// Mock providers
	let openAIProviderStub: sinon.SinonStub;
	let anthropicProviderStub: sinon.SinonStub;
	let mistralProviderStub: sinon.SinonStub;
	let qwenProviderStub: sinon.SinonStub;

	let mockOpenAI: MockProvider;
	let mockAnthropic: MockProvider;
	let mockMistral: MockProvider;

	beforeEach(() => {
		// Set up mocks and stubs
		configService = new MockConfigService();
		configService.setupMockData();
		logger = new Logger('test');

		// Create mock providers with different capabilities
		mockOpenAI = new MockProvider('openai', 'OpenAI', [
			ModelCapability.ChatCompletion,
			ModelCapability.CodeCompletion,
			ModelCapability.CodeGeneration
		]);

		mockAnthropic = new MockProvider('anthropic', 'Anthropic', [
			ModelCapability.ChatCompletion,
			ModelCapability.Explanation,
			ModelCapability.Summarization
		]);

		mockMistral = new MockProvider('mistral', 'Mistral', [
			ModelCapability.ChatCompletion,
			ModelCapability.Refactoring
		]);

		// Stub provider constructors and initialization
		openAIProviderStub = sinon.stub().returns(mockOpenAI);
		anthropicProviderStub = sinon.stub().returns(mockAnthropic);
		mistralProviderStub = sinon.stub().returns(mockMistral);
		qwenProviderStub = sinon.stub().returns({
			id: 'qwen',
			name: 'Qwen',
			initialize: sinon.stub().resolves(false), // This one fails to initialize
			isReady: sinon.stub().returns(false),
			capabilities: []
		});
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('Initialization', () => {
		it('should initialize available providers', async () => {
			// Create provider manager
			providerManager = new ProviderManager(configService as any, logger);

			// Override the provider initialization to use our mocks
			// @ts-ignore - accessing private method for testing
			providerManager.initializeProvider = async (provider: any) => {
				if (provider.id === 'openai' || provider.id === 'anthropic' || provider.id === 'mistral') {
					await provider.initialize();
					return true;
				}
				return false;
			};

			await providerManager.initialize();

			const availableProviders = providerManager.getAvailableProviders();
			assert.strictEqual(availableProviders.length, 3);

			const providerIds = availableProviders.map(p => p.id);
			assert.ok(providerIds.includes('openai'));
			assert.ok(providerIds.includes('anthropic'));
			assert.ok(providerIds.includes('mistral'));
		});

		it('should set active provider from config', async () => {
			// Create provider manager
			providerManager = new ProviderManager(configService as any, logger);

			// Override the provider initialization to use our mocks
			// @ts-ignore - accessing private method for testing
			providerManager.initializeProvider = async (provider: any) => {
				if (provider.id === 'openai' || provider.id === 'anthropic' || provider.id === 'mistral') {
					await provider.initialize();
					return true;
				}
				return false;
			};

			await providerManager.initialize();

			const activeProvider = providerManager.getActiveProvider();
			assert.strictEqual(activeProvider?.id, 'openai');
		});
	});

	describe('Provider Selection', () => {
		beforeEach(async () => {
			// Create provider manager
			providerManager = new ProviderManager(configService as any, logger);

			// Override the provider initialization to use our mocks
			// @ts-ignore - accessing private method for testing
			providerManager.initializeProvider = async (provider: any) => {
				if (provider.id === 'openai' || provider.id === 'anthropic' || provider.id === 'mistral') {
					await provider.initialize();
					return true;
				}
				return false;
			};

			await providerManager.initialize();
		});

		it('should change active provider', async () => {
			const initialProvider = providerManager.getActiveProvider();
			assert.strictEqual(initialProvider?.id, 'openai');

			await providerManager.setActiveProvider('anthropic');

			const newActiveProvider = providerManager.getActiveProvider();
			assert.strictEqual(newActiveProvider?.id, 'anthropic');
		});

		it('should select provider by capability', async () => {
			// Get provider for code generation (only OpenAI has this)
			const codeGenProvider = await providerManager.getProviderForCapability(ModelCapability.CodeGeneration);
			assert.strictEqual(codeGenProvider?.id, 'openai');

			// Get provider for explanation (only Anthropic has this)
			const explainProvider = await providerManager.getProviderForCapability(ModelCapability.Explanation);
			assert.strictEqual(explainProvider?.id, 'anthropic');

			// Get provider for refactoring (only Mistral has this)
			const refactorProvider = await providerManager.getProviderForCapability(ModelCapability.Refactoring);
			assert.strictEqual(refactorProvider?.id, 'mistral');
		});

		it('should prefer active provider for capability if available', async () => {
			// Set active provider to anthropic
			await providerManager.setActiveProvider('anthropic');

			// Get provider for chat completion (all have this, but should prefer active)
			const chatProvider = await providerManager.getProviderForCapability(ModelCapability.ChatCompletion);
			assert.strictEqual(chatProvider?.id, 'anthropic');

			// Change active provider to mistral
			await providerManager.setActiveProvider('mistral');

			// Should now prefer mistral for chat completion
			const newChatProvider = await providerManager.getProviderForCapability(ModelCapability.ChatCompletion);
			assert.strictEqual(newChatProvider?.id, 'mistral');
		});

		it('should return null for unsupported capabilities', async () => {
			// No provider supports agent capability
			const agentProvider = await providerManager.getProviderForCapability(ModelCapability.Agent);
			assert.strictEqual(agentProvider, null);
		});
	});

	describe('Provider Listing', () => {
		beforeEach(async () => {
			// Create provider manager
			providerManager = new ProviderManager(configService as any, logger);

			// Override the provider initialization to use our mocks
			// @ts-ignore - accessing private method for testing
			providerManager.initializeProvider = async (provider: any) => {
				if (provider.id === 'openai' || provider.id === 'anthropic' || provider.id === 'mistral') {
					await provider.initialize();
					return true;
				}
				return false;
			};

			await providerManager.initialize();
		});

		it('should list all available providers', () => {
			const providers = providerManager.getAvailableProviders();
			assert.strictEqual(providers.length, 3);

			const names = providers.map(p => p.name);
			assert.deepStrictEqual(names.sort(), ['Anthropic', 'Mistral', 'OpenAI'].sort());
		});

		it('should get provider by ID', () => {
			const openai = providerManager.getProviderById('openai');
			assert.strictEqual(openai?.name, 'OpenAI');

			const anthropic = providerManager.getProviderById('anthropic');
			assert.strictEqual(anthropic?.name, 'Anthropic');

			const nonExistent = providerManager.getProviderById('non-existent');
			assert.strictEqual(nonExistent, null);
		});

		it('should check if a provider is available', () => {
			assert.strictEqual(providerManager.isProviderAvailable('openai'), true);
			assert.strictEqual(providerManager.isProviderAvailable('non-existent'), false);
		});

		it('should get models for a capability', async () => {
			const chatModels = await providerManager.getModelsForCapability(ModelCapability.ChatCompletion);
			assert.strictEqual(chatModels.length, 3); // All three providers support chat

			const codeGenModels = await providerManager.getModelsForCapability(ModelCapability.CodeGeneration);
			assert.strictEqual(codeGenModels.length, 1);
			assert.strictEqual(codeGenModels[0].provider.id, 'openai');

			const agentModels = await providerManager.getModelsForCapability(ModelCapability.Agent);
			assert.strictEqual(agentModels.length, 0); // No provider supports agent capability
		});
	});

	describe('Cleanup', () => {
		beforeEach(async () => {
			// Create provider manager
			providerManager = new ProviderManager(configService as any, logger);

			// Override the provider initialization to use our mocks
			// @ts-ignore - accessing private method for testing
			providerManager.initializeProvider = async (provider: any) => {
				if (provider.id === 'openai' || provider.id === 'anthropic' || provider.id === 'mistral') {
					await provider.initialize();
					return true;
				}
				return false;
			};

			await providerManager.initialize();
		});

		it('should dispose all providers', () => {
			// Spy on dispose methods
			const openaiSpy = sinon.spy(mockOpenAI, 'dispose');
			const anthropicSpy = sinon.spy(mockAnthropic, 'dispose');
			const mistralSpy = sinon.spy(mockMistral, 'dispose');

			providerManager.dispose();

			assert.strictEqual(openaiSpy.called, true);
			assert.strictEqual(anthropicSpy.called, true);
			assert.strictEqual(mistralSpy.called, true);

			// After dispose, should have no providers available
			assert.strictEqual(providerManager.getAvailableProviders().length, 0);
			assert.strictEqual(providerManager.getActiveProvider(), null);
		});
	});
});
