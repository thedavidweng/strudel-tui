import { describe, test, expect } from 'bun:test';
import { Agent } from '../src/agent/Agent';
import { DiffGenerator } from '../src/agent/DiffGenerator';
import { formatHelp, COMMANDS, KEYBOARD_SHORTCUTS, EXAMPLES } from '../src/agent/HelpText';

describe('Agent', () => {
  // -----------------------------------------------------------------------
  // processUserMessage - intent routing
  // -----------------------------------------------------------------------

  describe('processUserMessage()', () => {
    test('"play" returns a play action', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('play');
      expect(response.action).toBe('play');
      expect(response.pattern).toBeDefined();
    });

    test('"start" also triggers play', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('start');
      expect(response.action).toBe('play');
    });

    test('"go" also triggers play', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('go');
      expect(response.action).toBe('play');
    });

    test('"stop" returns a stop action', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('stop');
      expect(response.action).toBe('stop');
      expect(response.message.toLowerCase()).toContain('stop');
    });

    test('"pause" also triggers stop', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('pause');
      expect(response.action).toBe('stop');
    });

    test('"hush" also triggers stop', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('hush');
      expect(response.action).toBe('stop');
    });

    test('"help" returns help text', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('help');
      expect(response.action).toBe('help');
      expect(response.message).toContain('Commands');
      expect(response.message).toContain('play');
      expect(response.message).toContain('Keyboard Shortcuts');
    });

    test('pattern code returns an evaluate action', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const code = 's("bd sn")';
      const response = await agent.processUserMessage(code);
      expect(response.action).toBe('pattern');
      expect(response.pattern).toBe(code);
    });

    test('invalid pattern code returns an error', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('s("bd sn"');
      expect(response.action).toBe('pattern');
      expect(response.error).toBeDefined();
    });

    test('"generate" returns a generate action with a pattern', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('make a drum beat');
      expect(response.action).toBe('generate');
      expect(response.pattern).toBeDefined();
      expect(response.pattern!.length).toBeGreaterThan(0);
    });

    test('"validate" with no pattern reports no pattern', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('validate');
      expect(response.action).toBe('validate');
      expect(response.message).toContain('No pattern');
    });

    test('"undo" with no history returns nothing to undo', async () => {
      const agent = new Agent('', undefined, { apiKey: '' });
      const response = await agent.processUserMessage('undo');
      expect(response.action).toBe('undo');
      expect(response.message).toContain('Nothing to undo');
    });
  });
});

describe('DiffGenerator', () => {
  const gen = new DiffGenerator();

  test('computeDiff returns a unified diff string', () => {
    const result = gen.computeDiff('line1\nline2', 'line1\nline3');
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('@@');
    expect(result.additions).toBeGreaterThanOrEqual(0);
    expect(result.removals).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.lines)).toBe(true);
  });

  test('computeDiff with identical input returns empty text', () => {
    const result = gen.computeDiff('same\ntext', 'same\ntext');
    // No changes means empty diff
    expect(result.text).toBe('');
    expect(result.additions).toBe(0);
    expect(result.removals).toBe(0);
  });

  test('computeDiff detects additions', () => {
    const result = gen.computeDiff('a', 'a\nb');
    expect(result.additions).toBeGreaterThan(0);
    expect(result.text).toContain('+b');
  });

  test('computeDiff detects removals', () => {
    const result = gen.computeDiff('a\nb', 'a');
    expect(result.removals).toBeGreaterThan(0);
    expect(result.text).toContain('-b');
  });

  test('applyDiff can round-trip a computed diff', () => {
    const old = 'hello\nworld';
    const updated = 'hello\nuniverse';
    const diff = gen.computeDiff(old, updated);
    const patched = gen.applyDiff(old, diff.text);
    expect(patched).toBe(updated);
  });
});

describe('HelpText', () => {
  test('formatHelp returns a string with commands and shortcuts', () => {
    const help = formatHelp();
    expect(help).toContain('Commands');
    expect(help).toContain('play');
    expect(help).toContain('stop');
    expect(help).toContain('Keyboard Shortcuts');
    expect(help).toContain('Ctrl+P');
    expect(help).toContain('Example Patterns');
  });

  test('COMMANDS array is non-empty', () => {
    expect(COMMANDS.length).toBeGreaterThan(0);
  });

  test('KEYBOARD_SHORTCUTS array is non-empty', () => {
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThan(0);
  });

  test('EXAMPLES array is non-empty', () => {
    expect(EXAMPLES.length).toBeGreaterThan(0);
  });
});
