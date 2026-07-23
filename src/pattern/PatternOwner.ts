interface PatternSnapshot {
  pattern: string;
  timestamp: number;
}

export function applyEditHeuristic(pattern: string, instruction: string): string {
  const lower = instruction.toLowerCase();
  if (lower.includes('faster') || lower.includes('speed up')) {
    if (pattern.includes('.slow(')) return pattern.replace(/\.slow\(([^)]+)\)/, (_, n) => `.fast(${n})`);
    return pattern.trimEnd() + '.fast(2)';
  }
  if (lower.includes('slower') || lower.includes('slow down')) {
    if (pattern.includes('.fast(')) return pattern.replace(/\.fast\(([^)]+)\)/, (_, n) => `.slow(${n})`);
    return pattern.trimEnd() + '.slow(2)';
  }
  if (lower.includes('louder') || lower.includes('volume up')) return pattern.trimEnd() + '.gain(1.5)';
  if (lower.includes('quieter') || lower.includes('softer')) return pattern.trimEnd() + '.gain(0.5)';
  if (lower.includes('reverse') || lower.includes('backwards')) return pattern.trimEnd() + '.rev()';
  if (lower.includes('reverb')) return pattern.trimEnd() + '.room(0.5)';
  if (lower.includes('delay')) return pattern.trimEnd() + '.delay(0.5)';
  if (lower.includes('distort')) return pattern.trimEnd() + '.distort(0.5)';
  if (lower.includes('filter') || lower.includes('low pass')) return pattern.trimEnd() + '.lpf(800)';
  if (lower.includes('high pass')) return pattern.trimEnd() + '.hpf(800)';
  if (lower.includes('remove last') || lower.includes('undo last')) {
    const match = pattern.match(/\.(\w+)\([^)]*\)\s*$/);
    if (match) return pattern.slice(0, match.index);
  }
  return pattern;
}

export class PatternOwner {
  private _current: string;
  private _stack: PatternSnapshot[] = [];
  private _index = -1;

  constructor(initialPattern = '') {
    this._current = initialPattern;
    if (initialPattern) {
      this._stack.push({ pattern: initialPattern, timestamp: Date.now() });
      this._index = 0;
    }
  }

  get currentPattern(): string {
    return this._current;
  }

  set(pattern: string): void {
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }
    this._stack.push({ pattern, timestamp: Date.now() });
    this._index = this._stack.length - 1;
    this._current = pattern;
  }

  applyEdit(instruction: string): string {
    return applyEditHeuristic(this._current, instruction);
  }

  undo(): string | undefined {
    if (this._index <= 0) return undefined;
    this._index--;
    this._current = this._stack[this._index]!.pattern;
    return this._current;
  }

  redo(): string | undefined {
    if (this._index >= this._stack.length - 1) return undefined;
    this._index++;
    this._current = this._stack[this._index]!.pattern;
    return this._current;
  }

  canUndo(): boolean {
    return this._index > 0;
  }

  canRedo(): boolean {
    return this._index < this._stack.length - 1;
  }

  stackSize(): number {
    return this._stack.length;
  }

  exportStack(): { stack: PatternSnapshot[]; index: number } {
    return { stack: this._stack, index: this._index };
  }
}
