import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { ConfigManager } from '../config/ConfigManager.js';
import { fetchModels, type ModelInfo } from '../llm/OpenAIClient.js';

// Simple animated loading dots (no Spinner dependency)
const LoadingDots: React.FC<{ text: string }> = ({ text }) => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(iv);
  }, []);
  return <Text color="cyan">{text}{dots}</Text>;
};

// ---------------------------------------------------------------------------
// Provider presets
// ---------------------------------------------------------------------------

interface ProviderPreset {
  label: string;
  value: string;
  baseUrl: string;
  model: string;
  fetchModels: boolean;
}

const PROVIDERS: ProviderPreset[] = [
  { label: 'OpenAI', value: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', fetchModels: true },
  { label: 'DeepSeek', value: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', fetchModels: true },
  { label: 'Moonshot (Kimi)', value: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-auto', fetchModels: true },
  { label: 'Zhipu (GLM)', value: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', fetchModels: true },
  { label: 'Qwen (Tongyi)', value: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', fetchModels: true },
  { label: 'OpenRouter', value: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', fetchModels: true },
  { label: 'Custom (OpenAI Compatible)', value: 'custom', baseUrl: '', model: '', fetchModels: true },
];

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------

type Step = 'provider' | 'api-key' | 'base-url' | 'fetching-models' | 'select-model' | 'confirm';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ConfigWizard: React.FC = () => {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<ProviderPreset | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch models when entering the fetching step
  useEffect(() => {
    if (step !== 'fetching-models') return;

    let cancelled = false;

    (async () => {
      try {
        const list = await fetchModels(apiKey, baseUrl);
        if (cancelled) return;
        if (list.length === 0) {
          setFetchError('No models found. You can enter the model name manually.');
          setStep('select-model');
          return;
        }
        setModels(list);
        setStep('select-model');
      } catch (err: any) {
        if (cancelled) return;
        setFetchError(`Could not fetch models: ${err.message}. You can enter the model name manually.`);
        setStep('select-model');
      }
    })();

    return () => { cancelled = true; };
  }, [step]);

  // --- Handlers ---

  const handleProviderSelect = (item: { value: string }) => {
    const preset = PROVIDERS.find(p => p.value === item.value)!;
    setProvider(preset);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setStep('api-key');
  };

  const handleApiKeySubmit = (value: string) => {
    setApiKey(value);
    if (provider?.value === 'custom') {
      setStep('base-url');
    } else {
      setStep('fetching-models');
    }
  };

  const handleBaseUrlSubmit = (value: string) => {
    setBaseUrl(value);
    setStep('fetching-models');
  };

  const handleModelSelect = (item: { value: string }) => {
    setModel(item.value);
    setStep('confirm');
  };

  const handleModelSubmit = (value: string) => {
    setModel(value);
    setStep('confirm');
  };

  const handleConfirm = (item: { value: string }) => {
    if (item.value === 'yes') {
      const config = new ConfigManager();
      config.set('apiKey', apiKey);
      config.set('baseUrl', baseUrl);
      config.set('model', model);
      exit();
    } else {
      exit();
    }
  };

  const _handleSkipModels = () => {
    setModels([]);
    setStep('select-model');
  };

  const maskedKey = apiKey.length > 8
    ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
    : '****';

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Strudel-TUI Configuration Wizard</Text>
      </Box>

      {/* Step 1: Select provider */}
      {step === 'provider' && (
        <Box flexDirection="column">
          <Text>Select an AI provider:</Text>
          <Box marginTop={1}>
            <SelectInput items={PROVIDERS.map(p => ({ label: p.label, value: p.value }))} onSelect={handleProviderSelect} />
          </Box>
        </Box>
      )}

      {/* Step 2: Enter API key */}
      {step === 'api-key' && (
        <Box flexDirection="column">
          <Text>
            Enter API key for <Text bold color="cyan">{provider?.label}</Text>:
          </Text>
          <Box marginTop={1}>
            <Text color="gray">Key: </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 3: Custom base URL (only for custom provider) */}
      {step === 'base-url' && (
        <Box flexDirection="column">
          <Text>Enter API base URL:</Text>
          <Box marginTop={1}>
            <Text color="gray">URL: </Text>
            <TextInput
              value={baseUrl}
              onChange={setBaseUrl}
              onSubmit={handleBaseUrlSubmit}
            />
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>Example: https://api.openai.com/v1</Text>
          </Box>
        </Box>
      )}

      {/* Step 4: Fetching models */}
      {step === 'fetching-models' && (
        <Box flexDirection="column">
          <LoadingDots text={`Fetching models from ${baseUrl}`} />
        </Box>
      )}

      {/* Step 5: Select model */}
      {step === 'select-model' && (
        <Box flexDirection="column">
          {fetchError && (
            <Box marginBottom={1}>
              <Text color="yellow">{fetchError}</Text>
            </Box>
          )}

          {models.length > 0 ? (
            <Box flexDirection="column">
              <Text>Select a model ({models.length} available):</Text>
              <Box marginTop={1} flexDirection="column">
                <SelectInput
                  items={models.map(m => ({
                    label: m.owned_by ? `${m.id}  (${m.owned_by})` : m.id,
                    value: m.id,
                  }))}
                  onSelect={handleModelSelect}
                  limit={15}
                />
              </Box>
              <Box marginTop={1}>
                <Text color="gray" dimColor>Use arrow keys to browse, Enter to select</Text>
              </Box>
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text>Enter model name:</Text>
              <Box marginTop={1}>
                <Text color="gray">Model: </Text>
                <TextInput
                  value={model}
                  onChange={setModel}
                  onSubmit={handleModelSubmit}
                />
              </Box>
              <Box marginTop={1}>
                <Text color="gray" dimColor>Example: gpt-4o, deepseek-chat</Text>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Step 6: Confirm */}
      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text bold>Configuration summary:</Text>
          <Box marginTop={1} flexDirection="column">
            <Text>  Provider:  <Text color="cyan">{provider?.label}</Text></Text>
            <Text>  API Key:   <Text color="yellow">{maskedKey}</Text></Text>
            <Text>  Base URL:  <Text color="green">{baseUrl}</Text></Text>
            <Text>  Model:     <Text color="green">{model}</Text></Text>
          </Box>
          <Box marginTop={1}>
            <Text>Save this configuration?</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Yes, save', value: 'yes' },
                { label: 'No, cancel', value: 'no' },
              ]}
              onSelect={handleConfirm}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ConfigWizard;
