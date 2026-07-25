import { join } from 'node:path';

import {
  type Component,
  Container,
  Input,
  Key,
  matchesKey,
  ProcessTerminal,
  TUI,
} from '@earendil-works/pi-tui';

import { Agent } from '../agent/Agent.js';
import type { AgentEvent } from '../agent/Agent.js';
import { AudioController } from '../audio/AudioController.js';
import { PatternLoader } from '../engine/PatternLoader.js';
import { ConfigManager } from '../config/ConfigManager.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import { formatHelp } from '../agent/HelpText.js';
import { GutterContainer } from './GutterContainer.js';
import { InlineConfig } from './InlineConfig.js';
import { MessageHistory } from './MessageHistory.js';
import { PatternPanel } from './PatternPanel.js';
import { SLASH_COMMANDS } from './SlashCommandMenu.js';
import { SlashCommandMenu } from './SlashCommandMenu.js';
import { StatusBar } from './StatusBar.js';
import type { MessageType } from './MessageHistory.js';

export interface StrudelTUIOptions {
  initialPattern?: string;
  bpm: number;
  debug: boolean;
  configOverrides?: Partial<StrudelConfig>;
}

type ConfigPanelMode = 'config' | 'provider' | null;

const CHROME_GUTTER = 1;
const DEFAULT_PATTERN = `// Start typing your Strudel pattern here\nd1 $ s "bd sn"`;

const COMMANDS_WITH_ARGS = ['/make', '/edit', '/load'];

export class StrudelTUI {
  private readonly agent: Agent;
  private readonly audio: AudioController;
  private readonly configManager: ConfigManager;

  private readonly terminal: ProcessTerminal;
  private readonly tui: TUI;

  private readonly statusContainer: Container;
  private readonly transcriptContainer: GutterContainer;
  private readonly slashMenuContainer: GutterContainer;
  private readonly configContainer: GutterContainer;
  private readonly editorContainer: GutterContainer;

  private readonly statusBar: StatusBar;
  private readonly messageHistory: MessageHistory;
  private readonly patternPanel: PatternPanel;
  private readonly slashMenu: SlashCommandMenu;
  private readonly inputField: Input;
  private configPanel: InlineConfig | null = null;

  private pattern: string;
  private readonly bpm: number;
  private readonly debug: boolean;
  private playing = false;
  private streaming = false;
  private streamingText = '';
  private streamingError = false;
  private readonly inputHistory: string[] = [];
  private historyIndex = -1;
  private exitArmed = 0;
  private readonly queuedMessages: string[] = [];
  private altScreenActive = false;
  private stopped = false;
  private savedConsole: Pick<Console, 'log' | 'warn' | 'error'> | null = null;
  private streamAbort: AbortController | null = null;

  constructor(options: StrudelTUIOptions) {
    this.pattern = options.initialPattern ?? DEFAULT_PATTERN;
    this.bpm = options.bpm;
    this.debug = options.debug;

    this.configManager = new ConfigManager(options.configOverrides);
    this.audio = new AudioController((playing) => {
      this.playing = playing;
      this.statusBar.update({ playing });
      this.patternPanel.setPlaying(playing);
      this.tui.requestRender();
    });
    this.agent = new Agent(this.pattern, undefined, options.configOverrides, this.audio);

    this.terminal = new ProcessTerminal();
    this.tui = new TUI(this.terminal);

    this.statusBar = new StatusBar({
      playing: false,
      bpm: this.bpm,
      patternName: 'untitled',
      mode: this.agent.hasLLM ? 'llm' : 'keyword',
      streaming: false,
      model: this.configManager.isConfigured() ? this.configManager.get('model') : undefined,
    });

    this.patternPanel = new PatternPanel();
    this.patternPanel.setPattern(this.pattern);

    this.messageHistory = new MessageHistory();

    this.slashMenu = new SlashCommandMenu();

    this.inputField = new Input();
    this.inputField.onSubmit = (value: string) => this.handleSubmit(value);

    this.statusContainer = new Container();
    this.statusContainer.addChild(this.statusBar as unknown as Component);

    this.transcriptContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
    this.transcriptContainer.addChild(this.patternPanel as unknown as Component);
    this.transcriptContainer.addChild(this.messageHistory as unknown as Component);

    this.slashMenuContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
    this.slashMenuContainer.addChild(this.slashMenu as unknown as Component);

    this.configContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);

