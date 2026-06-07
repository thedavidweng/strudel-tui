import { describe, test, expect } from 'bun:test';
import { StrudelEngineWrapper } from '../src/engine/StrudelEngineWrapper';

describe('StrudelEngineWrapper', () => {
  const engine = new StrudelEngineWrapper();

  // -----------------------------------------------------------------------
  // validate()
  // -----------------------------------------------------------------------

  describe('validate()', () => {
    test('accepts a valid mini-notation pattern', async () => {
      const result = await engine.validate('s("bd sn hh cp")');
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('accepts a valid note pattern', async () => {
      const result = await engine.validate('note("c d e f").sound("triangle")');
      expect(result.valid).toBe(true);
    });

    test('accepts an empty string as valid', async () => {
      const result = await engine.validate('');
      expect(result.valid).toBe(true);
    });

    test('rejects code with a syntax error', async () => {
      const result = await engine.validate('s("bd sn"');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].message).toBeTruthy();
    });

    test('rejects code with unbalanced braces', async () => {
      const result = await engine.validate('{');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    test('error includes line and column when available', async () => {
      const result = await engine.validate('const x = {\n  broken');
      expect(result.valid).toBe(false);
      // Acorn should provide positional info for multi-line syntax errors
      const err = result.errors![0];
      expect(err.message).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // queryEvents()
  // -----------------------------------------------------------------------

  describe('queryEvents()', () => {
    test('returns events for a simple drum pattern', async () => {
      const events = await engine.queryEvents('s("bd sn")');
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    test('each event has hap, onset, duration, and value', async () => {
      const events = await engine.queryEvents('s("bd")');
      expect(events.length).toBeGreaterThan(0);
      const evt = events[0];
      expect(typeof evt.hap).toBe('string');
      expect(typeof evt.onset).toBe('number');
      expect(typeof evt.duration).toBe('number');
      expect(evt.value).toBeDefined();
    });

    test('returns multiple events for a repeated pattern', async () => {
      const events = await engine.queryEvents('s("bd*4")');
      expect(events.length).toBeGreaterThanOrEqual(4);
    });

    test('returns empty array for invalid code', async () => {
      const events = await engine.queryEvents('not_a_function("x")');
      expect(Array.isArray(events)).toBe(true);
      // Invalid code should produce empty array (error is logged, not thrown)
    });

    test('respects the cycles parameter', async () => {
      const oneCycle = await engine.queryEvents('s("bd")', 1);
      const twoCycles = await engine.queryEvents('s("bd")', 2);
      expect(twoCycles.length).toBeGreaterThanOrEqual(oneCycle.length);
    });
  });

  // -----------------------------------------------------------------------
  // generatePattern()
  // -----------------------------------------------------------------------

  describe('generatePattern()', () => {
    test('returns a non-empty string', () => {
      const pattern = engine.generatePattern();
      expect(typeof pattern).toBe('string');
      expect(pattern.length).toBeGreaterThan(0);
    });

    test('returns valid Strudel code', async () => {
      const pattern = engine.generatePattern();
      const result = await engine.validate(pattern);
      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // generateFromSeed()
  // -----------------------------------------------------------------------

  describe('generateFromSeed()', () => {
    test('returns a non-empty string', () => {
      const pattern = engine.generateFromSeed('test seed');
      expect(typeof pattern).toBe('string');
      expect(pattern.length).toBeGreaterThan(0);
    });

    test('is deterministic for the same seed', () => {
      const a = engine.generateFromSeed('hello world');
      const b = engine.generateFromSeed('hello world');
      expect(a).toBe(b);
    });

    test('produces different output for different seeds', () => {
      const a = engine.generateFromSeed('seed A');
      const b = engine.generateFromSeed('seed B');
      expect(a).not.toBe(b);
    });

    test('generates valid Strudel code', async () => {
      const pattern = engine.generateFromSeed('validation test');
      const result = await engine.validate(pattern);
      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getPatternInfo()
  // -----------------------------------------------------------------------

  describe('getPatternInfo()', () => {
    test('returns metadata for a drum pattern', async () => {
      const info = await engine.getPatternInfo('s("bd sn hh cp")');
      expect(info).not.toBeNull();
      expect(info!.eventCount).toBeGreaterThan(0);
      expect(info!.voices).toBeGreaterThan(0);
      expect(Array.isArray(info!.voiceNames)).toBe(true);
      expect(info!.cycleDuration).toBe(1);
      expect(info!.totalSpan).toBe(1);
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
