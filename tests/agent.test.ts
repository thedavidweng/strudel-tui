import { describe, test, expect } from 'bun:test';
import { Agent } from '../src/agent/Agent';
import { DiffGenerator } from '../src/agent/DiffGenerator';
import { SessionHistory } from '../src/agent/SessionHistory';
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

describe('SessionHistory', () => {
  test('addMessage stores messages', () => {
    const history = new SessionHistory('test-1');
    history.addMessage('user', 'hello');
    history.addMessage('agent', 'hi there');
    const msgs = history.getHistory();
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hello');
    expect(msgs[1].role).toBe('agent');
    expect(msgs[1].content).toBe('hi there');
  });

  test('getRecent returns last N messages', () => {
    const history = new SessionHistory('test-2');
    for (let i = 0; i < 5; i++) {
      history.addMessage('user', `msg-${i}`);
    }
    const recent = history.getRecent(3);
    expect(recent.length).toBe(3);
    expect(recent[0].content).toBe('msg-2');
    expect(recent[2].content).toBe('msg-4');
  });

  test('clearMessages empties the history', () => {
    const history = new SessionHistory('test-3');
    history.addMessage('user', 'hello');
    history.clearMessages();
    expect(history.getHistory().length).toBe(0);
  });

  test('pushPattern and getCurrentPattern', () => {
    const history = new SessionHistory('test-4');
    history.pushPattern('s("bd")');
    expect(history.getCurrentPattern()).toBe('s("bd")');
  });

  test('undoPattern returns previous pattern', () => {
    const history = new SessionHistory('test-5');
    history.pushPattern('first');
    history.pushPattern('second');
    expect(history.undoPattern()).toBe('first');
    expect(history.getCurrentPattern()).toBe('first');
  });

  test('undoPattern returns undefined at earliest version', () => {
    const history = new SessionHistory('test-6');
    history.pushPattern('only');
    expect(history.undoPattern()).toBeUndefined();
  });

  test('redoPattern re-applies after undo', () => {
    const history = new SessionHistory('test-7');
    history.pushPattern('first');
    history.pushPattern('second');
    history.undoPattern();
    expect(history.redoPattern()).toBe('second');
    expect(history.getCurrentPattern()).toBe('second');
  });

  test('redoPattern returns undefined at latest version', () => {
    const history = new SessionHistory('test-8');
    history.pushPattern('only');
    expect(history.redoPattern()).toBeUndefined();
  });

  test('pushPattern after undo discards forward history', () => {
    const history = new SessionHistory('test-9');
    history.pushPattern('a');
    history.pushPattern('b');
    history.pushPattern('c');
    history.undoPattern(); // back to b
    history.pushPattern('d'); // should discard c
    expect(history.getCurrentPattern()).toBe('d');
    expect(history.redoPattern()).toBeUndefined();
  });

  test('canUndo and canRedo reflect state', () => {
    const history = new SessionHistory('test-10');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.pushPattern('a');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.pushPattern('b');
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    history.undoPattern();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  test('patternCount tracks stack size', () => {
    const history = new SessionHistory('test-11');
    expect(history.patternCount()).toBe(0);
    history.pushPattern('a');
    expect(history.patternCount()).toBe(1);
    history.pushPattern('b');
    expect(history.patternCount()).toBe(2);
  });

  test('save does not throw on persistence failure', async () => {
    // SessionHistory.save catches errors internally and logs a warning.
    // We can't easily mock node:fs/promises in Bun, but we can verify
    // that save() resolves without throwing even if the filesystem is
    // not writable (e.g. in CI environments with restricted home dirs).
    const history = new SessionHistory('test-save-error');
    history.addMessage('user', 'test');
    history.pushPattern('s("bd")');
    // This should resolve, not reject — even if the directory creation fails
    await expect(history.save()).resolves.toBeUndefined();
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
