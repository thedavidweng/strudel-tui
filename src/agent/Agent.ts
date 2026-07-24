import { PatternOwner } from '../pattern/PatternOwner.js';
import { ChatLog } from '../session/ChatLog.js';
import { SessionStore, type SessionData } from '../session/SessionStore.js';
import { ToolExecutor } from './ToolExecutor.js';
import { KeywordAdapter } from './KeywordAdapter.js';
import { LLMAdapter } from './LLMAdapter.js';
import { ConfigManager } from '../config/ConfigManager.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import type { AudioControl } from './ToolExecutor.js';

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
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: string };

export type AgentEventHandler = (event: AgentEvent) => void;

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

  /**
   * Re-reads config from disk and rebuilds the LLM adapter. Called after the
   * in-app config panel saves, so a newly entered API key takes effect
   * without restarting. Pattern state and chat log are preserved.
   */
  reloadConfig(): void {
    const config = new ConfigManager();
    if (config.isConfigured()) {
      this._llm = new LLMAdapter(this._executor, this._patterns, config.getAll() as StrudelConfig & { apiKey: string });
    } else {
      this._llm = null;
    }
  }

  get currentPattern(): string {
    return this._patterns.currentPattern;
  }

  setPattern(pattern: string): void {
    this._patterns.set(pattern);
  }

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

    await this._llm.processMessageStreaming(message, this._patterns.currentPattern, onEvent, signal);
    await this._saveSession();
  }

  async processUserMessage(message: string): Promise<AgentResponse> {
    this._chat.addMessage('user', message);

    const response = await this._keyword.processMessage(message);
    this._chat.addMessage('agent', response.message);
    await this._saveSession();
    return response;
  }

  undo(): string | undefined {
    return this._patterns.undo();
  }

  redo(): string | undefined {
    return this._patterns.redo();
  }

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