    this.editorContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
    this.editorContainer.addChild(this.inputField);

    this.tui.addChild(this.statusContainer);
    this.tui.addChild(this.transcriptContainer);
    this.tui.addChild(this.slashMenuContainer);
    this.tui.addChild(this.configContainer);
    this.tui.addChild(this.editorContainer);
  }

  start(): void {
    // Enter the alternate screen buffer for fullscreen mode.
    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
    this.altScreenActive = true;

    // While the TUI owns the screen, stray console output (audio fallback
    // warnings, tool errors, library noise) would corrupt the frame —
    // surface it in the message history instead.
    this.redirectConsole();

    this.tui.addInputListener((data: string) => this.handleGlobalInput(data));

    this.tui.setFocus(this.inputField);

    this.renderWelcome();

    this.tui.start();

    this.log('TUI started');
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;

    this.restoreConsole();
    // Audio teardown talks to a WebView that may be wedged — cap the wait
    // so quitting can never hang the terminal.
    await withTimeout(
      (async () => {
        if (this.playing) await this.audio.stop().catch(() => {});
        await this.audio.shutdown().catch(() => {});
      })(),
      2000,
    );
    this.tui.stop();
    this.restoreScreen();
  }

  /** Synchronous best-effort terminal restore for crash paths. */
  emergencyRestore(): void {
    this.restoreConsole();
    try {
      this.tui.stop();
    } catch {
      // Terminal may already be gone.
    }
    this.restoreScreen();
  }

  private restoreScreen(): void {
    if (this.altScreenActive) {
      process.stdout.write('\x1b[?1049l');
      this.altScreenActive = false;
    }
  }

  private exit(code = 0): void {
    void this.stop().finally(() => process.exit(code));
  }

  private redirectConsole(): void {
    if (this.savedConsole) return;
    this.savedConsole = { log: console.log, warn: console.warn, error: console.error };
    const capture = (type: MessageType) => (...args: unknown[]) => {
      const text = args
        .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : String(a)))
        .join(' ');
      if (text.trim()) this.addMessage(type, text);
    };
    console.log = capture('system');
    console.warn = capture('system');
    console.error = capture('error');
  }

  private restoreConsole(): void {
    if (!this.savedConsole) return;
    Object.assign(console, this.savedConsole);
    this.savedConsole = null;
  }

  private renderWelcome(): void {
    const isConfigured = this.agent.hasLLM;

    // matching Kimi Code style
    if (isConfigured) {
      this.addMessage('system', '◆ AI agent ready — type a message or send /help for commands');
    } else {
      this.addMessage('system', '◇ Keyword mode — no AI provider configured');
      this.addMessage('system', '  Send /config to set up AI, or /help for commands');
    }
  }

  private handleGlobalInput(data: string): { consume?: boolean } | undefined {
    if (this.configPanel) {
      const consumed = this.configPanel.handleInput(data);
      if (consumed) {
        this.tui.requestRender();
        return { consume: true };
      }
      return undefined;
    }

    if (matchesKey(data, Key.ctrl('c'))) {
      if (this.streaming) {
        this.streamAbort?.abort();
        this.streaming = false;
        this.streamingError = true;
        if (this.streamingText) {
          this.messageHistory.finalizeStreamingMessage(this.streamingText);
          this.streamingText = '';
        }
        this.addMessage('system', 'Interrupted');
        this.statusBar.update({ streaming: false });
        this.tui.requestRender();
        return { consume: true };
      }
      const now = Date.now();
      if (now - this.exitArmed < 1500) {
        this.exit();
        return { consume: true };
      } else {
        this.exitArmed = now;
        if (this.inputField.getValue().length > 0) {
          this.inputField.setValue('');
          this.updateSlashMenu();
        } else {
          this.addMessage('system', 'Press ctrl+c again to exit');
        }
      }
      this.tui.requestRender();
      return { consume: true };
    }

    if (matchesKey(data, Key.ctrl('p'))) {
      void this.handlePlayToggle();
      return { consume: true };
    }

    if (matchesKey(data, Key.ctrl('s'))) {
      void this.handleSave();
      return { consume: true };
    }

    if (matchesKey(data, Key.ctrl('l'))) {
      this.messageHistory.clear();
      this.tui.requestRender();
      return { consume: true };
    }

    if (matchesKey(data, Key.escape)) {
      if (this.configPanel) {
        this.closeConfigPanel(false);
        return { consume: true };
      }
      if (this.slashMenu.visible) {
        this.slashMenu.setFilter('');
        this.inputField.setValue('');
        this.tui.requestRender();
        return { consume: true };
      }
      if (this.inputField.getValue().length > 0) {
        this.inputField.setValue('');
        this.slashMenu.setFilter('');
        this.tui.requestRender();
        return { consume: true };
      }
      return undefined;
    }

    if (matchesKey(data, Key.tab) && this.slashMenu.visible) {
      this.slashMenu.confirm();
      const selected = this.slashMenu.getSelected();
      if (selected) {
        const needsArg = COMMANDS_WITH_ARGS.includes(selected.name);
        this.inputField.setValue(needsArg ? selected.name + ' ' : selected.name);
        this.slashMenu.setFilter('');
      }
      this.tui.requestRender();
      return { consume: true };
    }

    if (matchesKey(data, Key.up)) {
      if (this.slashMenu.visible) {
        this.slashMenu.navigateUp();
        this.tui.requestRender();
        return { consume: true };
      }
      if (this.inputHistory.length > 0) {
        const idx = this.historyIndex + 1;
        if (idx < this.inputHistory.length) {
          this.historyIndex = idx;
          this.inputField.setValue(this.inputHistory[this.inputHistory.length - 1 - idx]!);
          this.slashMenu.setFilter(this.inputField.getValue());
          this.tui.requestRender();
        }
      }
      return { consume: true };
    }

    if (matchesKey(data, Key.down)) {
      if (this.slashMenu.visible) {
        this.slashMenu.navigateDown();
        this.tui.requestRender();
        return { consume: true };
      }
      if (this.historyIndex > 0) {
        this.historyIndex -= 1;
        this.inputField.setValue(this.inputHistory[this.inputHistory.length - 1 - this.historyIndex]!);
      } else {
        this.historyIndex = -1;
        this.inputField.setValue('');
      }
      this.slashMenu.setFilter(this.inputField.getValue());
      this.tui.requestRender();
      return { consume: true };
    }

    queueMicrotask(() => {
      this.slashMenu.setFilter(this.inputField.getValue());
      this.tui.requestRender();
    });

    return undefined;
  }

  private handleSubmit(value: string): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (this.streaming) return;

    this.inputField.setValue('');
    this.slashMenu.setFilter('');

    this.inputHistory.push(trimmed);
    this.historyIndex = -1;

    if (trimmed.startsWith('/')) {
      const cmd = SLASH_COMMANDS.find(
        (c) => c.name === trimmed || c.alias?.includes(trimmed),
      );
      if (cmd) {
        this.addMessage('user', cmd.name);
        this.executeCommand(cmd.name);
        return;
      }
    }

    this.addMessage('user', trimmed);
    this.processUserMessage(trimmed);
  }

  executeCommand(cmdName: string): void {
    const needsArg = COMMANDS_WITH_ARGS.includes(cmdName);
    if (needsArg) {
      this.inputField.setValue(cmdName + ' ');
      this.tui.requestRender();
      return;
    }

    if (cmdName === '/config' || cmdName === '/provider') {
      this.openConfigPanel(cmdName === '/config' ? 'config' : 'provider');
      return;
    }

    const direct: Record<string, () => void | Promise<void>> = {
      '/play': () => {
        void this.handlePlay();
      },
      '/stop': () => {
        void this.handleStop();
        this.addMessage('system', 'Stopped');
      },
      '/save': () => { void this.handleSave(); },
      '/clear': () => { this.messageHistory.clear(); },
      '/help': () => { this.addMessage('system', formatHelp()); },
      '/quit': () => { this.exit(); },
      '/undo': () => {
        const restored = this.agent.undo();
        if (restored !== undefined) {
          this.pattern = restored;
          this.patternPanel.setPattern(this.pattern);
          this.addMessage('system', 'Reverted to previous pattern');
        } else {
          this.addMessage('system', 'Nothing to undo');
        }
      },
      '/redo': () => {
        const restored = this.agent.redo();
        if (restored !== undefined) {
          this.pattern = restored;
          this.patternPanel.setPattern(this.pattern);
          this.addMessage('system', 'Re-applied pattern');
        } else {
          this.addMessage('system', 'Nothing to redo');
        }
      },
    };

    if (direct[cmdName]) {
      void direct[cmdName]!();
      this.tui.requestRender();
      return;
    }

    if (this.agent.hasLLM) {
      this.runStreaming(cmdName);
    } else {
      this.runNonStreaming(cmdName);
    }
  }

  private processUserMessage(msg: string): void {
    if (this.streaming) {
      this.queuedMessages.push(msg);
      this.addMessage('system', 'Message queued (agent is busy)');
      this.tui.requestRender();
      return;
    }

    if (this.agent.hasLLM) {
      this.runStreaming(msg);
    } else {
      this.runNonStreaming(msg);
    }
  }

  private runStreaming(message: string): void {
    this.streaming = true;
    this.streamingText = '';
    this.streamingError = false;
    const controller = new AbortController();
    this.streamAbort = controller;
    this.statusBar.update({ streaming: true });

    (async () => {
      try {
        await this.agent.processUserMessageStreaming(
          message,
          (event: AgentEvent) => this.handleAgentEvent(event),
          controller.signal,
        );
      } catch (err: unknown) {
        this.addMessage('error', (err instanceof Error ? err.message : String(err)));
      } finally {
        // An interrupted stream can outlive its replacement — only the
        // stream that still owns the state may tear it down.
        if (this.streamAbort === controller) {
          this.streamAbort = null;
          this.streaming = false;
          this.statusBar.update({ streaming: false });
          this.flushQueue();
        }
      }
    })();
  }

  private runNonStreaming(message: string): void {
    (async () => {
      try {
        const response = await this.agent.processUserMessage(message);
        if (response.error) {
          this.addMessage('error', response.message);
        } else {
          this.addMessage('agent', response.message);
        }
        if (response.pattern && response.pattern !== this.pattern) {
          this.pattern = response.pattern;
          this.patternPanel.setPattern(this.pattern);
        }
        if (response.action === 'play') void this.handlePlay();
        else if (response.action === 'stop') void this.handleStop();
      } catch (err: unknown) {
        this.addMessage('error', (err instanceof Error ? err.message : String(err)));
      } finally {
        this.tui.requestRender();
        this.flushQueue();
      }
    })();
  }

  private handleAgentEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'text_delta':
        this.streamingText += event.delta;
        this.updateStreamingMessage();
        break;
      case 'tool_call':
        this.addMessage('tool', `▸ ${event.name}`);
        break;
      case 'tool_result':
        this.updateLastToolMessage(`▸ ${event.name} → ${event.result}`);
        break;
      case 'done':
        if (!this.streamingError) {
          this.finalizeStreamingMessage(event.response.message || this.streamingText);
        }
        if (event.response.pattern) {
          this.pattern = event.response.pattern;
          this.patternPanel.setPattern(this.pattern);
        }
        break;
      case 'error':
        this.streamingError = true;
        // Keep whatever text already streamed in — otherwise the message is
        // left as a dangling "▌" placeholder.
        if (this.streamingText) {
          this.messageHistory.finalizeStreamingMessage(this.streamingText);
          this.streamingText = '';
        }
        this.addMessage('error', event.error);
        break;
    }
    this.tui.requestRender();
  }

  private updateStreamingMessage(): void {
    this.messageHistory.updateOrAddStreamingMessage(this.streamingText + '▌');
  }

  private updateLastToolMessage(content: string): void {
    this.messageHistory.updateOrAddLastToolMessage(content);
  }

  private finalizeStreamingMessage(finalText: string): void {
    if (finalText) {
      this.messageHistory.finalizeStreamingMessage(finalText);
    }
  }

  private flushQueue(): void {
    if (this.queuedMessages.length === 0) return;
    const next = this.queuedMessages.shift()!;
    this.processUserMessage(next);
  }

  private async handlePlay(): Promise<void> {
    try {
      const result = await this.audio.play(this.pattern);
      if (result === 'awaiting-browser') {
        this.addMessage('system', 'Opened a browser tab for audio — click "Enable audio" there. Your pattern starts automatically.');
        this.tui.requestRender();
        return;
      }
      this.playing = true;
      this.statusBar.update({ playing: true });
      this.patternPanel.setPlaying(true);
      this.tui.requestRender();
      this.addMessage('system', 'Playing');
    } catch (err: unknown) {
      this.addMessage('error', `Playback error: ${(err instanceof Error ? err.message : String(err))}`);
    }
  }

  private async handleStop(): Promise<void> {
    try {
      await this.audio.stop();
      this.playing = false;
      this.statusBar.update({ playing: false });
      this.patternPanel.setPlaying(false);
      this.tui.requestRender();
    } catch (err: unknown) {
      this.addMessage('error', `Stop error: ${(err instanceof Error ? err.message : String(err))}`);
    }
  }

  private async handlePlayToggle(): Promise<void> {
    if (this.playing) {
      await this.handleStop();
    } else {
      await this.handlePlay();
    }
  }

  private async handleSave(): Promise<void> {
    try {
      const loader = new PatternLoader();
      await loader.savePattern('untitled', this.pattern);
      this.addMessage('system', `Saved to ${join(loader.userPatternDir, 'untitled.strudel')}`);
    } catch (err: unknown) {
      this.addMessage('error', `Save error: ${(err instanceof Error ? err.message : String(err))}`);
    }
  }

  private openConfigPanel(mode: ConfigPanelMode): void {
    if (!mode) return;

    this.configPanel = new InlineConfig(mode, (saved: boolean) => {
      this.closeConfigPanel(saved);
    });

    this.configContainer.clear();
    this.configContainer.addChild(this.configPanel as unknown as Component);

    this.addMessage('system', `Opening ${mode} panel... (press Escape to close)`);
    this.tui.requestRender();
  }

  private closeConfigPanel(saved: boolean): void {
    this.configContainer.clear();
    this.configPanel = null;

    if (saved) {
      this.agent.reloadConfig();
      const configured = this.agent.hasLLM;
      this.statusBar.update({
        mode: configured ? 'llm' : 'keyword',
        model: configured ? new ConfigManager().get('model') : undefined,
      });
      this.addMessage(
        'system',
        configured ? '◆ Configuration saved · AI agent ready' : 'Configuration saved',
      );
    } else {
      this.addMessage('system', 'Configuration cancelled');
    }

    this.tui.requestRender();
  }

  private updateSlashMenu(): void {
    this.slashMenu.setFilter(this.inputField.getValue());
  }

  private addMessage(type: MessageType, content: string): void {
    this.messageHistory.addMessage({ type, content });
    this.tui.requestRender();
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      this.addMessage('system', `[debug] ${args.map(String).join(' ')}`);
    }
  }
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}
