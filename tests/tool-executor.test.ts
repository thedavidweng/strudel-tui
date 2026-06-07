import { describe, test, expect, beforeEach } from 'bun:test';
import { ToolExecutor, type AudioControl } from '../src/agent/ToolExecutor';
import { SessionHistory } from '../src/agent/SessionHistory';

function createMockAudio(): AudioControl & { calls: { play: string[]; stop: number } } {
  return {
    calls: { play: [], stop: 0 },
    async play(code: string) { this.calls.play.push(code); },
    async stop() { this.calls.stop++; },
  };
}

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    const history = new SessionHistory('test-tool-executor');
    executor = new ToolExecutor('', history);
  });

  // -------------------------------------------------------------------------
  // Pattern management
  // -------------------------------------------------------------------------

  describe('pattern management', () => {
    test('currentPattern returns the initial pattern', () => {
      expect(executor.currentPattern).toBe('');
    });

    test('setPattern updates currentPattern', () => {
      executor.setPattern('s("bd sn")');
      expect(executor.currentPattern).toBe('s("bd sn")');
    });

    test('setPattern with initial value in constructor', () => {
      const history = new SessionHistory('test-tool-executor-2');
      const ex = new ToolExecutor('note("c d e f")', history);
      expect(ex.currentPattern).toBe('note("c d e f")');
    });
  });

  // -------------------------------------------------------------------------
  // Tool dispatch
  // -------------------------------------------------------------------------

  describe('executeTool', () => {
    test('set_pattern validates and sets the pattern', async () => {
      const result = await executor.executeTool('set_pattern', { code: 's("bd sn")' });
      expect(result).toContain('Pattern set');
      expect(executor.currentPattern).toBe('s("bd sn")');
    });

    test('set_pattern rejects invalid code', async () => {
      const result = await executor.executeTool('set_pattern', { code: 's("bd sn"' });
      expect(result).toContain('Invalid');
      expect(executor.currentPattern).toBe('');
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
      expect(executor.currentPattern.length).toBeGreaterThan(0);
    });

    test('get_pattern_info returns info for a valid pattern', async () => {
      executor.setPattern('s("bd sn")');
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
      expect(executor.currentPattern).toBe('s("bd")');
    });

    test('play_pattern without code reports current pattern', async () => {
      executor.setPattern('s("bd")');
      const result = await executor.executeTool('play_pattern', {});
      expect(result).toContain('Playing current pattern');
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

  // -------------------------------------------------------------------------
  // Edit heuristics (keyword mode)
  // -------------------------------------------------------------------------

  describe('applyEditHeuristic', () => {
    test('faster appends .fast(2)', () => {
      const result = executor.applyEditHeuristic('s("bd sn")', 'faster');
      expect(result).toBe('s("bd sn").fast(2)');
    });

    test('slower appends .slow(2)', () => {
      const result = executor.applyEditHeuristic('s("bd sn")', 'slower');
      expect(result).toBe('s("bd sn").slow(2)');
    });

    test('reverb appends .room(0.5)', () => {
      const result = executor.applyEditHeuristic('s("bd sn")', 'add reverb');
      expect(result).toBe('s("bd sn").room(0.5)');
    });

    test('remove last removes the last transform', () => {
      const result = executor.applyEditHeuristic('s("bd sn").fast(2)', 'remove last');
      expect(result).toBe('s("bd sn")');
    });

    test('unrecognized instruction returns pattern unchanged', () => {
      const pattern = 's("bd sn")';
      const result = executor.applyEditHeuristic(pattern, 'make it purple');
      expect(result).toBe(pattern);
    });
  });

  // -------------------------------------------------------------------------
  // edit_pattern tool (current behavior: uses heuristic)
  // -------------------------------------------------------------------------

  describe('edit_pattern tool', () => {
    test('with instruction applies heuristic edit', async () => {
      executor.setPattern('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', { instruction: 'faster' });
      expect(result).toContain('edited');
      expect(executor.currentPattern).toContain('.fast(2)');
    });

    test('with code fragment validates and sets directly', async () => {
      executor.setPattern('s("bd sn")');
      const newCode = 's("bd sn").room(0.7).delay(0.3)';
      const result = await executor.executeTool('edit_pattern', { code: newCode });
      expect(result).toContain('edited');
      expect(executor.currentPattern).toBe(newCode);
    });

    test('with code fragment rejects invalid code', async () => {
      executor.setPattern('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', { code: 's("bd sn".room(' });
      expect(result).toContain('Invalid');
      expect(executor.currentPattern).toBe('s("bd sn")');
    });

    test('with neither code nor instruction returns error', async () => {
      executor.setPattern('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', {});
      expect(result).toContain('Could not apply');
    });

    test('rejects unrecognized instruction', async () => {
      executor.setPattern('s("bd sn")');
      const result = await executor.executeTool('edit_pattern', { instruction: 'make it purple' });
      expect(result).toContain('Could not apply');
    });
  });

  // -------------------------------------------------------------------------
  // Audio wiring (Slice 5)
  // -------------------------------------------------------------------------

  describe('audio wiring', () => {
    test('stop_playback calls audio.stop()', async () => {
      const audio = createMockAudio();
      const history = new SessionHistory('test-audio');
      const ex = new ToolExecutor('', history, audio);
      await ex.executeTool('stop_playback', {});
      expect(audio.calls.stop).toBe(1);
    });

    test('play_pattern with code calls audio.play()', async () => {
      const audio = createMockAudio();
      const history = new SessionHistory('test-audio');
      const ex = new ToolExecutor('', history, audio);
      await ex.executeTool('play_pattern', { code: 's("bd")' });
      expect(audio.calls.play.length).toBe(1);
      expect(audio.calls.play[0]).toBe('s("bd")');
    });

    test('play_pattern without code calls audio.play() with current pattern', async () => {
      const audio = createMockAudio();
      const history = new SessionHistory('test-audio');
      const ex = new ToolExecutor('s("sn")', history, audio);
      await ex.executeTool('play_pattern', {});
      expect(audio.calls.play.length).toBe(1);
      expect(audio.calls.play[0]).toBe('s("sn")');
    });

    test('stop_playback works without audio (no crash)', async () => {
      const history = new SessionHistory('test-no-audio');
      const ex = new ToolExecutor('', history);
      const result = await ex.executeTool('stop_playback', {});
      expect(result).toContain('stopped');
    });
  });
});
