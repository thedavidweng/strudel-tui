import { defineCommand, runMain } from 'citty';
import { render } from 'ink';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import App from './tui/App.js';
import ConfigWizard from './tui/ConfigWizard.js';
import { ConfigManager } from './config/ConfigManager.js';

const configCmd = defineCommand({
  meta: {
    name: 'config',
    description: 'Manage Strudel-TUI configuration',
  },
  subCommands: {
    set: defineCommand({
      meta: {
        name: 'set',
        description: 'Set a configuration value',
      },
      args: {
        key: {
          type: 'positional',
          description: 'Config key (apiKey, baseUrl, model, temperature, maxTokens)',
          required: true,
        },
        value: {
          type: 'positional',
          description: 'Value to set',
          required: true,
        },
      },
      run({ args }) {
        const validKeys = ['apiKey', 'baseUrl', 'model', 'temperature', 'maxTokens'];
        if (!validKeys.includes(args.key)) {
          console.error(`Invalid key "${args.key}". Valid keys: ${validKeys.join(', ')}`);
          process.exit(1);
        }
        const config = new ConfigManager();
        const value = args.key === 'temperature' || args.key === 'maxTokens'
          ? Number(args.value)
          : args.value;
        config.set(args.key as any, value);
        console.log(`Set ${args.key} = ${args.key === 'apiKey' ? '***' : value}`);
      },
    }),
    show: defineCommand({
      meta: {
        name: 'show',
        description: 'Show current configuration',
      },
      run() {
        const config = new ConfigManager();
        const all = config.getAll();
        console.log('Strudel-TUI Configuration:');
        console.log(`  apiKey:      ${all.apiKey ? '(set)' : '(not set)'}`);
        console.log(`  baseUrl:     ${all.baseUrl}`);
        console.log(`  model:       ${all.model}`);
        console.log(`  temperature: ${all.temperature}`);
        console.log(`  maxTokens:   ${all.maxTokens}`);
        console.log(`\nConfig file: ~/.strudel-tui/config.json`);
      },
    }),
    init: defineCommand({
      meta: {
        name: 'init',
        description: 'Interactive configuration setup wizard',
      },
      run() {
        render(createElement(ConfigWizard));
      },
    }),
  },
  run() {
    // citty falls through to parent run after subcommand; no output needed
  },
});

const main = defineCommand({
  meta: {
    name: 'strudel-tui',
    version: '0.1.0',
    description: 'Terminal-based live coding interface for Strudel with AI agent',
  },
  args: {
    pattern: {
      type: 'string',
      description: 'Load a .strudel pattern file on startup',
      alias: 'p',
    },
    debug: {
      type: 'boolean',
      description: 'Enable debug logging',
      default: false,
    },
    bpm: {
      type: 'string',
      description: 'Set initial BPM (default 130)',
      default: '130',
    },
    'api-key': {
      type: 'string',
      description: 'OpenAI-compatible API key (overrides config)',
    },
    'base-url': {
      type: 'string',
      description: 'API base URL (overrides config)',
    },
    model: {
      type: 'string',
      description: 'Model name (overrides config)',
    },
  },
  subCommands: {
    config: configCmd,
  },
  async run({ args }) {
    // Skip TUI launch if stdin is not a TTY (e.g. when subcommand was used)
    if (!process.stdin.isTTY) {
      return;
    }

    let initialPattern: string | undefined;

    if (args.pattern) {
      try {
        initialPattern = await readFile(args.pattern, 'utf-8');
      } catch (err: any) {
        console.error(`Failed to read pattern file "${args.pattern}": ${err.message}`);
        process.exit(1);
      }
    }

    const bpm = Number(args.bpm);
    if (Number.isNaN(bpm) || bpm <= 0) {
      console.error(`Invalid BPM value: "${args.bpm}"`);
      process.exit(1);
    }

    // Build config overrides from CLI flags
    const configOverrides: Record<string, any> = {};
    if (args['api-key']) configOverrides.apiKey = args['api-key'];
    if (args['base-url']) configOverrides.baseUrl = args['base-url'];
    if (args.model) configOverrides.model = args.model;

    // Also check environment variables
    if (!configOverrides.apiKey && process.env.OPENAI_API_KEY) {
      configOverrides.apiKey = process.env.OPENAI_API_KEY;
    }
    if (!configOverrides.baseUrl && process.env.OPENAI_BASE_URL) {
      configOverrides.baseUrl = process.env.OPENAI_BASE_URL;
    }

    if (args.debug) {
      console.error('[debug] Starting strudel-tui');
      console.error('[debug] BPM:', bpm);
      if (initialPattern) console.error('[debug] Pattern loaded from:', args.pattern);
      if (configOverrides.apiKey) console.error('[debug] API key configured');
    }

    render(
      createElement(App, {
        initialPattern,
        bpm,
        debug: args.debug,
        configOverrides,
      }),
    );
  },
});

runMain(main);
