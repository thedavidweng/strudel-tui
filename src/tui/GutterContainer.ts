/**
 * GutterContainer — wraps children with left/right character padding.
 *
 * Ported from Kimi Code's GutterContainer. With CHROME_GUTTER = 1,
 * every chrome element gets 1 column of left padding and 1 column of
 * right padding (logical — right padding is implicit via reduced width).
 */

import { Container } from '@earendil-works/pi-tui';

export class GutterContainer extends Container {
  private readonly leftPad: number;
  private readonly rightPad: number;

  constructor(leftPad: number, rightPad: number) {
    super();
    this.leftPad = leftPad;
    this.rightPad = rightPad;
  }

  override render(width: number): string[] {
    const inner = Math.max(1, width - this.leftPad - this.rightPad);
    const lead = ' '.repeat(this.leftPad);
    const out: string[] = [];
    for (const child of this.children) {
      for (const line of child.render(inner)) {
        out.push(lead + line);
      }
    }
    return out;
  }
}

export default GutterContainer;
