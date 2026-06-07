import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatternEntry {
  /** File name (e.g. "acid.strudel") */
  name: string;
  /** Absolute path to the file */
  path: string;
}

// ---------------------------------------------------------------------------
// PatternLoader
// ---------------------------------------------------------------------------

/**
 * PatternLoader handles reading, listing and saving .strudel pattern files.
 * It operates on the local filesystem and is independent of the audio engine.
 */
export class PatternLoader {
  private _defaultDir: string;

  constructor(projectRoot?: string) {
    // Resolve relative to the caller-supplied root or fall back to the
    // directory two levels up from this source file (i.e. the project root).
    const root = projectRoot ?? resolve(import.meta.dir, '..', '..');
    this._defaultDir = join(root, 'patterns');
  }

  // -----------------------------------------------------------------------
  // getDefaultPatternDir
  // -----------------------------------------------------------------------

  /** Return the absolute path to the default patterns/ directory. */
  getDefaultPatternDir(): string {
    return this._defaultDir;
  }

  // -----------------------------------------------------------------------
  // listPatterns
  // -----------------------------------------------------------------------

  /**
   * List all `.strudel` files in the given directory (or the default
   * patterns directory when omitted).
   */
  async listPatterns(directory?: string): Promise<PatternEntry[]> {
    const dir = directory ?? this._defaultDir;
    const entries = await readdir(dir);
    const results: PatternEntry[] = [];

    for (const name of entries) {
      if (extname(name) !== '.strudel') continue;
      const path = join(dir, name);
      const info = await stat(path);
      if (info.isFile()) {
        results.push({ name, path });
      }
    }

    // Deterministic order for stable UI lists.
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }

  // -----------------------------------------------------------------------
  // loadPattern
  // -----------------------------------------------------------------------

  /**
   * Read a `.strudel` file and return its contents as a string.
   * `filePath` may be absolute or relative to the current working directory.
   */
  async loadPattern(filePath: string): Promise<string> {
    const resolved = resolve(filePath);
    return readFile(resolved, 'utf-8');
  }

  // -----------------------------------------------------------------------
  // savePattern
  // -----------------------------------------------------------------------

  /**
   * Write `code` to the given file path, creating or overwriting the file.
   * Parent directories must already exist.
   */
  async savePattern(filePath: string, code: string): Promise<void> {
    const resolved = resolve(filePath);
    await writeFile(resolved, code, 'utf-8');
  }
}
