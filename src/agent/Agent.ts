import { PatternOwner } from '../pattern/PatternOwner.js';
import { ChatLog } from '../session/ChatLog.js';
import { SessionStore, type SessionData } from '../session/SessionStore.js';
import { ToolExecutor } from './ToolExecutor.js';
import { KeywordAdapter } from './KeywordAdapter.js';
import { LLMAdapter } from './LLMAdapter.js';
import { ConfigManager } from '../config/ConfigManager.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import type { AudioControl } from './ToolExecutor.js';

// ---------------------------------------------------------------------------
// Types (re-exported for backward compat)
// ---------------------------------------------------------------------------

export interface AgentResponse {
  action: string;
  message: string;
  pattern?: string;
  error?: string;
}

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; name: string; args: Record<string, any> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'pattern_update'; pattern: string }
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: string };

export type AgentEventHandler = (event: AgentEvent) => void;

// ---------------------------------------------------------------------------
// Agent — thin orchestrator
// ---------------------------------------------------------------------------

export class Agent {
  private _patterns: PatternOwner;
  private _chat: ChatLog;
  private _executor: ToolExecutor;
  private _keyword: KeywordAdapter;
  private _llm: LLMAdapter | null;

  constructor(initialPattern = '', sessionId?: string, configOverrides?: Partial<StrudelConfig>, audio?: AudioControl) {
    this._patterns = new PatternOwner(initialPattern);
    this._chat = new ChatLog(sessionId);
    this._executor = new ToolExecutor(this._patterns, audio);
    this._keyword = new KeywordAdapter(this._executor, this._patterns);

    // Initialize LLM if config is available
    const config = new ConfigManager(configOverrides);
    if (config.isConfigured()) {
      this._llm = new LLMAdapter(this._executor, this._patterns, config.getAll() as StrudelConfig & { apiKey: string });
    } else {
      this._llm = null;
    }
  }

  get hasLLM(): boolean {
    return this._llm !== null;
  }

  /** The current pattern (sole source of truth — read-only for callers). */
  get currentPattern(): string {
    return this._patterns.currentPattern;
  }

  /** Direct pattern mutation (e.g. from the inline pattern editor). */
  setPattern(pattern: string): void {
    this._patterns.set(pattern);
  }

  // -------------------------------------------------------------------------
  // Main entry: streaming mode
  // -------------------------------------------------------------------------

  async processUserMessageStreaming(
    message: string,
    onEvent: AgentEventHandler,
    signal?: AbortSignal,
  ): Promise<void> {
    this._chat.addMessage('user', message);

    if (!this._llm) {
      const response = await this._keyword.processMessage(message);
      this._chat.addMessage('agent', response.message);
      await this._saveSession();
      onEvent({ type: 'done', response });
      return;
    }

    // LLM mode
    await this._llm.processMessageStreaming(message, this._patterns.currentPattern, onEvent, signal);
  }

  // -------------------------------------------------------------------------
  // Legacy entry: non-streaming
  // -------------------------------------------------------------------------

  async processUserMessage(message: string): Promise<AgentResponse> {
    this._chat.addMessage('user', message);

    if (this._llm) {
      let fullText = '';
      let lastResponse: AgentResponse = { action: 'llm', message: '' };

      await this.processUserMessageStreaming(message, (event) => {
        if (event.type === 'text_delta') fullText += event.delta;
        if (event.type === 'done') lastResponse = event.response;
      });

      return { ...lastResponse, message: fullText || lastResponse.message };
    }

    const response = await this._keyword.processMessage(message);
    this._chat.addMessage('agent', response.message);
    await this._saveSession();
    return response;
  }

  // -------------------------------------------------------------------------
  // Direct undo/redo (bypasses LLM)
  // -------------------------------------------------------------------------

  undo(): string | undefined {
    return this._patterns.undo();
  }

  redo(): string | undefined {
    return this._patterns.redo();
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async _saveSession(): Promise<void> {
    const { stack, index } = this._patterns.exportStack();
    const data: SessionData = {
      id: this._chat.sessionId,
      messages: this._chat.exportMessages(),
      patternStack: stack,
      currentIndex: index,
      createdAt: this._chat.createdAt,
      updatedAt: Date.now(),
    };
    await SessionStore.save(data).catch(() => {});
  }
}
