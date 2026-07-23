import { mkdir, writeFile } from 'node:fs/promises';
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
  static async save(data: SessionData): Promise<void> {
    try {
      await mkdir(sessionDir(), { recursive: true, mode: 0o700 });
      const filePath = join(sessionDir(), `${data.id}.json`);
      await writeFile(filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    } catch (err: unknown) {
      console.warn('[SessionStore] Failed to save session:', err instanceof Error ? err.message : err);
    }
  }
}
