/**
 * PatternEditor — pi-tui Component that renders the current Strudel pattern
 * with line numbers and basic syntax highlighting.
 *
 *   Line 1:  title "Pattern Editor" + playing indicator
 *   Line 2:  separator ─────────────────────────────
 *   Line 3+: 1 | s("bd sd") # gain 0.8
 *            2 | ...
 */

import chalk from 'chalk';
import { Component, wrapTextWithAnsi, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

// ---------------------------------------------------------------------------
// Syntax highlighting — lightweight regex-based, no full parser needed
// ---------------------------------------------------------------------------

/**
 * Apply basic syntax highlighting to a single line of Strudel code.
 *
 *  - Quoted strings  -> green
 *  - Numbers         -> yellow
 *  - Known functions -> cyan
 */

const KNOWN_FUNCTIONS = new Set([
  's', 'sound', 'note', 'freq', 'gain', 'pan', 'speed', 'crush',
  'delay', 'reverb', 'lpf', 'hpf', 'bpf', 'vowel', 'shape',
  'room', 'size', 'attack', 'decay', 'sustain', 'release',
  'stack', 'cat', 'seq', 'slow', 'fast', 'rev', 'jux',
  'every', 'sometimes', 'often', 'rarely', 'struct', 'fit',
  'slice', 'chop', 'scramble', 'shuffle', 'pick', 'select',
  'range', 'segment', 'linger', 'ply', 'dup', 'striate',
  'hush', 'silence',
]);

const SYNTAX_STRING   = /("[^"]*"|'[^']*')/g;
const SYNTAX_NUMBER   = /\b(\d+\.?\d*)\b/g;
const SYNTAX_FUNCTION = /\b([a-zA-Z_]\w*)\s*\(/g;

function highlightLine(line: string): string {
  // Tokens are collected with their start position so we can rebuild in order.
  interface Token { start: number; end: number; text: string; style: (s: string) => string; }

  const tokens: Token[] = [];

  // Strings first (highest priority — skip interior matches)
  for (const m of line.matchAll(SYNTAX_STRING)) {
    tokens.push({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0],
      style: chalk.hex(colors.success),
    });
  }

  // Helper: does position overlap any existing string token?
  const insideString = (pos: number) => tokens.some(t => t.style === chalk.hex(colors.success) && pos >= t.start && pos < t.end);

  // Numbers
  for (const m of line.matchAll(SYNTAX_NUMBER)) {
    if (insideString(m.index!)) continue;
    tokens.push({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0],
      style: chalk.hex(colors.warning),
    });
  }

  // Functions
  for (const m of line.matchAll(SYNTAX_FUNCTION)) {
    const name = m[1]!;
    if (!KNOWN_FUNCTIONS.has(name)) continue;
    if (insideString(m.index!)) continue;
    // Avoid overlap with number tokens
    const overlapsNumber = tokens.some(
      t => t.style === chalk.hex(colors.warning) && m.index! < t.end && m.index! + m[0].length > t.start,
    );
    if (overlapsNumber) continue;
    tokens.push({
      start: m.index!,
      end: m.index! + m[1]!.length, // only highlight the name, not the '('
      text: m[1]!,
      style: chalk.hex('#5CCFE6'), // cyan
    });
  }

  if (tokens.length === 0) return chalk.hex(colors.text)(line);

  // Sort by start position and rebuild the line
  tokens.sort((a, b) => a.start - b.start);

  let result = '';
  let cursor = 0;
  for (const tok of tokens) {
    if (tok.start > cursor) {
      result += chalk.hex(colors.text)(line.slice(cursor, tok.start));
    }
    result += tok.style(tok.text);
    cursor = tok.end;
  }
  if (cursor < line.length) {
    result += chalk.hex(colors.text)(line.slice(cursor));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Braille spinner for playing indicator
// ---------------------------------------------------------------------------

const BRAILLE_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function brailleFrame(tick: number): string {
  return BRAILLE_DOTS[tick % BRAILLE_DOTS.length]!;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class PatternEditor implements Component {
  private _invalidate: (() => void) | null = null;
  private _pattern = '';
  private _playing = false;
  private _spinTick = 0;

  // -- Component interface --------------------------------------------------

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  /**
   * Render the pattern editor.
   *
   * @param width  - available column width
   * @param height - available row count (unused — caller truncates as needed)
   */
  render(width: number, _height?: number): string[] {
    const lines: string[] = [];

    // --- Title line ---
    const title = 'Pattern Editor';
    const styledTitle = chalk.hex(colors.primary).bold(` ${title} `);

    const playingLabel = this._playing
      ? chalk.hex(colors.playing).bold(` ${brailleFrame(this._spinTick)} playing`)
      : chalk.hex(colors.stopped)(' stopped');

    if (this._playing) this._spinTick++;

    // Right-align the playing indicator
    const titleVis = visibleWidth(title) + 2; // spaces around title
    const playingText = this._playing ? `${brailleFrame(this._spinTick)} playing` : 'stopped';
    const playingVis = visibleWidth(playingText) + 1;
    const gap = Math.max(1, width - titleVis - playingVis);
    lines.push(styledTitle + ' '.repeat(gap) + playingLabel);

    // --- Separator ---
    lines.push(chalk.hex(colors.border)('─'.repeat(width)));

    // --- Pattern lines ---
    const patternLines = this._pattern.split('\n');
    const gutterWidth = String(patternLines.length).length;

    // Content area: gutter + " | " + content
    // gutterWidth + 3 (space-pipe-space) + 1 (leading space) = gutterWidth + 4
    const prefixOverhead = gutterWidth + 4;
    const contentMax = Math.max(10, width - prefixOverhead);

    if (patternLines.length === 0 || (patternLines.length === 1 && patternLines[0] === '')) {
      lines.push(chalk.hex(colors.textMuted)(' ' + ' '.repeat(gutterWidth) + ' | (no pattern)'));
    } else {
      for (let i = 0; i < patternLines.length; i++) {
        const lineNum = String(i + 1).padStart(gutterWidth, ' ');
        const raw = patternLines[i]!;
        const truncated = raw.length > contentMax ? raw.slice(0, contentMax - 1) + '…' : raw;
        const highlighted = highlightLine(truncated);
        const gutter = chalk.hex(colors.textMuted)(` ${lineNum}`);
        const pipe = chalk.hex(colors.border)(' │ ');
        lines.push(gutter + pipe + highlighted);
      }
    }

    return lines;
  }

  // -- Public API -----------------------------------------------------------

  /** Replace the displayed pattern text. */
  setPattern(text: string): void {
    this._pattern = text;
    this.invalidate();
  }

  /** Set the playing state (controls the indicator color and animation). */
  setPlaying(playing: boolean): void {
    this._playing = playing;
    this.invalidate();
  }

  // -- Internal -------------------------------------------------------------

  invalidate(): void {
    this._invalidate?.();
  }
}

export default PatternEditor;
