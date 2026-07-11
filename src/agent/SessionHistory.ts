/**
 * SessionHistory tracks conversation messages and pattern versions for
 * the current session.  It supports undo/redo of pattern changes and
 * persists session data to ~/.strudel-tui/sessions/.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'agent' | 'system' | 'error';

export interface HistoryMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
}

interface PatternSnapshot {
  pattern: string;
  timestamp: number;
}

interface SessionData {
  id: string;
  messages: HistoryMessage[];
  patternStack: PatternSnapshot[];
  currentIndex: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// SessionHistory
// ---------------------------------------------------------------------------

export class SessionHistory {
  private _messages: HistoryMessage[] = [];
  private _patternStack: PatternSnapshot[] = [];
  private _currentIndex: number = -1;
  private _sessionId: string;
  private _createdAt: number;
  private _sessionDir: string;

  constructor(sessionId?: string) {
    this._sessionId = sessionId ?? `session-${Date.now()}`;
    this._createdAt = Date.now();
    this._sessionDir = join(homedir(), '.strudel-tui', 'sessions');
  }

  /** Current session identifier. */
  get sessionId(): string {
    return this._sessionId;
  }

  // -----------------------------------------------------------------------
  // Message tracking
  // -----------------------------------------------------------------------

  /**
   * Add a message to the conversation history.
   */
  addMessage(role: MessageRole, content: string): void {
    this._messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Return all messages in chronological order.
   */
  getHistory(): readonly HistoryMessage[] {
    return this._messages;
  }

  /**
   * Return the last N messages (default 10).
   */
  getRecent(count = 10): readonly HistoryMessage[] {
    return this._messages.slice(-count);
  }

  /**
   * Clear all messages.
   */
  clearMessages(): void {
    this._messages = [];
  }

  // -----------------------------------------------------------------------
  // Pattern undo/redo
  // -----------------------------------------------------------------------

  /**
   * Push a new pattern version onto the history stack.  Discards any
   * redo entries ahead of the current position.
   */
  pushPattern(pattern: string): void {
    // Discard any forward history
    if (this._currentIndex < this._patternStack.length - 1) {
      this._patternStack = this._patternStack.slice(0, this._currentIndex + 1);
    }

    this._patternStack.push({
      pattern,
      timestamp: Date.now(),
    });
    this._currentIndex = this._patternStack.length - 1;
  }

  /**
   * Return the current pattern, or undefined if no pattern has been pushed.
   */
  getCurrentPattern(): string | undefined {
    if (this._currentIndex < 0 || this._currentIndex >= this._patternStack.length) {
      return undefined;
    }
    return this._patternStack[this._currentIndex].pattern;
  }

  /**
   * Revert to the previous pattern version.  Returns the restored pattern
   * or undefined if already at the earliest version.
   */
  undoPattern(): string | undefined {
    if (this._currentIndex <= 0) {
      return undefined;
    }
    this._currentIndex--;
    return this._patternStack[this._currentIndex].pattern;
  }

  /**
   * Re-apply the next pattern version after an undo.  Returns the restored
   * pattern or undefined if already at the latest version.
   */
  redoPattern(): string | undefined {
    if (this._currentIndex >= this._patternStack.length - 1) {
      return undefined;
    }
    this._currentIndex++;
    return this._patternStack[this._currentIndex].pattern;
  }

  /**
   * Return true if undo is possible.
   */
  canUndo(): boolean {
    return this._currentIndex > 0;
  }

  /**
   * Return true if redo is possible.
   */
  canRedo(): boolean {
    return this._currentIndex < this._patternStack.length - 1;
  }

  /**
   * Return the number of pattern versions in the stack.
   */
  patternCount(): number {
    return this._patternStack.length;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /**
   * Persist the session to disk at ~/.strudel-tui/sessions/<sessionId>.json.
   */
  async save(): Promise<void> {
    try {
      await mkdir(this._sessionDir, { recursive: true });

      const data: SessionData = {
        id: this._sessionId,
        messages: this._messages,
        patternStack: this._patternStack,
        currentIndex: this._currentIndex,
        createdAt: this._createdAt,
        updatedAt: Date.now(),
      };

      const filePath = join(this._sessionDir, `${this._sessionId}.json`);
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: unknown) {
      console.warn('[SessionHistory] Failed to save session:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * Load a session from disk by its ID.  Returns a new SessionHistory
   * populated with the saved data, or null if the file does not exist.
   */
  static async load(sessionId: string): Promise<SessionHistory | null> {
    const sessionDir = join(homedir(), '.strudel-tui', 'sessions');
    const filePath = join(sessionDir, `${sessionId}.json`);

    try {
      const raw = await readFile(filePath, 'utf-8');
      const data: SessionData = JSON.parse(raw);

      const history = new SessionHistory(sessionId);
      history._messages = data.messages ?? [];
      history._patternStack = data.patternStack ?? [];
      history._currentIndex = data.currentIndex ?? -1;
      history._createdAt = data.createdAt ?? Date.now();

      return history;
    } catch {
      return null;
    }
  }

  /**
   * List all saved session IDs.
   */
  static async listSessions(): Promise<string[]> {
    const sessionDir = join(homedir(), '.strudel-tui', 'sessions');

    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(sessionDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }
}
