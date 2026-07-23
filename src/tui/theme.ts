import type { MarkdownTheme, EditorTheme } from '@earendil-works/pi-tui';
import chalk from 'chalk';

export interface ColorPalette {
  primary: string;
  accent: string;

  text: string;
  textStrong: string;
  textDim: string;
  textMuted: string;

  border: string;
  borderFocus: string;

  success: string;
  warning: string;
  error: string;

  roleUser: string;
  roleAssistant: string;
  roleTool: string;

  playing: string;
  stopped: string;
  bpm: string;
  pattern: string;
}

const dark: ColorPalette = {
  primary: '#E07C4F',
  accent: '#C96B3C',

  text: '#C5C5C5',
  textStrong: '#E8E8E8',
  textDim: '#7A7A7A',
  textMuted: '#555555',

  border: '#3A3A3A',
  borderFocus: '#E07C4F',

  success: '#5BA86B',
  warning: '#D4A24C',
  error: '#D4524C',

  roleUser: '#E8A85C',
  roleAssistant: '#C5C5C5',
  roleTool: '#D4A24C',

  playing: '#5BA86B',
  stopped: '#D4524C',
  bpm: '#D4A24C',
  pattern: '#E07C4F',
};

const light: ColorPalette = {
  primary: '#B85C2F',
  accent: '#9A4A20',

  text: '#2A2A2A',
  textStrong: '#1A1A1A',
  textDim: '#666666',
  textMuted: '#999999',

  border: '#D0D0D0',
  borderFocus: '#B85C2F',

  success: '#2E7D32',
  warning: '#9A6D00',
  error: '#C62828',

  roleUser: '#9A6D00',
  roleAssistant: '#2A2A2A',
  roleTool: '#9A6D00',

  playing: '#2E7D32',
  stopped: '#C62828',
  bpm: '#9A6D00',
  pattern: '#B85C2F',
};

export type Theme = 'dark' | 'light';

export function getPalette(theme: Theme = 'dark'): ColorPalette {
  return theme === 'dark' ? dark : light;
}

export const colors: ColorPalette = dark;

export const BRAILLE_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const HEADING_HASH_PREFIX = /^((?:\[[0-9;]*m)*)#{1,6}[ \t]+/;

export function createMarkdownTheme(palette: ColorPalette): MarkdownTheme {
  const stripHash = (text: string): string => text.replace(HEADING_HASH_PREFIX, '$1');
  const muted = chalk.hex(palette.textMuted);
  const dim = chalk.hex(palette.textDim);
  const border = chalk.hex(palette.border);

  return {
    heading: (text: string) => chalk.bold.hex(palette.text)(stripHash(text)),
    link: (text: string) => chalk.hex(palette.primary)(text),
    linkUrl: (text: string) => muted(text),
    code: (text: string) => chalk.hex(palette.primary)(text),
    codeBlock: (text: string) => text,
    codeBlockBorder: (text: string) => muted(text),
    quote: (text: string) => dim(text),
    quoteBorder: (text: string) => dim(text),
    hr: (text: string) => border(text),
    listBullet: (text: string) => chalk.hex(palette.roleAssistant)(text.replace(/^-/, '•')),
    bold: (text: string) => chalk.bold(text),
    italic: (text: string) => chalk.italic(text),
    strikethrough: (text: string) => chalk.strikethrough(text),
    underline: (text: string) => chalk.underline(text),
  };
}

export function createEditorTheme(palette: ColorPalette): EditorTheme {
  const muted = chalk.hex(palette.textMuted);
  return {
    borderColor: (s: string) => chalk.hex(palette.border)(s),
    selectList: {
      selectedPrefix: (s: string) => chalk.hex(palette.primary)(s),
      selectedText: (s: string) => chalk.hex(palette.primary)(s),
      description: (s: string) => muted(s),
      scrollInfo: (s: string) => muted(s),
      noMatch: (s: string) => muted(s),
    },
  };
}
