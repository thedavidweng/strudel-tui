/**
 * PatternOwner — the single source of truth for the current Strudel pattern.
 *
 * Owns the pattern string and an undo/redo stack of pattern versions, plus
 * the keyword-mode edit heuristics that transform a pattern from a
 * natural-language instruction.
 *
 * Behind this interface, callers never need to know where the pattern is
 * stored or how undo/redo is implemented — they read `currentPattern`,
 * call `set()` to commit a new version, and call `undo()`/`redo()` to
 * navigate the stack.
 */

interface PatternSnapshot {
  pattern: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Edit heuristics (keyword mode)
// ---------------------------------------------------------------------------

/**
 * Apply a keyword-mode heuristic edit to a pattern string.  Returns the
 * edited pattern.  If the instruction is not recognised, returns the
 * pattern unchanged.  Pure function — does not mutate any state.
 */
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

// ---------------------------------------------------------------------------
// PatternOwner
// ---------------------------------------------------------------------------

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

  /** The current pattern string. */
  get currentPattern(): string {
    return this._current;
  }

  /**
   * Set a new pattern, pushing the previous one onto the undo stack.
   * Discards any redo entries ahead of the current position.
   */
  set(pattern: string): void {
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }
    this._stack.push({ pattern, timestamp: Date.now() });
    this._index = this._stack.length - 1;
    this._current = pattern;
  }

  /**
   * Apply a keyword-mode heuristic edit to the current pattern.  Returns
   * the edited pattern string (does NOT commit it — call `set()` with the
   * result if you want it on the undo stack).
   */
  applyEdit(instruction: string): string {
    return applyEditHeuristic(this._current, instruction);
  }

  /** Revert to the previous pattern version. Returns it, or undefined. */
  undo(): string | undefined {
    if (this._index <= 0) return undefined;
    this._index--;
    this._current = this._stack[this._index]!.pattern;
    return this._current;
  }

  /** Re-apply the next pattern version after an undo. Returns it, or undefined. */
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

  /** Number of pattern versions in the stack. */
  stackSize(): number {
    return this._stack.length;
  }

  // -- persistence support (used by SessionStore via Agent) --

  exportStack(): { stack: PatternSnapshot[]; index: number } {
    return { stack: this._stack, index: this._index };
  }

  importStack(stack: PatternSnapshot[], index: number): void {
    this._stack = stack;
    this._index = index;
    this._current = index >= 0 && index < stack.length ? stack[index]!.pattern : '';
  }
}
