import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { ConfigManager } from '../config/ConfigManager.js';
import { fetchModels, type ModelInfo } from '../llm/OpenAIClient.js';
import { colors } from './theme.js';
import MoonSpinner from './MoonSpinner.js';

// ---------------------------------------------------------------------------
// Provider presets (same as ConfigWizard)
// ---------------------------------------------------------------------------

interface ProviderPreset {
  label: string;
  value: string;
  baseUrl: string;
  model: string;
}

const PROVIDERS: ProviderPreset[] = [
  { label: 'OpenAI', value: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'DeepSeek', value: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Moonshot (Kimi)', value: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-auto' },
  { label: 'Zhipu (GLM)', value: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: 'Qwen (Tongyi)', value: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
  { label: 'OpenRouter', value: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o' },
  { label: 'Custom (OpenAI Compatible)', value: 'custom', baseUrl: '', model: '' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfigStep = 'provider' | 'api-key' | 'base-url' | 'fetching-models' | 'select-model' | 'confirm';
type Mode = 'config' | 'provider';

interface Props {
  mode: Mode;
  onClose: (saved: boolean) => void;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InlineConfig: React.FC<Props> = ({ mode, onClose, width, height }) => {
  // If mode is 'provider', start at provider step and jump to provider selection only
  const [step, setStep] = useState<ConfigStep>(mode === 'provider' ? 'provider' : 'provider');
  const [provider, setProvider] = useState<ProviderPreset | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Block parent input while this panel is open
  useInput((_input, key) => {
    if (key.escape) {
      onClose(false);
    }
  });

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
  }, [step, apiKey, baseUrl]);

  // --- Handlers ---

  const handleProviderSelect = (item: { value: string }) => {
    const preset = PROVIDERS.find(p => p.value === item.value)!;
    setProvider(preset);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);

    if (mode === 'provider') {
      // Provider-only mode: save provider + baseUrl + model, skip API key
      const config = new ConfigManager();
      config.set('baseUrl', preset.baseUrl);
      config.set('model', preset.model);
      onClose(true);
      return;
    }

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
      onClose(true);
    } else {
      onClose(false);
    }
  };

  const maskedKey = apiKey.length > 8
    ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
    : '****';

  const innerWidth = Math.min(width - 4, 60);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.primary} paddingX={1} width={innerWidth}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>
          {mode === 'provider' ? 'Switch Provider' : 'AI Configuration'}
        </Text>
        <Text color={colors.textDim}>  (esc to cancel)</Text>
      </Box>

      {/* Step 1: Select provider */}
      {step === 'provider' && (
        <Box flexDirection="column">
          <Text color={colors.text}>Select an AI provider:</Text>
          <Box marginTop={1} flexDirection="column">
            <SelectInput
              items={PROVIDERS.map(p => ({ label: p.label, value: p.value }))}
              onSelect={handleProviderSelect}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textMuted} dimColor>Arrow keys to navigate, Enter to select</Text>
          </Box>
        </Box>
      )}

      {/* Step 2: Enter API key */}
      {step === 'api-key' && (
        <Box flexDirection="column">
          <Text color={colors.text}>
            Enter API key for <Text bold color={colors.primary}>{provider?.label}</Text>:
          </Text>
          <Box marginTop={1}>
            <Text color={colors.textDim}>Key: </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textMuted} dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 3: Custom base URL */}
      {step === 'base-url' && (
        <Box flexDirection="column">
          <Text color={colors.text}>Enter API base URL:</Text>
          <Box marginTop={1}>
            <Text color={colors.textDim}>URL: </Text>
            <TextInput
              value={baseUrl}
              onChange={setBaseUrl}
              onSubmit={handleBaseUrlSubmit}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textMuted} dimColor>Example: https://api.openai.com/v1</Text>
          </Box>
        </Box>
      )}

      {/* Step 4: Fetching models */}
      {step === 'fetching-models' && (
        <Box>
          <MoonSpinner color={colors.primary} variant="braille" />
          <Text color={colors.text}> Fetching models from {baseUrl}</Text>
        </Box>
      )}

      {/* Step 5: Select model */}
      {step === 'select-model' && (
        <Box flexDirection="column">
          {fetchError && (
            <Box marginBottom={1}>
              <Text color={colors.warning}>{fetchError}</Text>
            </Box>
          )}

          {models.length > 0 ? (
            <Box flexDirection="column">
              <Text color={colors.text}>Select a model ({models.length} available):</Text>
              <Box marginTop={1} flexDirection="column">
                <SelectInput
                  items={models.map(m => ({
                    label: m.owned_by ? `${m.id}  (${m.owned_by})` : m.id,
                    value: m.id,
                  }))}
                  onSelect={handleModelSelect}
                  limit={Math.min(15, height - 10)}
                />
              </Box>
              <Box marginTop={1}>
                <Text color={colors.textMuted} dimColor>Arrow keys to browse, Enter to select</Text>
              </Box>
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text color={colors.text}>Enter model name:</Text>
              <Box marginTop={1}>
                <Text color={colors.textDim}>Model: </Text>
                <TextInput
                  value={model}
                  onChange={setModel}
                  onSubmit={handleModelSubmit}
                />
              </Box>
              <Box marginTop={1}>
                <Text color={colors.textMuted} dimColor>Example: gpt-4o, deepseek-chat</Text>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Step 6: Confirm */}
      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text bold color={colors.text}>Configuration summary:</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={colors.text}>  Provider:  <Text color={colors.primary}>{provider?.label}</Text></Text>
            <Text color={colors.text}>  API Key:   <Text color={colors.warning}>{maskedKey}</Text></Text>
            <Text color={colors.text}>  Base URL:  <Text color={colors.success}>{baseUrl}</Text></Text>
            <Text color={colors.text}>  Model:     <Text color={colors.success}>{model}</Text></Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.text}>Save this configuration?</Text>
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

export default InlineConfig;
