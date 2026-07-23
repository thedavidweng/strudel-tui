import { defineCommand, runMain } from 'citty';
import { readFile } from 'node:fs/promises';
import { type Component, Container, ProcessTerminal, TUI } from '@earendil-works/pi-tui';
import { ConfigManager } from './config/ConfigManager.js';
import type { StrudelConfig } from './config/ConfigManager.js';
import { InlineConfig } from './tui/InlineConfig.js';
import { StrudelTUI } from './tui/StrudelTUI.js';

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
        const validKeys: (keyof StrudelConfig)[] = ['apiKey', 'baseUrl', 'model', 'temperature', 'maxTokens'];
        if (!validKeys.includes(args.key as keyof StrudelConfig)) {
          console.error(`Invalid key "${args.key}". Valid keys: ${validKeys.join(', ')}`);
          process.exit(1);
        }
        const config = new ConfigManager();
        const key = args.key as keyof StrudelConfig;
        const value = key === 'temperature' || key === 'maxTokens'
          ? Number(args.value)
          : args.value;
        config.set(key, value);
        console.log(`Set ${key} = ${key === 'apiKey' ? '***' : value}`);
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
        const terminal = new ProcessTerminal();
        const tui = new TUI(terminal);
        const configContainer = new Container();
        tui.addChild(configContainer);

        const inlineConfig = new InlineConfig('config', (saved: boolean) => {
          tui.stop();
          if (saved) {
            console.log('Configuration saved.');
          } else {
            console.log('Configuration cancelled.');
          }
        });

        configContainer.addChild(inlineConfig as unknown as Component);
        tui.setFocus(inlineConfig as unknown as Component);
        tui.start();

        const cleanup = () => {
          tui.stop();
        };
        process.on('SIGTERM', cleanup);
        process.on('SIGHUP', cleanup);
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to read pattern file "${args.pattern}": ${msg}`);
        process.exit(1);
      }
    }

    const bpm = Number(args.bpm);
    if (Number.isNaN(bpm) || bpm <= 0) {
      console.error(`Invalid BPM value: "${args.bpm}"`);
      process.exit(1);
    }

    const configOverrides: Partial<StrudelConfig> = {};
    if (args['api-key']) configOverrides.apiKey = args['api-key'];
    if (args['base-url']) configOverrides.baseUrl = args['base-url'];
    if (args.model) configOverrides.model = args.model;

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

    const tui = new StrudelTUI({
      initialPattern,
      bpm,
      debug: args.debug,
      configOverrides,
    });

    // Enter alternate screen buffer for fullscreen mode
    process.stdout.write('\x1b[?1049h');
    process.stdout.write('\x1b[2J\x1b[H');

    const shutdown = () => {
      void tui.stop();
      // Restore terminal screen on exit
      process.stdout.write('\x1b[?1049l');
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGHUP', shutdown);

    tui.start();
  },
});

runMain(main);
