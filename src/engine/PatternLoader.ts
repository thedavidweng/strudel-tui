import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PatternEntry {
  name: string;
  path: string;
}

export class PatternLoader {
  private _defaultDir: string;

  constructor() {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    this._defaultDir = join(resolve(thisDir, '..', '..'), 'patterns');
  }

  getDefaultPatternDir(): string {
    return this._defaultDir;
  }

  async listPatterns(): Promise<PatternEntry[]> {
    const entries = await readdir(this._defaultDir);
    const results: PatternEntry[] = [];

    for (const name of entries) {
      if (extname(name) !== '.strudel') continue;
      const path = join(this._defaultDir, name);
      const info = await stat(path);
      if (info.isFile()) {
        results.push({ name, path });
      }
    }

    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }

  async loadPattern(filePath: string): Promise<string> {
    return readFile(resolve(filePath), 'utf-8');
  }

  async savePattern(filePath: string, code: string): Promise<void> {
    await writeFile(resolve(filePath), code, 'utf-8');
  }
}
