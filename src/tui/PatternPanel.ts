import chalk from 'chalk';
import { Component, visibleWidth, truncateToWidth, decodeKittyPrintable, Key, matchesKey } from '@earendil-works/pi-tui';
import { colors, BRAILLE_DOTS } from './theme.js';

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

  for (const m of line.matchAll(SYNTAX_COMMENT)) {
    tokens.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], type: 'comment' });
  }

  const insideComment = (pos: number) => tokens.some(t => t.type === 'comment' && pos >= t.start && pos < t.end);

  for (const m of line.matchAll(SYNTAX_STRING)) {
    if (insideComment(m.index!)) continue;
    tokens.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], type: 'string' });
  }

  const insideString = (pos: number) => tokens.some(t => t.type === 'string' && pos >= t.start && pos < t.end);

  for (const m of line.matchAll(SYNTAX_NUMBER)) {
    if (insideString(m.index!) || insideComment(m.index!)) continue;
    tokens.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], type: 'number' });
  }

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

export class PatternPanel implements Component {
  private _invalidate: (() => void) | null = null;
  private _pattern = '';
  private _playing = false;
  private _spinTick = 0;

  private _editMode = false;
  private _cursorLine = 0;
  private _cursorCol = 0;
  private _editBuffer: string[] = [];
  private _originalPattern = '';
  private _scrollOffset = 0;

