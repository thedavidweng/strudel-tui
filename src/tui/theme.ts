/**
 * Centralized theme — warm palette matching Claude Code's aesthetic.
 */

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

// Warm dark palette — matching Claude Code's orange/amber tones
const dark: ColorPalette = {
  primary: '#E07C4F',    // warm orange (like Claude Code's accent)
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

export function getPalette(theme: Theme): ColorPalette {
  return theme === 'dark' ? dark : light;
}

export const colors: ColorPalette = dark;
