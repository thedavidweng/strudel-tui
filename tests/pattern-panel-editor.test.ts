import { describe, test, expect, beforeEach } from 'bun:test';
import { Key, matchesKey } from '@earendil-works/pi-tui';
import { PatternPanel } from '../src/tui/PatternPanel';

const KEY = {
  up:        '\x1b[A',
  down:      '\x1b[B',
  right:     '\x1b[C',
  left:      '\x1b[D',
  backspace: '\x7f',
  delete:    '\x1b[3~',
  enter:     '\r',
};

describe('key-data sanity', () => {
  test('arrow sequences match Key identifiers', () => {
    expect(matchesKey(KEY.up,        Key.up)).toBe(true);
    expect(matchesKey(KEY.down,      Key.down)).toBe(true);
    expect(matchesKey(KEY.right,     Key.right)).toBe(true);
    expect(matchesKey(KEY.left,      Key.left)).toBe(true);
    expect(matchesKey(KEY.backspace, Key.backspace)).toBe(true);
    expect(matchesKey(KEY.delete,    Key.delete)).toBe(true);
    expect(matchesKey(KEY.enter,     Key.enter)).toBe(true);
  });
});

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function lineContent(renderedLine: string): string {
  const stripped = stripAnsi(renderedLine);
  const match = stripped.match(/│\s*\d+\s*│\s*(.*?)\s*│$/);
  return match ? match[1]! : stripped;
}

describe('PatternPanel edit mode', () => {
  let panel: PatternPanel;

  beforeEach(() => {
    panel = new PatternPanel();
  });

  describe('enterEditMode', () => {
    test('sets editMode to true', () => {
      panel.setPattern('s("bd sn")');
      panel.enterEditMode();
      expect(panel.editMode).toBe(true);
    });

    test('copies pattern into editable buffer (render shows same content)', () => {
      const pattern = 's("bd sn").lpf(800)';
      panel.setPattern(pattern);
      panel.enterEditMode();
      const rendered = panel.render(60);
      // Line 1 (index 1, after top border) should contain the pattern text
      const content = lineContent(rendered[1]!);
      expect(content).toContain('s("bd sn").lpf(800)');
    });

    test('sets cursor to end of last line', () => {
      panel.setPattern('line one\nline two');
      panel.enterEditMode();
      panel.handleInput('!');
      const rendered = panel.render(60);
      const lastLineContent = lineContent(rendered[2]!); // line two is rendered at index 2
      expect(lastLineContent).toContain('line two!');
    });

    test('works with empty pattern', () => {
      panel.setPattern('');
      panel.enterEditMode();
      expect(panel.editMode).toBe(true);
      panel.handleInput('x');
      const rendered = panel.render(60);
      const content = lineContent(rendered[1]!);
      expect(content).toContain('x');
    });
  });

  describe('exitEditMode(true) — apply', () => {
    test('sets editMode to false', () => {
      panel.setPattern('original');
      panel.enterEditMode();
      panel.exitEditMode(true);
      expect(panel.editMode).toBe(false);
    });

    test('pattern is updated to buffer content', () => {
      panel.setPattern('original');
      panel.enterEditMode();
      panel.handleInput('!');
      panel.exitEditMode(true);
      const rendered = panel.render(60);
      const content = lineContent(rendered[1]!);
      expect(content).toContain('original!');
    });

    test('returns the applied pattern string', () => {
      panel.setPattern('hello');
      panel.enterEditMode();
      panel.handleInput('!');
      const result = panel.exitEditMode(true);
      expect(result).toBe('hello!');
    });
  });

  describe('exitEditMode(false) — discard', () => {
    test('sets editMode to false', () => {
      panel.setPattern('original');
      panel.enterEditMode();
      panel.handleInput('!');
      panel.exitEditMode(false);
      expect(panel.editMode).toBe(false);
    });

    test('pattern is restored to original', () => {
      panel.setPattern('original');
      panel.enterEditMode();
      panel.handleInput('!');
      panel.exitEditMode(false);
      const rendered = panel.render(60);
      const content = lineContent(rendered[1]!);
      expect(content).toContain('original');
      expect(content).not.toContain('original!');
    });

    test('returns the original pattern string', () => {
      panel.setPattern('hello');
      panel.enterEditMode();
      panel.handleInput('!');
      const result = panel.exitEditMode(false);
      expect(result).toBe('hello');
    });
  });

  describe('handleInput — character insertion', () => {
    test('inserting a character at end of line appends it', () => {
      panel.setPattern('abc');
      panel.enterEditMode();
      panel.handleInput('d');
      const result = panel.exitEditMode(true);
      expect(result).toBe('abcd');
    });

    test('inserting a character in the middle of a line inserts it', () => {
      panel.setPattern('ac');
      panel.enterEditMode();
      panel.handleInput(KEY.left);
      panel.handleInput('b');
      const result = panel.exitEditMode(true);
      expect(result).toBe('abc');
    });
  });

  describe('handleInput — arrow keys', () => {
    test('left/right moves cursor', () => {
      panel.setPattern('abcde');
      panel.enterEditMode();
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput('X');
      const result = panel.exitEditMode(true);
      expect(result).toBe('abcXde');
    });

    test('up/down moves between lines', () => {
      panel.setPattern('first\nsecond\nthird');
      panel.enterEditMode();
      panel.handleInput(KEY.up);
      panel.handleInput('!');
      const result = panel.exitEditMode(true);
      const lines = result.split('\n');
      expect(lines[0]).toBe('first');
      expect(lines[1]).toBe('second!');
      expect(lines[2]).toBe('third');
    });
  });

  describe('handleInput — backspace', () => {
    test('deletes char before cursor', () => {
      panel.setPattern('abc');
      panel.enterEditMode();
      panel.handleInput(KEY.backspace);
      const result = panel.exitEditMode(true);
      expect(result).toBe('ab');
    });

    test('at col 0, joins with previous line', () => {
      panel.setPattern('first\nsecond');
      panel.enterEditMode();
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.backspace);
      const result = panel.exitEditMode(true);
      expect(result).toBe('firstsecond');
    });
  });

  describe('handleInput — delete', () => {
    test('deletes char at cursor', () => {
      panel.setPattern('abc');
      panel.enterEditMode();
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.delete);
      const result = panel.exitEditMode(true);
      expect(result).toBe('ac');
    });

    test('at end of line, joins with next line', () => {
      panel.setPattern('first\nsecond');
      panel.enterEditMode();
      panel.handleInput(KEY.up);
      panel.handleInput(KEY.delete);
      const result = panel.exitEditMode(true);
      expect(result).toBe('firstsecond');
    });
  });

  describe('handleInput — enter', () => {
    test('splits line at cursor position', () => {
      panel.setPattern('abcdef');
      panel.enterEditMode();
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.left);
      panel.handleInput(KEY.enter);
      const result = panel.exitEditMode(true);
      expect(result).toBe('abc\ndef');
    });
  });

  describe('handleInput — unknown keys', () => {
    test('returns false for unknown keys', () => {
      panel.setPattern('test');
      panel.enterEditMode();
      // Ctrl+G is not handled by the editor
      const consumed = panel.handleInput('\x07');
      expect(consumed).toBe(false);
    });
  });
});

