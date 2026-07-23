import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { PatternLoader } from '../src/engine/PatternLoader';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('PatternLoader', () => {
  let loader: PatternLoader;

  beforeAll(async () => {
    loader = new PatternLoader();
  });

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
  });

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

  describe('getDefaultPatternDir()', () => {
    test('returns an absolute path ending with patterns', () => {
      const dir = loader.getDefaultPatternDir();
      expect(dir).toMatch(/patterns$/);
      expect(dir.startsWith('/')).toBe(true);
    });
  });
});
