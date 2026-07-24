import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Built-in patterns are embedded at build time: the compiled binary is
// distributed without a repo checkout, so they cannot be read from disk.
import acid from '../../patterns/acid.strudel' with { type: 'text' };
import ambient from '../../patterns/ambient.strudel' with { type: 'text' };
import basicBeat from '../../patterns/basic-beat.strudel' with { type: 'text' };
import breakbeat from '../../patterns/breakbeat.strudel' with { type: 'text' };
import melody from '../../patterns/melody.strudel' with { type: 'text' };
import techno130 from '../../patterns/techno130.strudel' with { type: 'text' };

const BUILTIN_PATTERNS: Record<string, string> = {
  acid,
  ambient,
  'basic-beat': basicBeat,
  breakbeat,
  melody,
  techno130,
};

export interface PatternEntry {
  name: string;
  source: 'builtin' | 'user';
}

const NAME_RE = /^[a-zA-Z0-9_-]+$/;
const EXT = '.strudel';

export class PatternLoader {
  private _userDir: string;

  constructor(userDir: string = join(homedir(), '.strudel-tui', 'patterns')) {
    this._userDir = userDir;
  }

  get userPatternDir(): string {
    return this._userDir;
  }

  async listPatterns(): Promise<PatternEntry[]> {
    const entries = new Map<string, PatternEntry>();
    for (const name of Object.keys(BUILTIN_PATTERNS)) {
      entries.set(name, { name, source: 'builtin' });
    }

    let files: string[] = [];
    try {
      files = await readdir(this._userDir);
    } catch {
      // No user pattern directory yet.
    }
    for (const file of files) {
      if (!file.endsWith(EXT)) continue;
      const name = file.slice(0, -EXT.length);
      try {
        const info = await stat(join(this._userDir, file));
        if (info.isFile()) entries.set(name, { name, source: 'user' });
      } catch {
        // File disappeared between readdir and stat.
      }
    }

    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Loads a pattern by name. User patterns shadow built-ins. */
  async loadPattern(name: string): Promise<string> {
    const safe = validateName(name);
    try {
      return await readFile(join(this._userDir, `${safe}${EXT}`), 'utf-8');
    } catch {
      // Fall through to built-ins.
    }
    const builtin = BUILTIN_PATTERNS[safe];
    if (builtin !== undefined) return builtin;
    throw new Error(`No pattern named "${safe}".`);
  }

  /** Saves a pattern by name into the user pattern directory. */
  async savePattern(name: string, code: string): Promise<void> {
    const safe = validateName(name);
    await mkdir(this._userDir, { recursive: true, mode: 0o700 });
    await writeFile(join(this._userDir, `${safe}${EXT}`), code, 'utf-8');
  }
}

function validateName(name: string): string {
  let trimmed = String(name ?? '').trim();
  if (trimmed.endsWith(EXT)) trimmed = trimmed.slice(0, -EXT.length);
  if (!NAME_RE.test(trimmed)) {
    throw new Error('Invalid pattern name. Use only letters, numbers, hyphens, and underscores.');
  }
  return trimmed;
}