describe('render in edit mode', () => {
  let panel: PatternPanel;

  beforeEach(() => {
    panel = new PatternPanel();
    panel.setPattern('s("bd sn").lpf(800)');
    panel.enterEditMode();
  });

  test('shows editing label in title when in edit mode', () => {
    const rendered = panel.render(80);
    const allText = rendered.map(stripAnsi).join('\n');
    expect(allText).toContain('editing');
  });

  test('shows help bar in edit mode', () => {
    const rendered = panel.render(80);
    const allText = rendered.map(stripAnsi).join('\n');
    expect(allText).toContain('Save&Exit');
    expect(allText).toContain('Discard');
  });

  test('shows > indicator on current line in edit mode', () => {
    const rendered = panel.render(80);
    const cursorLine = rendered[1]!; // index 0 is top border, index 1 is first content line
    expect(cursorLine).toContain('>');
  });

  test('shows cursor character on current line', () => {
    const rendered = panel.render(80);
    const cursorLine = rendered[1]!;
    const stripped = stripAnsi(cursorLine);
    // In TTY, chalk.inverse wraps it in ESC[7m; in non-TTY, it's plain text
    expect(stripped).toContain('s("bd sn").lpf(800)');
  });

  test('does not show editing label when not in edit mode', () => {
    const normalPanel = new PatternPanel();
    normalPanel.setPattern('s("bd sn")');
    const rendered = normalPanel.render(80);
    const allText = rendered.map(stripAnsi).join('\n');
    expect(allText).not.toContain('editing');
  });

  test('does not show help bar when not in edit mode', () => {
    const normalPanel = new PatternPanel();
    normalPanel.setPattern('s("bd sn")');
    const rendered = normalPanel.render(80);
    const allText = rendered.map(stripAnsi).join('\n');
    expect(allText).not.toContain('Save&Exit');
  });
});
