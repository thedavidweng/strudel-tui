# Inline Pattern Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only PatternPanel into a nano-like inline code editor with Ctrl+E/Ctrl+X toggle between editor and chat.

**Architecture:** Extend PatternPanel with edit mode state (cursor, buffer, scroll). Add `handleInput()` for keystroke processing and `enterEditMode()`/`exitEditMode()` for mode switching. StrudelTUI routes Ctrl+E/Ctrl+X globally and forwards remaining input to the panel when in edit mode.

**Tech Stack:** TypeScript, pi-tui (`matchesKey`, `Key`, `parseKey`, `decodeKittyPrintable`, `visibleWidth`, `truncateToWidth`), chalk

---

### Task 1: Add edit mode state and input handling to PatternPanel

**Files:**
- Modify: `src/tui/PatternPanel.ts`

- [ ] **Step 1: Add edit mode state fields and callbacks**

Add these fields after the existing `_spinTick` field (line 100):

```typescript
  // Edit mode state
  private _editMode = false;
  private _cursorLine = 0;
  private _cursorCol = 0;
  private _editBuffer: string[] = [];
  private _originalPattern = '';
  private _scrollOffset = 0;

  /** Called when user saves with Ctrl+X. Receives the edited pattern text. */
  onApply: ((pattern: string) => void) | null = null;
```

- [ ] **Step 2: Add enterEditMode() method**

Add after `setPlaying()`:

```typescript
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
```

- [ ] **Step 3: Add exitEditMode() method**

Add after `enterEditMode()`:

```typescript
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
```

- [ ] **Step 4: Add isEditMode getter**

Add after `exitEditMode()`:

```typescript
  get editMode(): boolean {
    return this._editMode;
  }
```

- [ ] **Step 5: Add handleInput() method for keystroke processing**

Add after the `editMode` getter. This imports `parseKey` and `decodeKittyPrintable` from pi-tui:

First, update the import at the top of the file (line 12):

```typescript
import { Component, visibleWidth, truncateToWidth, decodeKittyPrintable, Key, matchesKey } from '@earendil-works/pi-tui';
```

Then add the method:

```typescript
  handleInput(data: string): boolean {
    if (!this._editMode) return false;

    // Arrow keys
    if (matchesKey(data, Key.up)) { this.moveCursor(-1, 0); return true; }
    if (matchesKey(data, Key.down)) { this.moveCursor(1, 0); return true; }
    if (matchesKey(data, Key.left)) { this.moveCursor(0, -1); return true; }
    if (matchesKey(data, Key.right)) { this.moveCursor(0, 1); return true; }

    // Home / End
    if (matchesKey(data, Key.home)) { this._cursorCol = 0; this.invalidate(); return true; }
    if (matchesKey(data, Key.end)) { this._cursorCol = this._editBuffer[this._cursorLine]!.length; this.invalidate(); return true; }

    // Backspace
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

    // Delete
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

    // Enter
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

    // Printable characters (including Kitty protocol)
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
```

- [ ] **Step 6: Add moveCursor() helper**

Add after `handleInput()`:

```typescript
  private moveCursor(dLine: number, dCol: number): void {
    this._cursorLine = Math.max(0, Math.min(this._editBuffer.length - 1, this._cursorLine + dLine));
    this._cursorCol = Math.max(0, Math.min(this._editBuffer[this._cursorLine]!.length, this._cursorCol + dCol));
    // If moved vertically and col exceeds line length, clamp
    if (this._cursorCol > this._editBuffer[this._cursorLine]!.length) {
      this._cursorCol = this._editBuffer[this._cursorLine]!.length;
    }
    this.invalidate();
  }
```

- [ ] **Step 7: Commit**

```bash
git add src/tui/PatternPanel.ts
git commit -m "feat(editor): add edit mode state and input handling to PatternPanel"
```

---

### Task 2: Update PatternPanel.render() for edit mode display

**Files:**
- Modify: `src/tui/PatternPanel.ts` (the `render()` method, lines 106-161)

- [ ] **Step 1: Replace the render() method**

Replace the entire `render(width: number)` method with this version that handles both modes:

