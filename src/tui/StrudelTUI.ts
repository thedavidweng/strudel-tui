/**
 * StrudelTUI — main TUI coordinator class.
 *
 * Fullscreen single-column layout inspired by Kimi Code (PI Agent):
 *
 *   ┌ strudel-tui v0.1.0 ───────────────────── tip ─┐
 *   │ STOPPED · 130 BPM · untitled · ◆ AI · gpt-4o  │
 *   ├─────────────────────────────────────────────────┤  ← StatusBar
 *   │ ╭─────────────────────────────────────────────╮ │
 *   │ │ ┌ Pattern Editor ────────────────── stopped ┐│ │
 *   │ │ │ 1 │ s("bd sn").lpf(800)                  ││ │
 *   │ │ │ 2 │ .room(0.5)                           ││ │
 *   │ │ └───────────────────────────────────────────┘│ │
 *   │ ╰─────────────────────────────────────────────╯ │
 *   │                                                 │
 *   │ ✨ make a chill beat                            │
 *   │ ● Here's a lo-fi pattern with...                │
 *   │                                                 │
 *   ├─────────────────────────────────────────────────┤
 *   │ ╭─────────────────────────────────────────────╮ │
 *   │ │  > _                                        │ │
 *   │ ╰─────────────────────────────────────────────╯ │
 *   └─────────────────────────────────────────────────┘
 */

import { writeFile } from 'node:fs/promises';

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
import { Welcome } from './Welcome.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrudelTUIOptions {
  initialPattern?: string;
  bpm: number;
  debug: boolean;
  configOverrides?: Partial<StrudelConfig>;
}

interface QueuedMessage {
  text: string;
  isCommand: boolean;
}

type ConfigPanelMode = 'config' | 'provider' | null;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHROME_GUTTER = 1;
const DEFAULT_PATTERN = `// Start typing your Strudel pattern here\nd1 $ s "bd sn"`;
const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// StrudelTUI
// ---------------------------------------------------------------------------

export class StrudelTUI {
  // ── Core services ──
  private readonly agent: Agent;
  private readonly audio: AudioController;
  private readonly configManager: ConfigManager;

  // ── TUI plumbing ──
  private readonly terminal: ProcessTerminal;
  private readonly tui: TUI;

  // ── Layout containers ──
  private readonly statusContainer: Container;    // full width, no gutter
  private readonly transcriptContainer: GutterContainer;  // 1-col gutter
  private readonly slashMenuContainer: GutterContainer;
  private readonly configContainer: GutterContainer;
  private readonly editorContainer: GutterContainer;

  // ── Components ──
  private readonly statusBar: StatusBar;
  private readonly messageHistory: MessageHistory;
  private readonly patternPanel: PatternPanel;
  private readonly slashMenu: SlashCommandMenu;
  private readonly inputField: Input;
  private configPanel: InlineConfig | null = null;

  // ── State ──
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
  private readonly queuedMessages: QueuedMessage[] = [];
  private readonly options: StrudelTUIOptions;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(options: StrudelTUIOptions) {
    this.options = options;
    this.pattern = options.initialPattern ?? DEFAULT_PATTERN;
    this.bpm = options.bpm;
    this.debug = options.debug;

    // Services
    this.configManager = new ConfigManager(options.configOverrides);
    this.agent = new Agent(this.pattern, undefined, options.configOverrides);
    this.audio = new AudioController();

    // TUI
    this.terminal = new ProcessTerminal();
    this.tui = new TUI(this.terminal);

    // ── Build components ──

    // Status bar (full width, 3 lines: title+tip, status, separator)
    this.statusBar = new StatusBar({
      playing: false,
      bpm: this.bpm,
      patternName: 'untitled',
      mode: this.agent.hasLLM ? 'llm' : 'keyword',
      streaming: false,
      model: this.configManager.isConfigured() ? this.configManager.get('model') : undefined,
    });

    // Pattern panel (bordered box with syntax highlighting)
    this.patternPanel = new PatternPanel();
    this.patternPanel.setPattern(this.pattern);

    // Message history (transcript)
    this.messageHistory = new MessageHistory();

    // Slash command menu
    this.slashMenu = new SlashCommandMenu();

    // Input field
    this.inputField = new Input();
    this.inputField.onSubmit = (value: string) => this.handleSubmit(value);
    this.inputField.onEscape = () => this.handleEscape();

    // ── Build containers with Kimi Code gutter pattern ──

    // Status bar: full width (no gutter — visual anchor)
    this.statusContainer = new Container();
    this.statusContainer.addChild(this.statusBar as unknown as Component);

    // Transcript area: pattern panel + messages, with 1-col gutter
    this.transcriptContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
    this.transcriptContainer.addChild(this.patternPanel as unknown as Component);
    this.transcriptContainer.addChild(this.messageHistory as unknown as Component);

    // Slash menu overlay area
    this.slashMenuContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
    this.slashMenuContainer.addChild(this.slashMenu as unknown as Component);

    // Config panel overlay area
    this.configContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);

