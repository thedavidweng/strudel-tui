import { describe, test, expect, beforeEach } from 'bun:test';
import { ToolExecutor, type AudioControl } from '../src/agent/ToolExecutor';
import { PatternOwner } from '../src/pattern/PatternOwner';

function createMockAudio(): AudioControl & { calls: { play: string[]; stop: number } } {
  return {
    calls: { play: [], stop: 0 },
    async play(code: string) { this.calls.play.push(code); return 'playing' as const; },
    async stop() { this.calls.stop++; },
  };
}

describe('ToolExecutor', () => {
  let patterns: PatternOwner;
  let executor: ToolExecutor;

  beforeEach(() => {
    patterns = new PatternOwner('');
    executor = new ToolExecutor(patterns);
  });

  describe('executeTool', () => {
    test('set_pattern validates and sets the pattern', async () => {
      const result = await executor.executeTool('set_pattern', { code: 's("bd sn")' });
      expect(result).toContain('Pattern set');
      expect(patterns.currentPattern).toBe('s("bd sn")');
    });

    test('set_pattern rejects invalid code', async () => {
      const result = await executor.executeTool('set_pattern', { code: 's("bd sn"' });
      expect(result).toContain('Invalid');
      expect(patterns.currentPattern).toBe('');
    });

    test('validate_pattern returns valid for good code', async () => {
      const result = await executor.executeTool('validate_pattern', { code: 's("bd sn")' });
      expect(result).toContain('Valid');
    });

    test('validate_pattern returns invalid for bad code', async () => {
      const result = await executor.executeTool('validate_pattern', { code: 's("bd sn"' });
      expect(result).toContain('Invalid');
    });

    test('generate_pattern creates and sets a pattern', async () => {
      const result = await executor.executeTool('generate_pattern', { description: 'a drum beat' });
      expect(result).toContain('Generated');
      expect(patterns.currentPattern.length).toBeGreaterThan(0);
    });

    test('get_pattern_info returns info for a valid pattern', async () => {
      patterns.set('s("bd sn")');
      const result = await executor.executeTool('get_pattern_info', {});
      expect(result).toContain('events');
    });

    test('get_pattern_info reports no pattern when empty', async () => {
      const result = await executor.executeTool('get_pattern_info', {});
      expect(result).toContain('No pattern');
    });

    test('play_pattern with code sets the pattern', async () => {
      const result = await executor.executeTool('play_pattern', { code: 's("bd")' });
      expect(result).toContain('Pattern set');
      expect(patterns.currentPattern).toBe('s("bd")');
    });

    test('play_pattern without code reports current pattern', async () => {
      patterns.set('s("bd")');
      const result = await executor.executeTool('play_pattern', {});
      expect(result).toContain('Playing: s("bd")');
    });

    test('stop_playback returns stopped message', async () => {
      const result = await executor.executeTool('stop_playback', {});
      expect(result).toContain('stopped');
    });

    test('unknown tool returns error', async () => {
      const result = await executor.executeTool('nonexistent_tool', {});
      expect(result).toContain('Unknown tool');
    });
  });

  describe('edit_pattern tool', () => {
    test('with instruction applies heuristic edit', async () => {
      patterns.set('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', { instruction: 'faster' });
      expect(result).toContain('edited');
      expect(patterns.currentPattern).toContain('.fast(2)');
    });

    test('with code fragment validates and sets directly', async () => {
      patterns.set('s("bd sn")');
      const newCode = 's("bd sn").room(0.7).delay(0.3)';
      const result = await executor.executeTool('edit_pattern', { code: newCode });
      expect(result).toContain('edited');
      expect(patterns.currentPattern).toBe(newCode);
    });

    test('with code fragment rejects invalid code', async () => {
      patterns.set('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', { code: 's("bd sn".room(' });
      expect(result).toContain('Invalid');
      expect(patterns.currentPattern).toBe('s("bd sn")');
    });

    test('with neither code nor instruction returns error', async () => {
      patterns.set('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', {});
      expect(result).toContain('Could not apply');
    });

    test('rejects unrecognized instruction', async () => {
      patterns.set('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', { instruction: 'make it purple' });
      expect(result).toContain('Could not apply');
    });
  });

  describe('audio wiring', () => {
    test('stop_playback calls audio.stop()', async () => {
      const audio = createMockAudio();
      const po = new PatternOwner('');
      const ex = new ToolExecutor(po, audio);
      await ex.executeTool('stop_playback', {});
      expect(audio.calls.stop).toBe(1);
    });

    test('play_pattern with code calls audio.play()', async () => {
      const audio = createMockAudio();
      const po = new PatternOwner('');
      const ex = new ToolExecutor(po, audio);
      await ex.executeTool('play_pattern', { code: 's("bd")' });
      expect(audio.calls.play.length).toBe(1);
      expect(audio.calls.play[0]).toBe('s("bd")');
    });

    test('play_pattern without code calls audio.play() with current pattern', async () => {
      const audio = createMockAudio();
      const po = new PatternOwner('s("sn")');
      const ex = new ToolExecutor(po, audio);
      await ex.executeTool('play_pattern', {});
      expect(audio.calls.play.length).toBe(1);
      expect(audio.calls.play[0]).toBe('s("sn")');
    });

    test('stop_playback works without audio (no crash)', async () => {
      const po = new PatternOwner('');
      const ex = new ToolExecutor(po);
      const result = await ex.executeTool('stop_playback', {});
      expect(result).toContain('stopped');
    });
  });
});
