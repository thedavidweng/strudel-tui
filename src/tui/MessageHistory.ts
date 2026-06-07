/**
 * MessageHistory — pi-tui Component that renders a scrollable message list.
 *
 *   - Type-prefixed lines with chalk coloring
 *   - Scroll offset with auto-scroll-to-bottom on new messages
 *   - Long-line wrapping to fit available width
 */

import chalk from 'chalk';
import { Component, wrapTextWithAnsi, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type MessageType = 'user' | 'agent' | 'system' | 'error' | 'tool';

export interface Message {
  type: MessageType;
  content: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Style map — symbol + color per message type
// ---------------------------------------------------------------------------

const TYPE_STYLE: Record<MessageType, { symbol: string; color: (s: string) => string }> = {
  user:   { symbol: '▸', color: chalk.hex(colors.roleUser) },
  agent:  { symbol: '◆', color: chalk.hex(colors.text) },
  system: { symbol: '·', color: chalk.hex(colors.textMuted) },
  error:  { symbol: '✗', color: chalk.hex(colors.error) },
  tool:   { symbol: '⚡', color: chalk.hex(colors.roleTool) },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class MessageHistory implements Component {
  private _invalidate: (() => void) | null = null;
  private _messages: Message[] = [];
  /** Distance from the bottom of the message list. 0 = pinned to bottom. */
  private _scrollOffset = 0;

  // -- Component interface --------------------------------------------------

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  /**
   * Render the visible message lines.
   *
   * @param width  - available column width
   * @param height - available row count (lines). When omitted every wrapped
   *                 line for every message is returned (no scrolling).
   */
  render(width: number, height?: number): string[] {
    const contentWidth = Math.max(10, width - 2);
    const allLines = this._buildAllLines(contentWidth);

    if (!height || height <= 0 || allLines.length <= height) {
      return allLines;
    }

    // Apply scroll offset (offset 0 = last `height` lines = pinned to bottom)
    const end = allLines.length - this._scrollOffset;
    const start = Math.max(0, end - height);
    return allLines.slice(start, end);
  }

  // -- Public API -----------------------------------------------------------

  addMessage(msg: Message): void {
    this._messages.push(msg);
    this._scrollOffset = 0; // auto-scroll to bottom
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

  // -- Internal -------------------------------------------------------------

  invalidate(): void {
    this._invalidate?.();
  }

  /**
   * Build wrapped lines for every message, one array element per visual line.
   */
  private _buildAllLines(contentWidth: number): string[] {
    if (this._messages.length === 0) {
      return [chalk.hex(colors.textMuted)('  No messages yet')];
    }

    const lines: string[] = [];

    for (const msg of this._messages) {
      const style = TYPE_STYLE[msg.type];
      const prefix = ` ${style.symbol} `;
      const prefixWidth = visibleWidth(prefix);

      // Color the prefix and content
      const styledPrefix = style.color(prefix);
      const textColor = msg.type === 'system'
        ? chalk.hex(colors.textDim)
        : chalk.hex(colors.text);
      const content = msg.content;

      // Wrap the raw content, then apply color per wrapped line
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

export default MessageHistory;
