/**
 * HorizontalSplit — pi-tui Component that renders two children side-by-side.
 *
 *   ┌─────────────────────┬──────────────────┐
 *   │     left (code)     │  right (sidebar) │
 *   │                     │                  │
 *   └─────────────────────┴──────────────────┘
 *
 * The width ratio is configurable (default 65% left, 35% right).
 * Both children receive their respective column width and the same height.
 */

import chalk from 'chalk';
import { type Component, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

export interface HorizontalSplitOptions {
  left: Component;
  right: Component;
  /** Width ratio for the left panel (0-1). Default: 0.65 */
  leftRatio?: number;
  /** Show a vertical divider between panels. Default: true */
  divider?: boolean;
}

export class HorizontalSplit implements Component {
  private readonly left: Component;
  private readonly right: Component;
  private readonly leftRatio: number;
  private readonly divider: boolean;

  constructor(options: HorizontalSplitOptions) {
    this.left = options.left;
    this.right = options.right;
    this.leftRatio = options.leftRatio ?? 0.65;
    this.divider = options.divider ?? true;
  }

  render(width: number): string[] {
    // Calculate column widths
    const dividerWidth = this.divider ? 1 : 0;
    const availableWidth = width - dividerWidth;
    const leftWidth = Math.max(10, Math.floor(availableWidth * this.leftRatio));
    const rightWidth = Math.max(10, availableWidth - leftWidth);

    // Render both children
    const leftLines = this.left.render(leftWidth);
    const rightLines = this.right.render(rightWidth);

    // Pad to same height
    const maxLines = Math.max(leftLines.length, rightLines.length);
    const result: string[] = [];

    const dividerChar = this.divider ? chalk.hex(colors.border)('│') : '';

    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i] ?? '';
      const rightLine = rightLines[i] ?? '';

      // Pad each line to its column width
      const leftPad = Math.max(0, leftWidth - visibleWidth(leftLine));
      const rightPad = Math.max(0, rightWidth - visibleWidth(rightLine));

      let combined = leftLine + ' '.repeat(leftPad);
      if (this.divider) {
        combined += dividerChar;
      }
      combined += rightLine + ' '.repeat(rightPad);

      result.push(combined);
    }

    return result;
  }

  invalidate(): void {
    this.left.invalidate();
    this.right.invalidate();
  }
}

export default HorizontalSplit;
