import { describe, test, expect } from 'bun:test';
import { getPalette, colors, createMarkdownTheme, createEditorTheme } from '../src/tui/theme';

describe('getPalette', () => {
  test('returns dark palette by default', () => {
    const palette = getPalette();
    expect(palette.primary).toBe('#E07C4F');
    expect(palette.text).toBe('#C5C5C5');
  });

  test('returns dark palette when explicitly requested', () => {
    const palette = getPalette('dark');
    expect(palette).toEqual(getPalette());
  });

  test('returns light palette when requested', () => {
    const palette = getPalette('light');
    expect(palette.primary).toBe('#B85C2F');
    expect(palette.text).toBe('#2A2A2A');
  });

  test('dark and light palettes have the same keys', () => {
    const dark = getPalette('dark');
    const light = getPalette('light');
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
});

describe('colors (default export)', () => {
  test('is the dark palette', () => {
    expect(colors).toEqual(getPalette('dark'));
  });

  test('has all required ColorPalette fields', () => {
    const requiredKeys = [
      'primary', 'accent',
      'text', 'textStrong', 'textDim', 'textMuted',
      'border', 'borderFocus',
      'success', 'warning', 'error',
      'roleUser', 'roleAssistant', 'roleTool',
      'playing', 'stopped', 'bpm', 'pattern',
    ];
    for (const key of requiredKeys) {
      expect(colors).toHaveProperty(key);
      expect(typeof (colors as any)[key]).toBe('string');
    }
  });

  test('all color values are valid hex', () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    for (const [, value] of Object.entries(colors)) {
      expect(value).toMatch(hexRe);
    }
  });
});

describe('createMarkdownTheme', () => {
  test('returns an object with all expected keys', () => {
    const theme = createMarkdownTheme(colors);
    const expectedKeys = [
      'heading', 'link', 'linkUrl', 'code', 'codeBlock', 'codeBlockBorder',
      'quote', 'quoteBorder', 'hr', 'listBullet', 'bold', 'italic',
      'strikethrough', 'underline',
    ];
    for (const key of expectedKeys) {
      expect(theme).toHaveProperty(key);
      expect(typeof (theme as any)[key]).toBe('function');
    }
  });

  test('each adapter returns a string', () => {
    const theme = createMarkdownTheme(colors);
    for (const [, fn] of Object.entries(theme)) {
      const result = (fn as (s: string) => string)('test');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test('heading strips hash prefix', () => {
    const theme = createMarkdownTheme(colors);
    const result = theme.heading('### My Heading');
    expect(result).toContain('My Heading');
  });

  test('listBullet replaces dash with bullet', () => {
    const theme = createMarkdownTheme(colors);
    const result = theme.listBullet('- item');
    expect(result).toContain('•');
  });
});

describe('createEditorTheme', () => {
  test('returns an object with expected structure', () => {
    const theme = createEditorTheme(colors);
    expect(theme).toHaveProperty('borderColor');
    expect(theme).toHaveProperty('selectList');
    expect(typeof theme.borderColor).toBe('function');
  });

  test('selectList has all required sub-functions', () => {
    const theme = createEditorTheme(colors);
    const expectedKeys = ['selectedPrefix', 'selectedText', 'description', 'scrollInfo', 'noMatch'];
    for (const key of expectedKeys) {
      expect(theme.selectList).toHaveProperty(key);
      expect(typeof (theme.selectList as any)[key]).toBe('function');
    }
  });

  test('each adapter returns a string', () => {
    const theme = createEditorTheme(colors);
    expect(typeof theme.borderColor('x')).toBe('string');
    for (const fn of Object.values(theme.selectList)) {
      expect(typeof fn('x')).toBe('string');
    }
  });
});
