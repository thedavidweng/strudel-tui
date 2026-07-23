/**
 * SessionStore — persistence for session data.
 *
 * Writes/reads a single JSON file per session at
 * ~/.strudel-tui/sessions/<sessionId>.json containing both the chat
 * messages and the pattern undo/redo stack.  Pure file I/O — no domain
 * logic lives here.
 */

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HistoryMessage } from './ChatLog.js';

interface PatternSnapshot {
  pattern: string;
  timestamp: number;
}

export interface SessionData {
  id: string;
  messages: HistoryMessage[];
  patternStack: PatternSnapshot[];
  currentIndex: number;
  createdAt: number;
  updatedAt: number;
}

function sessionDir(): string {
  return join(homedir(), '.strudel-tui', 'sessions');
}

export class SessionStore {
  /** Persist the session to disk. Swallows errors (logs a warning). */
  static async save(data: SessionData): Promise<void> {
    try {
      await mkdir(sessionDir(), { recursive: true });
      const filePath = join(sessionDir(), `${data.id}.json`);
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: unknown) {
      console.warn('[SessionStore] Failed to save session:', err instanceof Error ? err.message : err);
    }
  }

  /** Load a session from disk by its ID, or null if not found. */
  static async load(id: string): Promise<SessionData | null> {
    const filePath = join(sessionDir(), `${id}.json`);
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  /** List all saved session IDs. */
  static async listSessions(): Promise<string[]> {
    try {
      const files = await readdir(sessionDir());
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }
}
