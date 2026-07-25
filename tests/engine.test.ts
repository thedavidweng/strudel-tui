import { describe, test, expect } from 'bun:test';
import { PatternSyntax } from '../src/engine/PatternSyntax';
import { Engine } from '../src/engine/Engine';

describe('PatternSyntax', () => {
  const syntax = new PatternSyntax();

  describe('validate()', () => {
    test('accepts a valid mini-notation pattern', () => {
      const result = syntax.validate('s("bd sn hh cp")');
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('accepts a valid note pattern', () => {
      const result = syntax.validate('note("c d e f").sound("triangle")');
      expect(result.valid).toBe(true);
    });

    test('accepts an empty string as valid', () => {
      const result = syntax.validate('');
      expect(result.valid).toBe(true);
    });

    test('rejects code with a syntax error', () => {
      const result = syntax.validate('s("bd sn"');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].message).toBeTruthy();
    });

    test('rejects code with unbalanced braces', () => {
      const result = syntax.validate('{');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    test('error includes line and column when available', () => {
      const result = syntax.validate('const x = {\n  broken');
      expect(result.valid).toBe(false);
      const err = result.errors![0];
      expect(err.message).toBeTruthy();
    });
  });

  describe('generateFromSeed()', () => {
    test('returns a non-empty string', () => {
      const pattern = syntax.generateFromSeed('test seed');
      expect(typeof pattern).toBe('string');
      expect(pattern.length).toBeGreaterThan(0);
    });

    test('is deterministic for the same seed', () => {
      const a = syntax.generateFromSeed('hello world');
      const b = syntax.generateFromSeed('hello world');
      expect(a).toBe(b);
    });

    test('produces different output for different seeds', () => {
      const a = syntax.generateFromSeed('seed A');
      const b = syntax.generateFromSeed('seed B');
      expect(a).not.toBe(b);
    });

    test('generates valid Strudel code', () => {
      const pattern = syntax.generateFromSeed('validation test');
      const result = syntax.validate(pattern);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Engine', () => {
  const engine = new Engine();

  describe('init()', () => {
    test('is not initialised before init() is called', () => {
      const e = new Engine();
      expect(e.isInitialized).toBe(false);
    });

    test('is initialised after init() is called', async () => {
      const e = new Engine();
      await e.init();
      expect(e.isInitialized).toBe(true);
    });

    test('init() is idempotent', async () => {
      const e = new Engine();
      await e.init();
      await e.init();
      expect(e.isInitialized).toBe(true);
    });
  });

  describe('getPatternInfo()', () => {
    test('returns metadata for a drum pattern', async () => {
      const info = await engine.getPatternInfo('s("bd sn hh cp")');
      expect(info).not.toBeNull();
      expect(info!.eventCount).toBeGreaterThan(0);
      expect(info!.voices).toBeGreaterThan(0);
      expect(Array.isArray(info!.voiceNames)).toBe(true);
    });

    test('voiceNames contains the sound names', async () => {
      const info = await engine.getPatternInfo('s("bd")');
      expect(info).not.toBeNull();
      expect(info!.voiceNames).toContain('bd');
    });

    test('returns null for invalid code', async () => {
      const info = await engine.getPatternInfo('not_a_real_function()');
      expect(info).toBeNull();
    });

    test('counts events correctly for a repeated pattern', async () => {
      const info = await engine.getPatternInfo('s("bd*4")');
      expect(info).not.toBeNull();
      expect(info!.eventCount).toBe(4);
    });
  });
});
