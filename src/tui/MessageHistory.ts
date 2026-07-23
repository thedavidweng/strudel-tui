import chalk from 'chalk';
import { Component, wrapTextWithAnsi, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

export type MessageType = 'user' | 'agent' | 'system' | 'error' | 'tool';

export interface Message {
  type: MessageType;
  content: string;
  timestamp?: number;
}

const TYPE_STYLE: Record<MessageType, { symbol: string; color: (s: string) => string }> = {
  user:   { symbol: '▸', color: chalk.hex(colors.roleUser) },
  agent:  { symbol: '◆', color: chalk.hex(colors.text) },
  system: { symbol: '·', color: chalk.hex(colors.textMuted) },
  error:  { symbol: '✗', color: chalk.hex(colors.error) },
  tool:   { symbol: '⚡', color: chalk.hex(colors.roleTool) },
};

export class MessageHistory implements Component {
  private _invalidate: (() => void) | null = null;
  private _messages: Message[] = [];
  private _scrollOffset = 0;
  private _streamingIndex = -1;

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number, height?: number): string[] {
    const contentWidth = Math.max(10, width - 2);
    const allLines = this._buildAllLines(contentWidth);

    if (!height || height <= 0 || allLines.length <= height) {
      return allLines;
    }

    const end = allLines.length - this._scrollOffset;
    const start = Math.max(0, end - height);
    return allLines.slice(start, end);
  }

  addMessage(msg: Message): void {
    this._messages.push(msg);
    this._scrollOffset = 0;
    this.invalidate();
  }

  setMessages(msgs: Message[]): void {
    this._messages = msgs.slice();
    this._scrollOffset = 0;
    this.invalidate();
  }

  clear(): void {
    this._messages = [];
    this._scrollOffset = 0;
    this._streamingIndex = -1;
    this.invalidate();
  }

  updateOrAddStreamingMessage(content: string): void {
    if (this._streamingIndex >= 0 && this._streamingIndex < this._messages.length) {
      this._messages[this._streamingIndex] = { type: 'agent', content };
    } else {
      this._streamingIndex = this._messages.length;
      this._messages.push({ type: 'agent', content });
    }
    this._scrollOffset = 0;
    this.invalidate();
  }

  finalizeStreamingMessage(finalText: string): void {
    if (this._streamingIndex >= 0 && this._streamingIndex < this._messages.length) {
      this._messages[this._streamingIndex] = { type: 'agent', content: finalText };
    } else {
      this._messages.push({ type: 'agent', content: finalText });
    }
    this._streamingIndex = -1;
    this._scrollOffset = 0;
    this.invalidate();
  }

  updateOrAddLastToolMessage(content: string): void {
    const last = this._messages[this._messages.length - 1];
    if (last && last.type === 'tool') {
      last.content = content;
    } else {
      this._messages.push({ type: 'tool', content });
    }
    this._scrollOffset = 0;
    this.invalidate();
  }

  scrollUp(lines = 3): void {
    this._scrollOffset += lines;
    this.invalidate();
  }

  scrollDown(lines = 3): void {
    this._scrollOffset = Math.max(0, this._scrollOffset - lines);
    this.invalidate();
  }

  invalidate(): void {
    this._invalidate?.();
  }

  private _buildAllLines(contentWidth: number): string[] {
    if (this._messages.length === 0) {
      return [chalk.hex(colors.textMuted)('  No messages yet')];
    }

    const lines: string[] = [];

    for (const msg of this._messages) {
      const style = TYPE_STYLE[msg.type];
      const prefix = ` ${style.symbol} `;
      const prefixWidth = visibleWidth(prefix);

      const styledPrefix = style.color(prefix);
      const textColor = msg.type === 'system'
        ? chalk.hex(colors.textDim)
        : chalk.hex(colors.text);
      const content = msg.content;

      const maxContentWidth = Math.max(5, contentWidth - prefixWidth);
      const wrappedLines = wrapTextWithAnsi(content, maxContentWidth);

      for (let i = 0; i < wrappedLines.length; i++) {
        const line = wrappedLines[i]!;
        lines.push((i === 0 ? styledPrefix : ' '.repeat(prefixWidth)) + textColor(line));
      }
    }

    return lines;
  }
}
