import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { PatternLoader } from '../src/engine/PatternLoader';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('PatternLoader', () => {
  let tempDir: string;
  let loader: PatternLoader;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'strudel-patterns-test-'));
    loader = new PatternLoader(join(tempDir, 'patterns'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('built-in patterns', () => {
    test('listPatterns includes the embedded built-ins', async () => {
      const patterns = await loader.listPatterns();
      const names = patterns.map((p) => p.name);
      for (const expected of ['acid', 'ambient', 'basic-beat', 'breakbeat', 'melody', 'techno130']) {
        expect(names).toContain(expected);
      }
      expect(patterns.every((p) => p.source === 'builtin')).toBe(true);
    });

    test('built-in content matches the repo pattern files', async () => {
      const embedded = await loader.loadPattern('acid');
      const onDisk = await readFile(join(import.meta.dir, '..', 'patterns', 'acid.strudel'), 'utf-8');
      expect(embedded).toBe(onDisk);
    });

    test('results are sorted alphabetically', async () => {
      const patterns = await loader.listPatterns();
      const names = patterns.map((p) => p.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    test('load works without the user directory existing', async () => {
      const fresh = new PatternLoader(join(tempDir, 'never-created'));
      const code = await fresh.loadPattern('melody');
      expect(code.length).toBeGreaterThan(0);
    });
  });

  describe('user patterns', () => {
    test('savePattern + loadPattern round-trips', async () => {
      const code = 'note("c d e f").sound("triangle")';
      await loader.savePattern('roundtrip', code);
      expect(await loader.loadPattern('roundtrip')).toBe(code);
    });

    test('accepts a name with .strudel extension', async () => {
      await loader.savePattern('with-ext.strudel', 'first');
      expect(await loader.loadPattern('with-ext')).toBe('first');
      expect(await loader.loadPattern('with-ext.strudel')).toBe('first');
    });

    test('savePattern overwrites an existing file', async () => {
      await loader.savePattern('overwrite', 'first');
      await loader.savePattern('overwrite', 'second');
      expect(await loader.loadPattern('overwrite')).toBe('second');
    });

    test('savePattern preserves multiline content', async () => {
      const code = '// comment\nsetcps(120/60/4);\ns("bd*4");';
      await loader.savePattern('multiline', code);
      expect(await loader.loadPattern('multiline')).toBe(code);
    });

    test('user pattern shadows a built-in with the same name', async () => {
      await loader.savePattern('acid', 's("user-version")');
      expect(await loader.loadPattern('acid')).toBe('s("user-version")');
      const patterns = await loader.listPatterns();
      const acid = patterns.find((p) => p.name === 'acid');
      expect(acid?.source).toBe('user');
      // Exactly one entry despite existing in both places.
      expect(patterns.filter((p) => p.name === 'acid').length).toBe(1);
    });

    test('listPatterns includes saved user patterns', async () => {
      const patterns = await loader.listPatterns();
      const entry = patterns.find((p) => p.name === 'roundtrip');
      expect(entry?.source).toBe('user');
    });

    test('listPatterns ignores non-strudel files', async () => {
      await mkdir(loader.userPatternDir, { recursive: true });
      await writeFile(join(loader.userPatternDir, 'notes.txt'), 'not a pattern');
      const patterns = await loader.listPatterns();
      expect(patterns.find((p) => p.name === 'notes')).toBeUndefined();
    });
  });

  describe('name validation', () => {
    test('rejects path traversal', async () => {
      await expect(loader.loadPattern('../../etc/passwd')).rejects.toThrow('Invalid pattern name');
      await expect(loader.savePattern('../escape', 'x')).rejects.toThrow('Invalid pattern name');
    });

    test('rejects empty and whitespace names', async () => {
      await expect(loader.loadPattern('')).rejects.toThrow('Invalid pattern name');
      await expect(loader.loadPattern('   ')).rejects.toThrow('Invalid pattern name');
    });

    test('throws a clear error for an unknown pattern', async () => {
      await expect(loader.loadPattern('does-not-exist')).rejects.toThrow('No pattern named');
    });
  });
});
