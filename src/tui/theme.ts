/**
 * Centralized theme — warm palette matching Strudel's identity.
 *
 * Two layers:
 *  - raw palettes (dark / light) with shared hex constants
 *  - exported `colors` (default dark) and `getPalette()` for theme resolution
 *    consumed by every UI component via chalk.hex(...)
 *
 * Also provides pi-tui adapters: createMarkdownTheme() and createEditorTheme().
 */

import type { MarkdownTheme, EditorTheme } from '@earendil-works/pi-tui';
import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Semantic color palette
// ---------------------------------------------------------------------------

export interface ColorPalette {
  // Brand
  primary: string;
  accent: string;

  // Text
  text: string;
  textStrong: string;
  textDim: string;
  textMuted: string;

  // Surface
  border: string;
  borderFocus: string;

  // State
  success: string;
  warning: string;
  error: string;

  // Roles
  roleUser: string;
  roleAssistant: string;
  roleTool: string;

  // Strudel-specific
  playing: string;
  stopped: string;
  bpm: string;
  pattern: string;
}

// ---------------------------------------------------------------------------
// Dark palette — warm orange/amber tones
// ---------------------------------------------------------------------------

const dark: ColorPalette = {
  primary: '#E07C4F',    // warm orange (Strudel identity)
  accent: '#C96B3C',     // deeper orange

  text: '#C5C5C5',       // soft white, not harsh
  textStrong: '#E8E8E8', // bright for emphasis
  textDim: '#7A7A7A',    // readable dim
  textMuted: '#555555',  // subtle

  border: '#3A3A3A',     // subtle dark border
  borderFocus: '#E07C4F',

  success: '#5BA86B',    // muted green
  warning: '#D4A24C',    // warm amber
  error: '#D4524C',      // muted red

  roleUser: '#E8A85C',   // warm gold for user
  roleAssistant: '#C5C5C5',
  roleTool: '#D4A24C',   // amber for tool calls

  playing: '#5BA86B',
  stopped: '#D4524C',
  bpm: '#D4A24C',
  pattern: '#E07C4F',
};

// ---------------------------------------------------------------------------
// Light palette — darker variants for contrast on white backgrounds
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Theme resolution
// ---------------------------------------------------------------------------

export type Theme = 'dark' | 'light';

export function getPalette(theme: Theme = 'dark'): ColorPalette {
  return theme === 'dark' ? dark : light;
}

/** Convenience: default (dark) palette for direct import. */
export const colors: ColorPalette = dark;

// ---------------------------------------------------------------------------
// Shared UI constants
// ---------------------------------------------------------------------------

/** Braille spinner frames for loading/streaming indicators. */
export const BRAILLE_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ---------------------------------------------------------------------------
// pi-tui MarkdownTheme adapter
// ---------------------------------------------------------------------------

// Strip leading "### " / "#### " / ... hash prefixes from headings (h3+)
// that pi-tui's renderer emits literally.
// eslint-disable-next-line no-control-regex
const HEADING_HASH_PREFIX = /^((?:\[[0-9;]*m)*)#{1,6}[ \t]+/;

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

// ---------------------------------------------------------------------------
// pi-tui EditorTheme adapter
// ---------------------------------------------------------------------------

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
