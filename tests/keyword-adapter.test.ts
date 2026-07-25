import { describe, test, expect, beforeEach } from 'bun:test';
import { KeywordAdapter } from '../src/agent/KeywordAdapter';
import { ToolExecutor } from '../src/agent/ToolExecutor';
import { PatternOwner } from '../src/pattern/PatternOwner';

describe('KeywordAdapter', () => {
  let adapter: KeywordAdapter;
  let executor: ToolExecutor;
  let patterns: PatternOwner;

  beforeEach(() => {
    patterns = new PatternOwner('');
    executor = new ToolExecutor(patterns);
    adapter = new KeywordAdapter(executor, patterns);
  });

  describe('intent routing', () => {
    test('"play" returns a play action', async () => {
      const response = await adapter.processMessage('play');
      expect(response.action).toBe('play');
    });

    test('"start" also triggers play', async () => {
      const response = await adapter.processMessage('start');
      expect(response.action).toBe('play');
    });

    test('"go" also triggers play', async () => {
      const response = await adapter.processMessage('go');
      expect(response.action).toBe('play');
    });

    test('"stop" returns a stop action', async () => {
      const response = await adapter.processMessage('stop');
      expect(response.action).toBe('stop');
      expect(response.message.toLowerCase()).toContain('stop');
    });

    test('"pause" also triggers stop', async () => {
      const response = await adapter.processMessage('pause');
      expect(response.action).toBe('stop');
    });

    test('"hush" also triggers stop', async () => {
      const response = await adapter.processMessage('hush');
      expect(response.action).toBe('stop');
    });

    test('"help" returns help text', async () => {
      const response = await adapter.processMessage('help');
      expect(response.action).toBe('help');
      expect(response.message).toContain('Commands');
      expect(response.message).toContain('play');
    });

    test('pattern code returns a pattern action', async () => {
      const response = await adapter.processMessage('s("bd sn")');
      expect(response.action).toBe('pattern');
      expect(response.pattern).toBe('s("bd sn")');
    });

    test('invalid pattern code returns an error', async () => {
      const response = await adapter.processMessage('s("bd sn"');
      expect(response.action).toBe('pattern');
      expect(response.error).toBeDefined();
    });

    test('"make a drum beat" returns a generate action', async () => {
      const response = await adapter.processMessage('make a drum beat');
      expect(response.action).toBe('generate');
      expect(response.pattern).toBeDefined();
      expect(response.pattern!.length).toBeGreaterThan(0);
    });

    test('"validate" with no pattern reports no pattern', async () => {
      const response = await adapter.processMessage('validate');
      expect(response.action).toBe('validate');
      expect(response.message).toContain('No pattern');
    });

    test('"undo" with no history returns nothing to undo', async () => {
      const response = await adapter.processMessage('undo');
      expect(response.action).toBe('undo');
      expect(response.message).toContain('Nothing to undo');
    });

    test('"redo" with no history returns nothing to redo', async () => {
      const response = await adapter.processMessage('redo');
      expect(response.action).toBe('redo');
      expect(response.message).toContain('Nothing to redo');
    });
  });

  describe('edit routing', () => {
    test('"edit faster" on a pattern applies the edit', async () => {
      patterns.set('s("bd sn")');
      const response = await adapter.processMessage('edit faster');
      expect(response.action).toBe('edit');
      expect(response.pattern).toContain('.fast(2)');
    });

    test('"edit" with no pattern reports no pattern', async () => {
      const response = await adapter.processMessage('edit faster');
      expect(response.action).toBe('edit');
      expect(response.error).toBeDefined();
    });
  });

  describe('undo/redo', () => {
    test('"undo" after setting a pattern reverts', async () => {
      patterns.set('first');
      patterns.set('second');
      const response = await adapter.processMessage('undo');
      expect(response.action).toBe('undo');
      expect(response.pattern).toBe('first');
    });

    test('"redo" after undo re-applies', async () => {
      patterns.set('first');
      patterns.set('second');
      adapter.processMessage('undo');
      const response = await adapter.processMessage('redo');
      expect(response.action).toBe('redo');
      expect(response.pattern).toBe('second');
    });
  });

  describe('slash commands', () => {
    test('"/play" routes to play like "play"', async () => {
      const response = await adapter.processMessage('/play');
      expect(response.action).toBe('play');
    });

    test('"/make <desc>" generates a pattern', async () => {
      const response = await adapter.processMessage('/make a techno beat');
      expect(response.action).toBe('generate');
      expect(response.pattern).toBeTruthy();
    });

    test('"/edit <instruction>" routes to edit', async () => {
      patterns.set('s("bd sn")');
      const response = await adapter.processMessage('/edit make it faster');
      expect(response.action).toBe('edit');
    });

    test('"/help" shows help, not an invalid pattern error', async () => {
      const response = await adapter.processMessage('/help');
      expect(response.action).toBe('help');
      expect(response.error).toBeUndefined();
    });
  });

  describe('load and list', () => {
    test('"list" returns available patterns', async () => {
      const response = await adapter.processMessage('list');
      expect(response.action).toBe('list');
      expect(response.message).toContain('acid');
    });

    test('"load acid" loads the built-in pattern', async () => {
      const response = await adapter.processMessage('load acid');
      expect(response.action).toBe('load');
      expect(response.error).toBeUndefined();
      expect(patterns.currentPattern.length).toBeGreaterThan(0);
    });

    test('"/load acid" works with the slash prefix', async () => {
      const response = await adapter.processMessage('/load acid');
      expect(response.action).toBe('load');
      expect(response.error).toBeUndefined();
    });

    test('loading an unknown pattern surfaces an error', async () => {
      const response = await adapter.processMessage('load no-such-pattern-xyz');
      expect(response.action).toBe('load');
      expect(response.error).toBeDefined();
    });
  });
});
