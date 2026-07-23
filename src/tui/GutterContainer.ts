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