```typescript
  render(width: number, height?: number): string[] {
    const lines: string[] = [];
    const panelWidth = Math.max(20, width);

    // --- Title bar: ┌ Pattern Editor ────────
    const modeLabel = this._editMode ? ' editing ' : '';
    const playingLabel = this._playing
      ? chalk.hex(colors.playing).bold(` ${BRAILLE_DOTS[this._spinTick % BRAILLE_DOTS.length]} playing `)
      : chalk.hex(colors.stopped)(' stopped ');
    if (this._playing) this._spinTick++;

    const titleText = ' Pattern Editor ';
    const titleVis = visibleWidth(titleText);
    const playingVis = visibleWidth(this._playing ? ` ${BRAILLE_DOTS[0]} playing ` : ' stopped ');
    const modeVis = this._editMode ? visibleWidth(modeLabel) + 2 : 0; // 2 for spaces around mode
    const borderVis = 2; // ┌ and ┐
    const gap = 1;
    const dashCount = Math.max(1, panelWidth - borderVis - titleVis - modeVis - playingVis - gap);
    let topBorder = chalk.hex(colors.border)('┌') + chalk.hex(colors.primary).bold(titleText);
    if (this._editMode) {
      const modeDash = Math.floor(Math.max(0, dashCount - modeVis) / 2);
      topBorder += chalk.hex(colors.border)('─'.repeat(modeDash));
      topBorder += chalk.hex(colors.warning)(modeLabel);
      topBorder += chalk.hex(colors.border)('─'.repeat(dashCount - modeDash - modeVis));
    } else {
      topBorder += chalk.hex(colors.border)('─'.repeat(dashCount));
    }
    topBorder += ' ' + playingLabel + chalk.hex(colors.border)('┐');
    lines.push(topBorder);

    // --- Pattern lines ---
    const sourceLines = this._editMode ? this._editBuffer : this._pattern.split('\n');
    const patternLines = sourceLines.length === 0 ? [''] : sourceLines;
    const gutterWidth = String(patternLines.length).length;
    const prefixOverhead = gutterWidth + 4; // gutter + " │ " + space
    const contentMax = Math.max(10, panelWidth - prefixOverhead - 2); // -2 for borders

    // Calculate visible area (reserve 1 line for help bar in edit mode, 0 otherwise)
    const helpBarLines = this._editMode ? 1 : 0;
    // height is passed by pi-tui; subtract 2 for top+bottom borders, 1 for help bar
    const availableHeight = Math.max(1, (height ?? 20) - 2 - helpBarLines);

    // Adjust scroll offset to keep cursor visible
    if (this._editMode) {
      const maxVisible = availableHeight;
      if (this._cursorLine < this._scrollOffset) {
        this._scrollOffset = this._cursorLine;
      } else if (this._cursorLine >= this._scrollOffset + maxVisible) {
        this._scrollOffset = this._cursorLine - maxVisible + 1;
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
        const truncated = raw.length > contentMax ? raw.slice(0, contentMax - 1) + '…' : raw;

        // Gutter: > for current line in edit mode, space otherwise
        const gutterIndicator = this._editMode && i === this._cursorLine ? '>' : ' ';
        let gutter = chalk.hex(colors.textMuted)(`${gutterIndicator}${lineNum}`);

        const pipe = chalk.hex(colors.border)(' │ ');

        let highlighted: string;
        if (this._editMode && i === this._cursorLine) {
          // Render current line with cursor
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

    // --- Help bar (edit mode only) ---
    if (this._editMode) {
      const helpText = ' ^X Save&Exit ^E Discard ';
      const helpContent = chalk.hex(colors.textMuted)(helpText);
      const helpVis = visibleWidth(helpText);
      const helpPad = Math.max(0, panelWidth - helpVis - 2);
      lines.push(chalk.hex(colors.border)('│') + helpContent + ' '.repeat(helpPad) + chalk.hex(colors.border)('│'));
    }

    // --- Bottom border: └───────────────────
    lines.push(chalk.hex(colors.border)('└' + '─'.repeat(panelWidth - 2) + '┘'));

    return lines;
  }
```

- [ ] **Step 2: Add renderLineWithCursor() helper**

Add after `moveCursor()`:

```typescript
  private renderLineWithCursor(line: string, maxWidth: number): string {
    const col = Math.min(this._cursorCol, line.length);
    const before = line.slice(0, col);
    const cursorChar = col < line.length ? line[col]! : ' ';
    const after = col < line.length ? line.slice(col + 1) : '';

    const highlightedBefore = highlightLine(before);
    const cursorStyled = chalk.inverse(cursorChar);
    const highlightedAfter = highlightLine(after);

    return highlightedBefore + cursorStyled + highlightedAfter;
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/tui/PatternPanel.ts
git commit -m "feat(editor): render cursor, line indicator, and help bar in edit mode"
```

---

### Task 3: Wire up Ctrl+E/Ctrl+X in StrudelTUI

**Files:**
- Modify: `src/tui/StrudelTUI.ts`

- [ ] **Step 1: Add _wasPlaying state field**

Add after the `exitArmed` field (line 118):

```typescript
  private wasPlaying = false;
```

- [ ] **Step 2: Wire up onApply callback in constructor**

After `this.patternPanel.setPattern(this.pattern);` (line 155), add:

