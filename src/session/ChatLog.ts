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

  get sessionId(): string {
    return this._sessionId;
  }

  get createdAt(): number {
    return this._createdAt;
  }

  addMessage(role: MessageRole, content: string): void {
    this._messages.push({ role, content, timestamp: Date.now() });
  }

  clearMessages(): void {
    this._messages = [];
  }

  exportMessages(): HistoryMessage[] {
    return this._messages;
  }
}