    // Editor: with gutter (borders will be rendered by the editor itself)
    this.editorContainer = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
    this.editorContainer.addChild(this.inputField);

    // ── Assemble fullscreen layout ──
    // Top → Bottom:
    //   StatusBar (full width, 3 lines)
    //   Transcript (pattern + messages, flex-grow)
    //   SlashMenu (overlay, hidden when empty)
    //   ConfigPanel (overlay, hidden when null)
    //   Editor (bottom, fixed height)
    this.tui.addChild(this.statusContainer);
    this.tui.addChild(this.transcriptContainer);
    this.tui.addChild(this.slashMenuContainer);
    this.tui.addChild(this.configContainer);
    this.tui.addChild(this.editorContainer);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    // Register global input handler
    this.tui.addInputListener((data: string) => this.handleGlobalInput(data));

    // Focus the input field
    this.tui.setFocus(this.inputField);

    // Render welcome
    this.renderWelcome();

    // Start the event loop
    this.tui.start();

    this.log('TUI started');
  }

  async stop(): Promise<void> {
    if (this.playing) {
      await this.audio.stop().catch(() => {});
    }
    await this.audio.shutdown().catch(() => {});
    this.tui.stop();
  }

  // ---------------------------------------------------------------------------
  // Welcome
  // ---------------------------------------------------------------------------

  private renderWelcome(): void {
    const isConfigured = this.agent.hasLLM;
    const model = isConfigured ? this.configManager.get('model') : undefined;

    // Add welcome info as system messages (matching Kimi Code style)
    if (isConfigured) {
      this.addMessage('system', '◆ AI agent ready — type a message or send /help for commands');
    } else {
      this.addMessage('system', '◇ Keyword mode — no AI provider configured');
      this.addMessage('system', '  Send /config to set up AI, or /help for commands');
    }
  }

  // ---------------------------------------------------------------------------
  // Input Handling
  // ---------------------------------------------------------------------------

  private handleGlobalInput(data: string): { consume?: boolean } | undefined {
    // If config panel is open, forward input to it
    if (this.configPanel) {
      const consumed = this.configPanel.handleInput(data);
      if (consumed) {
        this.tui.requestRender();
        return { consume: true };
      }
      return undefined;
    }

    // ── Ctrl+C: cancel streaming or double-tap to quit ──
    if (matchesKey(data, Key.ctrl('c'))) {
      if (this.streaming) {
        this.streaming = false;
        this.addMessage('system', 'Interrupted');
        this.statusBar.update({ streaming: false });
        this.tui.requestRender();
        return { consume: true };
      }
      const now = Date.now();
      if (now - this.exitArmed < 1500) {
        void this.stop();
        process.exit(0);
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

    // ── Ctrl+P: toggle play/stop ──
    if (matchesKey(data, Key.ctrl('p'))) {
      void this.handlePlayToggle();
      return { consume: true };
    }

    // ── Ctrl+S: save pattern ──
    if (matchesKey(data, Key.ctrl('s'))) {
      void this.handleSave();
      return { consume: true };
    }

    // ── Ctrl+L: clear history ──
    if (matchesKey(data, Key.ctrl('l'))) {
      this.messageHistory.clear();
      this.tui.requestRender();
      return { consume: true };
    }

    // ── Escape: close overlays or clear input ──
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

    // ── Tab: accept highlighted slash suggestion ──
    if (matchesKey(data, Key.tab) && this.slashMenu.visible) {
      this.slashMenu.confirm();
      const selected = this.slashMenu.getSelected();
      if (selected) {
        const needsArg = ['/make', '/edit', '/load'].includes(selected.name);
        this.inputField.setValue(needsArg ? selected.name + ' ' : selected.name);
        this.slashMenu.setFilter('');
      }
      this.tui.requestRender();
      return { consume: true };
    }

    // ── Up arrow: navigate suggestions or input history ──
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

    // ── Down arrow: navigate suggestions or input history ──
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

    // Let Input handle everything else; update slash menu after
    queueMicrotask(() => {
      this.slashMenu.setFilter(this.inputField.getValue());
      this.tui.requestRender();
    });

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Submit / Enter
  // ---------------------------------------------------------------------------

  private handleSubmit(value: string): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (this.streaming) return;

    this.inputField.setValue('');
    this.slashMenu.setFilter('');

    this.inputHistory.push(trimmed);
    this.historyIndex = -1;

    // Slash command
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

    // Regular message → agent
    this.addMessage('user', trimmed);
    this.processUserMessage(trimmed);
  }

  // ---------------------------------------------------------------------------
  // Slash Command Execution
  // ---------------------------------------------------------------------------

  executeCommand(cmdName: string): void {
    const needsArg = ['/make', '/edit', '/load'].includes(cmdName);
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
      '/quit': () => { void this.stop(); process.exit(0); },
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

    // Agent commands (make, edit, validate)
    this.agent.context.pattern = this.pattern;
    if (this.agent.hasLLM) {
      this.runStreaming(cmdName);
    } else {
      this.runNonStreaming(cmdName);
    }
  }

  // ---------------------------------------------------------------------------
  // User Messages
  // ---------------------------------------------------------------------------

  private processUserMessage(msg: string): void {
    if (this.streaming) {
      this.queuedMessages.push({ text: msg, isCommand: false });
      this.addMessage('system', 'Message queued (agent is busy)');
      this.tui.requestRender();
      return;
    }

    this.agent.context.pattern = this.pattern;
    if (this.agent.hasLLM) {
      this.runStreaming(msg);
    } else {
      this.runNonStreaming(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Streaming Handler
  // ---------------------------------------------------------------------------

  private runStreaming(message: string): void {
    this.streaming = true;
    this.streamingText = '';
    this.streamingError = false;
    this.statusBar.update({ streaming: true });

    (async () => {
      try {
        await this.agent.processUserMessageStreaming(message, (event: AgentEvent) =>
          this.handleAgentEvent(event),
        );
      } catch (err: any) {
        this.addMessage('error', err.message);
      } finally {
        this.streaming = false;
        this.statusBar.update({ streaming: false });
        this.flushQueue();
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
      } catch (err: any) {
        this.addMessage('error', err.message);
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
      case 'pattern_update':
        this.pattern = event.pattern;
        this.patternPanel.setPattern(this.pattern);
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
        this.addMessage('error', event.error);
        break;
    }
    this.tui.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Streaming Message Management
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Message Queue
  // ---------------------------------------------------------------------------

  private flushQueue(): void {
    if (this.queuedMessages.length === 0) return;
    const next = this.queuedMessages.shift()!;
    if (next.isCommand) {
      this.executeCommand(next.text);
    } else {
      this.processUserMessage(next.text);
    }
  }

  // ---------------------------------------------------------------------------
  // Audio Control
  // ---------------------------------------------------------------------------

  private async handlePlay(): Promise<void> {
    try {
      this.addMessage('system', 'Starting audio engine...');
      await this.audio.play(this.pattern);
      this.playing = true;
      this.statusBar.update({ playing: true });
      this.patternPanel.setPlaying(true);
      this.tui.requestRender();
      this.addMessage('system', 'Playing');
    } catch (err: any) {
      this.addMessage('error', `Playback error: ${err.message}`);
    }
  }

  private async handleStop(): Promise<void> {
    try {
      await this.audio.stop();
      this.playing = false;
      this.statusBar.update({ playing: false });
      this.patternPanel.setPlaying(false);
      this.tui.requestRender();
    } catch (err: any) {
      this.addMessage('error', `Stop error: ${err.message}`);
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
    const filename = 'untitled.strudel';
    try {
      await writeFile(filename, this.pattern, 'utf-8');
      this.addMessage('system', `Saved to ${filename}`);
    } catch (err: any) {
      this.addMessage('error', `Save error: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Config Panel
  // ---------------------------------------------------------------------------

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
      this.agent.context.pattern = this.pattern;
      this.statusBar.update({ model: new ConfigManager().get('model') });
      this.addMessage('system', '◆ Configuration saved · AI agent reloaded');
    } else {
      this.addMessage('system', 'Configuration cancelled');
    }

    this.tui.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Escape Handler
  // ---------------------------------------------------------------------------

  private handleEscape(): void {
    // Handled in handleGlobalInput
  }

  // ---------------------------------------------------------------------------
  // Slash Menu Updates
  // ---------------------------------------------------------------------------

  private updateSlashMenu(): void {
    this.slashMenu.setFilter(this.inputField.getValue());
  }

  // ---------------------------------------------------------------------------
  // Message Helper
  // ---------------------------------------------------------------------------

  private addMessage(type: string, content: string): void {
    this.messageHistory.addMessage({ type: type as any, content });
    this.tui.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Debug Logging
  // ---------------------------------------------------------------------------

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.error('[StrudelTUI]', ...args);
    }
  }
}