```typescript
    this.patternPanel.onApply = (editedPattern: string) => {
      this.pattern = editedPattern;
      void this.applyEditedPattern();
    };
```

- [ ] **Step 3: Add applyEditedPattern() method**

Add after the `handleSave()` method (around line 668):

```typescript
  private async applyEditedPattern(): Promise<void> {
    try {
      if (this.playing) {
        await this.audio.play(this.pattern);
      }
      this.patternPanel.setPattern(this.pattern);
      this.addMessage('system', 'Pattern applied');
    } catch (err: any) {
      this.addMessage('error', `Apply error: ${err.message}`);
    }
  }
```

- [ ] **Step 4: Add Ctrl+E handler in handleGlobalInput()**

Add after the Ctrl+L handler (after line 307), before the Escape handler:

```typescript
    // ── Ctrl+E: toggle editor mode ──
    if (matchesKey(data, Key.ctrl('e'))) {
      if (this.patternPanel.editMode) {
        // Exit editor, discard changes
        this.patternPanel.exitEditMode(false);
        this.addMessage('system', 'Editor closed (discarded)');
      } else {
        // Enter editor
        this.wasPlaying = this.playing;
        this.patternPanel.enterEditMode();
      }
      this.tui.requestRender();
      return { consume: true };
    }

    // ── Ctrl+X: save & exit editor (only in edit mode) ──
    if (matchesKey(data, Key.ctrl('x')) && this.patternPanel.editMode) {
      const edited = this.patternPanel.exitEditMode(true);
      this.pattern = edited;
      void this.applyEditedPattern();
      this.tui.requestRender();
      return { consume: true };
    }
```

- [ ] **Step 5: Route input to PatternPanel when in edit mode**

Add in `handleGlobalInput()`, right after the Ctrl+X handler (from Step 4), before the Escape handler:

```typescript
    // If editor is active, forward non-global keys to PatternPanel
    if (this.patternPanel.editMode) {
      // Global shortcuts still work: Ctrl+C, Ctrl+P, Ctrl+S
      // Everything else goes to the editor
      const consumed = this.patternPanel.handleInput(data);
      if (consumed) {
        this.tui.requestRender();
        return { consume: true };
      }
    }
```

- [ ] **Step 6: Commit**

```bash
git add src/tui/StrudelTUI.ts
git commit -m "feat(editor): wire up Ctrl+E/Ctrl+X toggle and input routing"
```

---

### Task 4: Update theme and StatusBar tips

**Files:**
- Modify: `src/tui/theme.ts`
- Modify: `src/tui/StatusBar.ts`

- [ ] **Step 1: Add edit mode color to theme**

In `src/tui/theme.ts`, add to the `ColorPalette` interface after `pattern`:

```typescript
  // Editor
  editCursor: string;
  editHelp: string;
```

Add to the `dark` palette after `pattern`:

```typescript
  editCursor: '#E07C4F',
  editHelp: '#555555',
```

Add to the `light` palette after `pattern`:

```typescript
  editCursor: '#B85C2F',
  editHelp: '#999999',
```

- [ ] **Step 2: Add Ctrl+E to StatusBar tips**

Read `src/tui/StatusBar.ts` and add a tip about Ctrl+E to the rotating tips array. Look for the tips array and add:

```typescript
'Ctrl+E: edit pattern directly',
```

- [ ] **Step 3: Commit**

```bash
git add src/tui/theme.ts src/tui/StatusBar.ts
git commit -m "feat(editor): add edit mode colors and status bar tip"
```

---

### Task 5: Test the full flow manually

**Files:** None (manual testing)

- [ ] **Step 1: Run the app and test edit mode entry**

```bash
bun run src/index.ts
```

Press Ctrl+E. Verify:
- Title bar shows `── editing ──`
- Help bar appears at bottom
- Cursor is visible on last line

- [ ] **Step 2: Test basic editing**

Type some text, press Enter to create new lines, use arrow keys to move, use Backspace/Delete. Verify all editing operations work correctly.

- [ ] **Step 3: Test Ctrl+X save & exit**

Edit the pattern, press Ctrl+X. Verify:
- Returns to chat mode
- Pattern is updated in the panel
- "Pattern applied" message appears
- If playback was on, pattern is re-evaluated

- [ ] **Step 4: Test Ctrl+E discard**

Press Ctrl+E to enter editor, make changes, press Ctrl+E again. Verify:
- Returns to chat mode
- Pattern is reverted to original
- "Editor closed (discarded)" message appears

- [ ] **Step 5: Test global shortcuts during edit mode**

In edit mode, press Ctrl+P (play/stop). Verify it still works. Press Ctrl+S (save). Verify it saves the edit buffer.

- [ ] **Step 6: Commit any fixes**

If any issues are found and fixed during testing, commit the fixes.