  onApply: ((pattern: string) => void) | null = null;

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number, height?: number): string[] {
    const lines: string[] = [];
    const panelWidth = Math.max(20, width);

    const modeLabel = this._editMode ? ' editing ' : '';
    const playingLabel = this._playing
      ? chalk.hex(colors.playing).bold(` ${BRAILLE_DOTS[this._spinTick % BRAILLE_DOTS.length]} playing `)
      : chalk.hex(colors.stopped)(' stopped ');
    if (this._playing) this._spinTick++;

    const titleText = ' Pattern Editor ';
    const titleVis = visibleWidth(titleText);
    const playingVis = visibleWidth(this._playing ? ` ${BRAILLE_DOTS[0]} playing ` : ' stopped ');
    const modeVis = this._editMode ? visibleWidth(modeLabel) : 0;
    const borderVis = 2;
    const gap = 1;
    const dashCount = Math.max(1, panelWidth - borderVis - titleVis - modeVis - playingVis - gap);
    let topBorder = chalk.hex(colors.border)('┌') + chalk.hex(colors.primary).bold(titleText);
    if (this._editMode) {
      const modeDash = Math.floor(Math.max(0, dashCount - modeVis) / 2);
      topBorder += chalk.hex(colors.border)('─'.repeat(modeDash));
      topBorder += chalk.hex(colors.warning)(modeLabel);
      topBorder += chalk.hex(colors.border)('─'.repeat(Math.max(0, dashCount - modeDash - modeVis)));
    } else {
      topBorder += chalk.hex(colors.border)('─'.repeat(dashCount));
    }
    topBorder += ' ' + playingLabel + chalk.hex(colors.border)('┐');
    lines.push(topBorder);

    const sourceLines = this._editMode ? this._editBuffer : this._pattern.split('\n');
    const patternLines = sourceLines.length === 0 ? [''] : sourceLines;
    const gutterWidth = String(patternLines.length).length;
    const prefixOverhead = gutterWidth + 4;
    const contentMax = Math.max(10, panelWidth - prefixOverhead - 2);

    const helpBarLines = this._editMode ? 1 : 0;
    const availableHeight = Math.max(1, (height ?? 20) - 2 - helpBarLines);

    if (this._editMode) {
      if (this._cursorLine < this._scrollOffset) {
        this._scrollOffset = this._cursorLine;
      } else if (this._cursorLine >= this._scrollOffset + availableHeight) {
        this._scrollOffset = this._cursorLine - availableHeight + 1;
      }
    }

    const startLine = this._editMode ? this._scrollOffset : 0;
    const endLine = this._editMode ? Math.min(patternLines.length, startLine + availableHeight) : patternLines.length;

    if (patternLines.length === 0 || (patternLines.length === 1 && patternLines[0] === '')) {
      const emptyContent = chalk.hex(colors.textMuted)(' (no pattern)');
      const pad = Math.max(0, panelWidth - visibleWidth(emptyContent) - 2);
      lines.push(chalk.hex(colors.border)('│') + emptyContent + ' '.repeat(pad) + chalk.hex(colors.border)('│'));
    } else {
      for (let i = startLine; i < endLine; i++) {
        const lineNum = String(i + 1).padStart(gutterWidth, ' ');
        const raw = patternLines[i]!;
        const truncated = raw.length > contentMax ? raw.slice(0, Math.max(0, contentMax - 1)) + '…' : raw;

        const gutterIndicator = this._editMode && i === this._cursorLine ? '>' : ' ';
        const gutter = chalk.hex(colors.textMuted)(`${gutterIndicator}${lineNum}`);

        const pipe = chalk.hex(colors.border)(' │ ');

        let highlighted: string;
        if (this._editMode && i === this._cursorLine) {
          highlighted = this.renderLineWithCursor(truncated, contentMax);
        } else {
          highlighted = highlightLine(truncated);
        }

        let content = gutter + pipe + highlighted;
        let contentVis = visibleWidth(content);
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

    if (this._editMode) {
      const helpText = ' ^X Save&Exit ^E Discard ';
      const helpContent = chalk.hex(colors.textMuted)(helpText);
      const helpVis = visibleWidth(helpText);
      const helpPad = Math.max(0, panelWidth - helpVis - 2);
      lines.push(chalk.hex(colors.border)('│') + helpContent + ' '.repeat(helpPad) + chalk.hex(colors.border)('│'));
    }

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

  enterEditMode(): void {
    this._originalPattern = this._pattern;
    this._editBuffer = this._pattern.split('\n');
    if (this._editBuffer.length === 0) this._editBuffer = [''];
    this._editMode = true;
    this._cursorLine = this._editBuffer.length - 1;
    this._cursorCol = this._editBuffer[this._cursorLine]!.length;
    this._scrollOffset = 0;
    this.invalidate();
  }

  exitEditMode(apply: boolean): string {
    this._editMode = false;
    if (apply) {
      this._pattern = this._editBuffer.join('\n');
    } else {
      this._pattern = this._originalPattern;
    }
    this._editBuffer = [];
    this._originalPattern = '';
    this._scrollOffset = 0;
    this.invalidate();
    return this._pattern;
  }

  get editMode(): boolean {
    return this._editMode;
  }

  handleInput(data: string): boolean {
    if (!this._editMode) return false;

    if (matchesKey(data, Key.up)) { this.moveCursor(-1, 0); return true; }
    if (matchesKey(data, Key.down)) { this.moveCursor(1, 0); return true; }
    if (matchesKey(data, Key.left)) { this.moveCursor(0, -1); return true; }
    if (matchesKey(data, Key.right)) { this.moveCursor(0, 1); return true; }

    if (matchesKey(data, Key.home)) { this._cursorCol = 0; this.invalidate(); return true; }
    if (matchesKey(data, Key.end)) { this._cursorCol = this._editBuffer[this._cursorLine]!.length; this.invalidate(); return true; }

    if (matchesKey(data, Key.backspace)) {
      if (this._cursorCol > 0) {
        const line = this._editBuffer[this._cursorLine]!;
        this._editBuffer[this._cursorLine] = line.slice(0, this._cursorCol - 1) + line.slice(this._cursorCol);
        this._cursorCol--;
      } else if (this._cursorLine > 0) {
        const currentLine = this._editBuffer.splice(this._cursorLine, 1)[0]!;
        this._cursorLine--;
        this._cursorCol = this._editBuffer[this._cursorLine]!.length;
        this._editBuffer[this._cursorLine] += currentLine;
      }
      this.invalidate();
      return true;
    }

    if (matchesKey(data, Key.delete)) {
      const line = this._editBuffer[this._cursorLine]!;
      if (this._cursorCol < line.length) {
        this._editBuffer[this._cursorLine] = line.slice(0, this._cursorCol) + line.slice(this._cursorCol + 1);
      } else if (this._cursorLine < this._editBuffer.length - 1) {
        this._editBuffer[this._cursorLine] += this._editBuffer.splice(this._cursorLine + 1, 1)[0]!;
      }
      this.invalidate();
      return true;
    }

    if (matchesKey(data, Key.enter)) {
      const line = this._editBuffer[this._cursorLine]!;
      const before = line.slice(0, this._cursorCol);
      const after = line.slice(this._cursorCol);
      this._editBuffer[this._cursorLine] = before;
      this._editBuffer.splice(this._cursorLine + 1, 0, after);
      this._cursorLine++;
      this._cursorCol = 0;
      this.invalidate();
      return true;
    }

    const ch = decodeKittyPrintable(data) ?? (data.length === 1 && data >= ' ' ? data : null);
    if (ch) {
      const line = this._editBuffer[this._cursorLine]!;
      this._editBuffer[this._cursorLine] = line.slice(0, this._cursorCol) + ch + line.slice(this._cursorCol);
      this._cursorCol++;
      this.invalidate();
      return true;
    }

    return false;
  }

  private moveCursor(dLine: number, dCol: number): void {
    const wasAtEnd = this._cursorCol >= this._editBuffer[this._cursorLine]!.length;
    this._cursorLine = Math.max(0, Math.min(this._editBuffer.length - 1, this._cursorLine + dLine));
    if (dLine !== 0 && wasAtEnd) {
      // Sticky end: if cursor was at end of line, move to end of target line
      this._cursorCol = this._editBuffer[this._cursorLine]!.length;
    } else {
      this._cursorCol = Math.max(0, Math.min(this._editBuffer[this._cursorLine]!.length, this._cursorCol + dCol));
    }
    this.invalidate();
  }

  private renderLineWithCursor(line: string, _maxWidth: number): string {
    const col = Math.min(this._cursorCol, line.length);
    const before = line.slice(0, col);
    const cursorChar = col < line.length ? line[col]! : ' ';
    const after = col < line.length ? line.slice(col + 1) : '';

    const highlightedBefore = highlightLine(before);
    const cursorStyled = chalk.inverse(cursorChar);
    const highlightedAfter = highlightLine(after);

    return highlightedBefore + cursorStyled + highlightedAfter;
  }

  invalidate(): void {
    this._invalidate?.();
  }
}
