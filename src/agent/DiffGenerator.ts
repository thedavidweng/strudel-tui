/**
 * DiffGenerator computes simple line-based diffs between pattern strings
 * and can apply unified diffs back to a pattern.  No external dependencies
 * are required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiffLine {
  /** '+' for addition, '-' for removal, ' ' for context */
  type: '+' | '-' | ' ';
  content: string;
  /** Line number in the old file (for removal/context lines) */
  oldLine?: number;
  /** Line number in the new file (for addition/context lines) */
  newLine?: number;
}

export interface UnifiedDiff {
  /** Human-readable diff string in unified diff format */
  text: string;
  /** Structured diff lines */
  lines: DiffLine[];
  /** Number of lines added */
  additions: number;
  /** Number of lines removed */
  removals: number;
}

// ---------------------------------------------------------------------------
// DiffGenerator
// ---------------------------------------------------------------------------

export class DiffGenerator {
  /**
   * Compute a unified diff between two pattern strings.
   *
   * Uses a simple LCS (longest common subsequence) algorithm on lines to
   * produce a minimal diff.  Context lines (unchanged surrounding lines)
   * are included for readability.
   */
  computeDiff(oldPattern: string, newPattern: string): UnifiedDiff {
    const oldLines = oldPattern.split('\n');
    const newLines = newPattern.split('\n');

    // Compute LCS table
    const lcs = this._buildLCS(oldLines, newLines);

    // Backtrack to produce the diff
    const rawDiff = this._backtrack(lcs, oldLines, newLines);

    // Add context lines around changes
    const diffLines = this._addContext(rawDiff, 1);

    // Build unified diff text
    const text = this._formatUnified(diffLines, oldLines.length, newLines.length);

    const additions = diffLines.filter((d) => d.type === '+').length;
    const removals = diffLines.filter((d) => d.type === '-').length;

    return { text, lines: diffLines, additions, removals };
  }

  /**
   * Apply a unified diff text to a pattern string.  Returns the patched
   * pattern, or throws if the diff cannot be applied (e.g. context lines
   * do not match).
   *
   * This implementation parses the unified diff format produced by
   * computeDiff() and applies removals and additions line by line.
   */
  applyDiff(pattern: string, diff: string): string {
    const lines = pattern.split('\n');
    const diffLines = this._parseDiff(diff);

    if (diffLines.length === 0) {
      return pattern;
    }

    // Find the hunk start from the @@ line
    const hunkHeaderMatch = diff.match(/^@@ -(\d+)/m);
    let startLine = 0;
    if (hunkHeaderMatch) {
      startLine = parseInt(hunkHeaderMatch[1], 10) - 1; // 0-indexed
    }

    const result: string[] = lines.slice(0, startLine);
    let oldIdx = startLine;

    for (const dl of diffLines) {
      if (dl.type === ' ') {
        // Context line -- must match
        if (oldIdx >= lines.length || lines[oldIdx] !== dl.content) {
          throw new Error(
            `Diff conflict at line ${oldIdx + 1}: expected "${dl.content}", got "${lines[oldIdx] ?? '(missing)'}"`,
          );
        }
        result.push(dl.content);
        oldIdx++;
      } else if (dl.type === '-') {
        // Removal -- verify it matches
        if (oldIdx >= lines.length || lines[oldIdx] !== dl.content) {
          throw new Error(
            `Diff conflict at line ${oldIdx + 1}: expected removal of "${dl.content}", got "${lines[oldIdx] ?? '(missing)'}"`,
          );
        }
        oldIdx++;
      } else if (dl.type === '+') {
        // Addition
        result.push(dl.content);
      }
    }

    // Append remaining lines after the hunk
    while (oldIdx < lines.length) {
      result.push(lines[oldIdx]);
      oldIdx++;
    }

    return result.join('\n');
  }

  // -----------------------------------------------------------------------
  // LCS algorithm
  // -----------------------------------------------------------------------

  /**
   * Build the LCS dynamic programming table for two string arrays.
   */
  private _buildLCS(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp;
  }

  /**
   * Backtrack through the LCS table to produce diff entries.
   */
  private _backtrack(
    dp: number[][],
    a: string[],
    b: string[],
  ): DiffLine[] {
    const result: DiffLine[] = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        result.unshift({ type: ' ', content: a[i - 1], oldLine: i, newLine: j });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({ type: '+', content: b[j - 1], newLine: j });
        j--;
      } else {
        result.unshift({ type: '-', content: a[i - 1], oldLine: i });
        i--;
      }
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Context and formatting
  // -----------------------------------------------------------------------

  /**
   * Filter diff lines to include only changes and their surrounding context.
   * `contextLines` is how many unchanged lines to keep around each change.
   */
  private _addContext(rawDiff: DiffLine[], contextLines: number): DiffLine[] {
    // Mark which indices are changes or near changes
    const keep = new Set<number>();

    for (let i = 0; i < rawDiff.length; i++) {
      if (rawDiff[i].type !== ' ') {
        for (let c = Math.max(0, i - contextLines); c <= Math.min(rawDiff.length - 1, i + contextLines); c++) {
          keep.add(c);
        }
      }
    }

    return rawDiff.filter((_, idx) => keep.has(idx));
  }

  /**
   * Format diff lines into a unified diff string.
   */
  private _formatUnified(
    diffLines: DiffLine[],
    _oldLineCount: number,
    _newLineCount: number,
  ): string {
    if (diffLines.length === 0) return '';

    // Determine the range for the @@ header
    const firstOld = diffLines.find((d) => d.type !== '+');
    const firstNew = diffLines.find((d) => d.type !== '-');

    const oldStart = firstOld?.oldLine ?? 1;
    const newStart = firstNew?.newLine ?? 1;

    const oldCount = diffLines.filter((d) => d.type !== '+').length;
    const newCount = diffLines.filter((d) => d.type !== '-').length;

    const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    const body = diffLines.map((d) => `${d.type}${d.content}`).join('\n');

    return `${header}\n${body}\n`;
  }

  // -----------------------------------------------------------------------
  // Diff parser
  // -----------------------------------------------------------------------

  /**
   * Parse a unified diff string back into DiffLine entries.
   * Skips the @@ header line.
   */
  private _parseDiff(diff: string): DiffLine[] {
    const lines = diff.split('\n');
    const result: DiffLine[] = [];
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }

      if (!inHunk) continue;

      if (line.startsWith('+')) {
        result.push({ type: '+', content: line.slice(1) });
      } else if (line.startsWith('-')) {
        result.push({ type: '-', content: line.slice(1) });
      } else if (line.startsWith(' ')) {
        result.push({ type: ' ', content: line.slice(1) });
      }
      // Skip any other lines (e.g. trailing newlines, \ No newline at end of file)
    }

    return result;
  }
}
