/**
 * PatternPanel — pi-tui Component that renders the current Strudel pattern
 * in a Kimi Code-style bordered panel.
 *
 *   ┌ Pattern Editor ─────────────────────┐
 *   │  1 │ s("bd sn").lpf(800)            │
 *   │  2 │ .room(0.5)                     │
 *   └─────────────────────────────────────┘
 */

import chalk from 'chalk';
import { Component, visibleWidth, truncateToWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

const BRAILLE_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Syntax highlighting
const KNOWN_FUNCTIONS = new Set([
  's', 'sound', 'note', 'freq', 'gain', 'pan', 'speed', 'crush',
  'delay', 'reverb', 'lpf', 'hpf', 'bpf', 'vowel', 'shape',
  'room', 'size', 'attack', 'decay', 'sustain', 'release',
  'stack', 'cat', 'seq', 'slow', 'fast', 'rev', 'jux',
  'every', 'sometimes', 'often', 'rarely', 'struct', 'fit',
  'range', 'segment', 'linger', 'ply', 'hush', 'silence',
  'setcps', 'setcpm',
]);

const SYNTAX_STRING   = /("[^"]*"|'[^']*')/g;
const SYNTAX_NUMBER   = /\b(\d+\.?\d*)\b/g;
const SYNTAX_FUNCTION = /\b([a-zA-Z_]\w*)\s*\(/g;
const SYNTAX_COMMENT  = /(\/\/.*$)/gm;

function highlightLine(line: string): string {
  const STYLE_COMMENT = chalk.hex(colors.textMuted);
  const STYLE_STRING = chalk.hex(colors.success);
  const STYLE_NUMBER = chalk.hex(colors.warning);
  const STYLE_FUNCTION = chalk.hex('#5CCFE6');

  interface Token { start: number; end: number; text: string; type: 'comment' | 'string' | 'number' | 'function'; }
  const tokens: Token[] = [];

  // Comments first (lowest priority, but covers the whole tail)
  for (const m of line.matchAll(SYNTAX_COMMENT)) {
    tokens.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], type: 'comment' });
  }

  const insideComment = (pos: number) => tokens.some(t => t.type === 'comment' && pos >= t.start && pos < t.end);

  // Strings
  for (const m of line.matchAll(SYNTAX_STRING)) {
    if (insideComment(m.index!)) continue;
    tokens.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], type: 'string' });
  }

  const insideString = (pos: number) => tokens.some(t => t.type === 'string' && pos >= t.start && pos < t.end);

  // Numbers
  for (const m of line.matchAll(SYNTAX_NUMBER)) {
    if (insideString(m.index!) || insideComment(m.index!)) continue;
    tokens.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], type: 'number' });
  }

  // Functions
  for (const m of line.matchAll(SYNTAX_FUNCTION)) {
    const name = m[1]!;
    if (!KNOWN_FUNCTIONS.has(name)) continue;
    if (insideString(m.index!) || insideComment(m.index!)) continue;
    tokens.push({ start: m.index!, end: m.index! + m[1]!.length, text: m[1]!, type: 'function' });
  }

  if (tokens.length === 0) return chalk.hex(colors.text)(line);

  const styleMap: Record<string, (s: string) => string> = {
    comment: STYLE_COMMENT,
    string: STYLE_STRING,
    number: STYLE_NUMBER,
    function: STYLE_FUNCTION,
  };

  tokens.sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = 0;
  for (const tok of tokens) {
    if (tok.start > cursor) result += chalk.hex(colors.text)(line.slice(cursor, tok.start));
    result += styleMap[tok.type]!(tok.text);
    cursor = tok.end;
  }
  if (cursor < line.length) result += chalk.hex(colors.text)(line.slice(cursor));
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class PatternPanel implements Component {
  private _invalidate: (() => void) | null = null;
  private _pattern = '';
  private _playing = false;
  private _spinTick = 0;

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number): string[] {
    const lines: string[] = [];
    const panelWidth = Math.max(20, width);

    // --- Title bar: ┌ Pattern Editor ────────
    const playingLabel = this._playing
      ? chalk.hex(colors.playing).bold(` ${BRAILLE_DOTS[this._spinTick % BRAILLE_DOTS.length]} playing `)
      : chalk.hex(colors.stopped)(' stopped ');
    if (this._playing) this._spinTick++;

    const titleText = ' Pattern Editor ';
    const titleVis = visibleWidth(titleText);
    const playingVis = visibleWidth(this._playing ? ` ${BRAILLE_DOTS[0]} playing ` : ' stopped ');
    const borderVis = 2; // ┌ and ┐
    const gap = 1; // space before playing label
    const dashCount = Math.max(1, panelWidth - borderVis - titleVis - playingVis - gap);
    const topBorder = chalk.hex(colors.border)('┌') + chalk.hex(colors.primary).bold(titleText) + chalk.hex(colors.border)('─'.repeat(dashCount)) + ' ' + playingLabel + chalk.hex(colors.border)('┐');
    lines.push(topBorder);

    // --- Pattern lines ---
    const patternLines = this._pattern.split('\n');
    const gutterWidth = String(patternLines.length).length;
    const prefixOverhead = gutterWidth + 4; // gutter + " │ " + space
    const contentMax = Math.max(10, panelWidth - prefixOverhead - 2); // -2 for borders

    if (patternLines.length === 0 || (patternLines.length === 1 && patternLines[0] === '')) {
      const emptyContent = chalk.hex(colors.textMuted)(' (no pattern)');
      const pad = Math.max(0, panelWidth - visibleWidth(emptyContent) - 2);
      lines.push(chalk.hex(colors.border)('│') + emptyContent + ' '.repeat(pad) + chalk.hex(colors.border)('│'));
    } else {
      for (let i = 0; i < patternLines.length; i++) {
        const lineNum = String(i + 1).padStart(gutterWidth, ' ');
        const raw = patternLines[i]!;
        const truncated = raw.length > contentMax ? raw.slice(0, contentMax - 1) + '…' : raw;
        let highlighted = highlightLine(truncated);
        const gutter = chalk.hex(colors.textMuted)(`${lineNum}`);
        const pipe = chalk.hex(colors.border)(' │ ');
        let content = gutter + pipe + highlighted;
        let contentVis = visibleWidth(content);
        // Safety: truncate highlighted content if it still exceeds panel width
        if (contentVis > panelWidth - 2) {
          const maxHighlightWidth = contentMax - (contentVis - visibleWidth(highlighted));
          highlighted = truncateToWidth(highlighted, maxHighlightWidth);
          content = gutter + pipe + highlighted;
          contentVis = visibleWidth(content);
        }
        const pad = Math.max(0, panelWidth - contentVis - 2);
        lines.push(chalk.hex(colors.border)('│') + ' ' + content + ' '.repeat(pad) + chalk.hex(colors.border)('│'));
      }
    }

    // --- Bottom border: └───────────────────
    lines.push(chalk.hex(colors.border)('└' + '─'.repeat(panelWidth - 2) + '┘'));

    return lines;
  }

  setPattern(text: string): void {
    this._pattern = text;
    this.invalidate();
  }

  setPlaying(playing: boolean): void {
    this._playing = playing;
    this.invalidate();
  }

  invalidate(): void {
    this._invalidate?.();
  }
}

export default PatternPanel;
