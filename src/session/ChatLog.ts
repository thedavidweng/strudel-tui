/**
 * ChatLog — in-memory conversation messages for the current session.
 *
 * Owns the list of user/agent/system messages.  Persistence is handled by
 * SessionStore, which reads messages via `exportMessages()`.
 */

export type MessageRole = 'user' | 'agent' | 'system' | 'error';

export interface HistoryMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
}

export class ChatLog {
  private _messages: HistoryMessage[] = [];
  private _sessionId: string;
  private _createdAt: number;

  constructor(sessionId?: string) {
    this._sessionId = sessionId ?? `session-${Date.now()}`;
    this._createdAt = Date.now();
  }

  /** Current session identifier. */
  get sessionId(): string {
    return this._sessionId;
  }

  get createdAt(): number {
    return this._createdAt;
  }

  /** Add a message to the conversation history. */
  addMessage(role: MessageRole, content: string): void {
    this._messages.push({ role, content, timestamp: Date.now() });
  }

  /** Return all messages in chronological order. */
  getHistory(): readonly HistoryMessage[] {
    return this._messages;
  }

  /** Return the last N messages (default 10). */
  getRecent(count = 10): readonly HistoryMessage[] {
    return this._messages.slice(-count);
  }

  /** Clear all messages. */
  clearMessages(): void {
    this._messages = [];
  }

  // -- persistence support (used by SessionStore via Agent) --

  exportMessages(): HistoryMessage[] {
    return this._messages;
  }

  importMessages(messages: HistoryMessage[]): void {
    this._messages = messages;
  }
}
