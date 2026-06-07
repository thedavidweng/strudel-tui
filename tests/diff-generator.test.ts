import { describe, test, expect } from 'bun:test';
import { DiffGenerator, type UnifiedDiff } from '../src/agent/DiffGenerator';

describe('DiffGenerator', () => {
  const gen = new DiffGenerator();

  describe('computeDiff', () => {
    test('identical strings produce no changes', () => {
      const diff = gen.computeDiff('hello', 'hello');
      expect(diff.additions).toBe(0);
      expect(diff.removals).toBe(0);
    });

    test('single line addition', () => {
      const diff = gen.computeDiff('a', 'a\nb');
      expect(diff.additions).toBe(1);
      expect(diff.removals).toBe(0);
      expect(diff.text).toContain('+b');
    });

    test('single line removal', () => {
      const diff = gen.computeDiff('a\nb', 'a');
      expect(diff.additions).toBe(0);
      expect(diff.removals).toBe(1);
      expect(diff.text).toContain('-b');
    });

    test('single line modification', () => {
      const diff = gen.computeDiff('hello', 'world');
      expect(diff.additions).toBe(1);
      expect(diff.removals).toBe(1);
      expect(diff.text).toContain('-hello');
      expect(diff.text).toContain('+world');
    });

    test('multi-line pattern diff', () => {
      const old = 's("bd sn")\ns("hh*8")';
      const newP = 's("bd sn")\ns("hh*8")\ns("cp")';
      const diff = gen.computeDiff(old, newP);
      expect(diff.additions).toBe(1);
      expect(diff.removals).toBe(0);
    });

    test('diff text contains @@ header', () => {
      const diff = gen.computeDiff('a', 'b');
      expect(diff.text).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/);
    });

    test('empty strings', () => {
      const diff = gen.computeDiff('', '');
      expect(diff.additions).toBe(0);
      expect(diff.removals).toBe(0);
    });

    test('from empty to content', () => {
      const diff = gen.computeDiff('', 's("bd")');
      expect(diff.additions).toBe(1);
    });

    test('from content to empty', () => {
      const diff = gen.computeDiff('s("bd")', '');
      expect(diff.removals).toBe(1);
    });
  });

  describe('applyDiff', () => {
    test('round-trip: computeDiff then applyDiff produces the new pattern', () => {
      const old = 's("bd sn")\ns("hh*8")';
      const newP = 's("bd sn")\ns("hh*8")\ns("cp")';
      const diff = gen.computeDiff(old, newP);
      const result = gen.applyDiff(old, diff.text);
      expect(result).toBe(newP);
    });

    test('round-trip with modification', () => {
      const old = 's("bd sn")';
      const newP = 's("bd sn").fast(2)';
      const diff = gen.computeDiff(old, newP);
      const result = gen.applyDiff(old, diff.text);
      expect(result).toBe(newP);
    });

    test('round-trip with removal', () => {
      const old = 'line1\nline2\nline3';
      const newP = 'line1\nline3';
      const diff = gen.computeDiff(old, newP);
      const result = gen.applyDiff(old, diff.text);
      expect(result).toBe(newP);
    });

    test('empty diff returns original pattern', () => {
      const result = gen.applyDiff('hello', '');
      expect(result).toBe('hello');
    });

    test('throws on context mismatch', () => {
      const diff = gen.computeDiff('aaa', 'bbb');
      expect(() => gen.applyDiff('zzz', diff.text)).toThrow();
    });
  });

  describe('diff structure', () => {
    test('lines array has correct types', () => {
      const diff = gen.computeDiff('a\nc', 'a\nb\nc');
      const types = diff.lines.map(l => l.type);
      expect(types).toContain('+');
      // All types should be +, -, or space
      for (const t of types) {
        expect(['+', '-', ' ']).toContain(t);
      }
    });

    test('additions + removals match line counts', () => {
      const diff = gen.computeDiff('a\nb\nc', 'x\ny');
      expect(diff.additions).toBe(2);
      expect(diff.removals).toBe(3);
    });
  });
});
