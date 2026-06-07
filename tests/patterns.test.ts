import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { PatternLoader } from '../src/engine/PatternLoader';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('PatternLoader', () => {
  let tempDir: string;
  let loader: PatternLoader;

  beforeAll(async () => {
    // Use the real project patterns directory for read-only tests
    loader = new PatternLoader();
  });

  // -----------------------------------------------------------------------
  // listPatterns
  // -----------------------------------------------------------------------

  describe('listPatterns()', () => {
    test('returns an array of pattern entries', async () => {
      const patterns = await loader.listPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });

    test('entries have name and path properties', async () => {
      const patterns = await loader.listPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      const entry = patterns[0];
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.path).toBe('string');
    });

    test('all entries are .strudel files', async () => {
      const patterns = await loader.listPatterns();
      for (const entry of patterns) {
        expect(entry.name).toMatch(/\.strudel$/);
      }
    });

    test('results are sorted alphabetically', async () => {
      const patterns = await loader.listPatterns();
      const names = patterns.map((p) => p.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    test('listPatterns on a custom directory works', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'strudel-test-'));
      // PatternLoader appends /patterns to the root, so we must create that subdir
      const patternsSubdir = join(tempDir, 'patterns');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(patternsSubdir, { recursive: true });
      await writeFile(join(patternsSubdir, 'test.strudel'), 's("bd")', 'utf-8');
      await writeFile(join(patternsSubdir, 'other.txt'), 'not a pattern', 'utf-8');

      const customLoader = new PatternLoader(tempDir);
      const patterns = await customLoader.listPatterns();
      expect(patterns.length).toBe(1);
      expect(patterns[0].name).toBe('test.strudel');
    });
  });

  // -----------------------------------------------------------------------
  // loadPattern
  // -----------------------------------------------------------------------

  describe('loadPattern()', () => {
    test('loads a real pattern file', async () => {
      const patterns = await loader.listPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      const content = await loader.loadPattern(patterns[0].path);
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    test('throws for a non-existent file', async () => {
      await expect(loader.loadPattern('/tmp/does-not-exist-12345.strudel')).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // savePattern + loadPattern round-trip
  // -----------------------------------------------------------------------

  describe('savePattern() + loadPattern()', () => {
    let saveTempDir: string;

    beforeAll(async () => {
      saveTempDir = await mkdtemp(join(tmpdir(), 'strudel-save-test-'));
    });

    afterAll(async () => {
      await rm(saveTempDir, { recursive: true, force: true });
    });

    test('savePattern creates a file that loadPattern can read back', async () => {
      const filePath = join(saveTempDir, 'roundtrip.strudel');
      const code = 'note("c d e f").sound("triangle")';

      await loader.savePattern(filePath, code);
      const loaded = await loader.loadPattern(filePath);
      expect(loaded).toBe(code);
    });

    test('savePattern overwrites an existing file', async () => {
      const filePath = join(saveTempDir, 'overwrite.strudel');

      await loader.savePattern(filePath, 'first');
      await loader.savePattern(filePath, 'second');
      const loaded = await loader.loadPattern(filePath);
      expect(loaded).toBe('second');
    });

    test('savePattern preserves multiline content', async () => {
      const filePath = join(saveTempDir, 'multiline.strudel');
      const code = '// comment\nsetcps(120/60/4);\ns("bd*4");';

      await loader.savePattern(filePath, code);
      const loaded = await loader.loadPattern(filePath);
      expect(loaded).toBe(code);
    });
  });

  // -----------------------------------------------------------------------
  // getDefaultPatternDir
  // -----------------------------------------------------------------------

  describe('getDefaultPatternDir()', () => {
    test('returns an absolute path ending with patterns', () => {
      const dir = loader.getDefaultPatternDir();
      expect(dir).toMatch(/patterns$/);
      expect(dir.startsWith('/')).toBe(true);
    });
  });
});
