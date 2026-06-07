import { SessionHistory } from './SessionHistory.js';
import { DiffGenerator } from './DiffGenerator.js';
import { ToolExecutor } from './ToolExecutor.js';
import { KeywordAdapter } from './KeywordAdapter.js';
import { LLMAdapter } from './LLMAdapter.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
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

export interface AgentContext {
  pattern: string;
  history: string[];
}

// ---------------------------------------------------------------------------
// Agent — thin orchestrator
// ---------------------------------------------------------------------------

export class Agent {
  context: AgentContext;
  private _executor: ToolExecutor;
  private _history: SessionHistory;
  private _diffGen: DiffGenerator;
  private _keyword: KeywordAdapter;
  private _llm: LLMAdapter | null;

  constructor(initialPattern = '', sessionId?: string, configOverrides?: Partial<StrudelConfig>, audio?: AudioControl) {
    this.context = { pattern: initialPattern, history: [] };
    this._history = new SessionHistory(sessionId);
    this._diffGen = new DiffGenerator();

    if (initialPattern) {
      this._history.pushPattern(initialPattern);
    }

    this._executor = new ToolExecutor(initialPattern, this._history, audio);
    this._keyword = new KeywordAdapter(this._executor);

    // Initialize LLM if config is available
    const config = new ConfigManager(configOverrides);
    if (config.isConfigured()) {
      this._llm = new LLMAdapter(this._executor, config.getAll() as StrudelConfig & { apiKey: string });
    } else {
      this._llm = null;
    }
  }

  get hasLLM(): boolean {
    return this._llm !== null;
  }

  get sessionHistory(): SessionHistory {
    return this._history;
  }

  // -------------------------------------------------------------------------
  // Main entry: streaming mode
  // -------------------------------------------------------------------------

  async processUserMessageStreaming(
    message: string,
    onEvent: AgentEventHandler,
    signal?: AbortSignal,
  ): Promise<void> {
    this._history.addMessage('user', message);
    this.context.history.push(message);
    this._syncPatternFromExecutor();

    if (!this._llm) {
      const response = await this._keyword.processMessage(message);
      this._syncPatternFromExecutor();
      this._history.addMessage('agent', response.message);
      this._history.save().catch(() => {});
      onEvent({ type: 'done', response });
      return;
    }

    // LLM mode
    const currentPattern = this.context.pattern;
    await this._llm.processMessageStreaming(message, currentPattern, onEvent, signal);
    this._syncPatternFromExecutor();
  }

  // -------------------------------------------------------------------------
  // Legacy entry: non-streaming
  // -------------------------------------------------------------------------

  async processUserMessage(message: string): Promise<AgentResponse> {
    this._history.addMessage('user', message);
    this.context.history.push(message);
    this._syncPatternFromExecutor();

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
    this._syncPatternFromExecutor();
    this._history.addMessage('agent', response.message);
    this._history.save().catch(() => {});
    return response;
  }

  // -------------------------------------------------------------------------
  // Generate diff (public, backward compat)
  // -------------------------------------------------------------------------

  async generateDiff(newPattern: string): Promise<{ diff: string; patched: string }> {
    const unified = this._diffGen.computeDiff(this.context.pattern, newPattern);
    return { diff: unified.text, patched: newPattern };
  }

  // -------------------------------------------------------------------------
  // Sync pattern from executor to context (backward compat)
  // -------------------------------------------------------------------------

  private _syncPatternFromExecutor(): void {
    this.context.pattern = this._executor.currentPattern;
  }
}
