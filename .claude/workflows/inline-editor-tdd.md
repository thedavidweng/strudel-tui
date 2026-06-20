export const meta = {
  name: 'inline-editor-tdd',
  description: 'Implement inline pattern editor with TDD: tests first, then implementation',
  phases: [
    { title: 'RED: Write PatternPanel edit mode tests' },
    { title: 'GREEN: Implement edit mode state and input' },
    { title: 'RED: Write render tests' },
    { title: 'GREEN: Implement render for edit mode' },
    { title: 'Wire up StrudelTUI and theme' },
    { title: 'Verify' },
  ],
}

// ===========================================================================
// Phase 1: RED — Write failing tests for PatternPanel edit mode
// ===========================================================================
phase('RED: Write PatternPanel edit mode tests')

const testFile = await agent(
  `Write a test file at tests/pattern-panel-editor.test.ts for the PatternPanel edit mode feature.

Context: PatternPanel is at src/tui/PatternPanel.ts. It currently has:
- _pattern: string, _playing: boolean
- setPattern(text), setPlaying(playing), render(width): string[]
- It implements the Component interface from pi-tui

The new edit mode adds:
- enterEditMode(): copies _pattern to _editBuffer, sets cursor to end
- exitEditMode(apply: boolean): if apply, sets _pattern from buffer; if discard, restores original
- editMode: boolean getter
- handleInput(data: string): boolean — processes keystrokes, returns true if consumed
- onApply: ((pattern: string) => void) | null callback

Write these tests using bun:test (import from 'bun:test'):

1. enterEditMode:
   - sets editMode to true
   - copies pattern into editable buffer (verify via render output or internal state)
   - sets cursor to end of last line
   - works with empty pattern

2. exitEditMode(true) — apply:
   - sets editMode to false
   - pattern is updated to buffer content
   - returns the applied pattern string

3. exitEditMode(false) — discard:
   - sets editMode to false
   - pattern is restored to original
   - returns the original pattern string

4. handleInput — character insertion:
   - inserting a character at end of line appends it
   - inserting a character in the middle of a line inserts it

5. handleInput — arrow keys:
   - left/right moves cursor
   - up/down moves between lines

6. handleInput — backspace:
   - deletes char before cursor
   - at col 0, joins with previous line

7. handleInput — delete:
   - deletes char at cursor
   - at end of line, joins with next line

8. handleInput — enter:
   - splits line at cursor position

9. handleInput returns false for unknown keys

For testing handleInput, you need to generate the correct key data strings. pi-tui uses matchesKey(data, Key.xxx). The key data for:
- Arrow up: use Key.up from pi-tui or \\x1b[A
- Arrow down: Key.down or \\x1b[B
- Arrow right: Key.right or \\x1b[C
- Arrow left: Key.left or \\x1b[D
- Backspace: Key.backspace or \\x7f
- Delete: Key.delete or \\x1b[3~
- Enter: Key.enter or \\r
- Printable chars: just the character string like 'a', 'b', etc.

Import Key and matchesKey from '@earendil-works/pi-tui' for generating key data.
Import PatternPanel from '../src/tui/PatternPanel'.

IMPORTANT: The handleInput method does NOT exist yet. The tests MUST fail. Write the tests assuming the API described above exists. Use try/catch or just let the import fail — the point is these are RED tests.

Write the complete file. No placeholders.`,
  { label: 'write-edit-mode-tests', phase: 'RED: Write PatternPanel edit mode tests' }
)

// Verify RED
const redResult1 = await agent(
  `Run the tests in tests/pattern-panel-editor.test.ts using bun test.

Command: cd /Users/david/Development/strudel-tui && bun test tests/pattern-panel-editor.test.ts

Report:
1. Did the tests fail? (They SHOULD fail — the methods don't exist yet)
2. What was the error message?
3. Did any tests accidentally pass? (That would be wrong)

Just report the results, do not fix anything.`,
  { label: 'verify-red-1', phase: 'RED: Write PatternPanel edit mode tests' }
)

// ===========================================================================
// Phase 2: GREEN — Implement edit mode in PatternPanel
// ===========================================================================
phase('GREEN: Implement edit mode state and input')

await agent(
  `Implement the edit mode feature in src/tui/PatternPanel.ts to make the failing tests pass.

Read the test file at tests/pattern-panel-editor.test.ts first to understand exactly what API is expected.

Then modify src/tui/PatternPanel.ts to add:

1. Update the import (line 12) to include decodeKittyPrintable, Key, matchesKey from '@earendil-works/pi-tui':
   import { Component, visibleWidth, truncateToWidth, decodeKittyPrintable, Key, matchesKey } from '@earendil-works/pi-tui';

2. Add state fields after _spinTick (line 100):
   - _editMode = false
   - _cursorLine = 0
   - _cursorCol = 0
   - _editBuffer: string[] = []
   - _originalPattern = ''
   - _scrollOffset = 0
   - onApply: ((pattern: string) => void) | null = null

3. Add getter:
   get editMode(): boolean { return this._editMode; }

4. Add enterEditMode():
   - Copy _pattern to _editBuffer (split by \\n) and _originalPattern
   - Set _editMode = true
   - Set cursor to end of last line
   - Call invalidate()

5. Add exitEditMode(apply: boolean): string
   - If apply: join _editBuffer into _pattern
   - If discard: restore _pattern from _originalPattern
   - Reset edit state, set _editMode = false
   - Call invalidate()
   - Return the resulting pattern

6. Add handleInput(data: string): boolean
   - Return false if not in edit mode
   - Handle: Key.up, Key.down, Key.left, Key.right (use moveCursor)
   - Handle: Key.home (col=0), Key.end (col=line.length)
   - Handle: Key.backspace (delete before cursor, join lines at col 0)
   - Handle: Key.delete (delete at cursor, join lines at end)
   - Handle: Key.enter (split line at cursor)
   - Handle: printable chars via decodeKittyPrintable(data) or single char >= ' '
   - Return true if key was consumed, false otherwise

7. Add moveCursor(dLine, dCol) private method:
   - Clamp line to [0, buffer.length-1]
   - Clamp col to [0, line.length]

Write minimal code to make the tests pass. Do NOT modify render() yet — that's a separate task.

After implementing, run: cd /Users/david/Development/strudel-tui && bun test tests/pattern-panel-editor.test.ts
Report the results. All tests should pass.`,
  { label: 'implement-edit-mode', phase: 'GREEN: Implement edit mode state and input' }
)

// ===========================================================================
// Phase 3: RED — Write render tests
// ===========================================================================
phase('RED: Write render tests')

await agent(
  `Write tests for PatternPanel render() in edit mode. Add these to the existing test file at tests/pattern-panel-editor.test.ts (append to the file, don't overwrite).

Read the current test file first to see what's already there.

Add a new describe block: 'render in edit mode'

Tests:
1. 'shows editing label in title when in edit mode'
   - Create panel, set pattern, enterEditMode()
   - render(80) should contain 'editing' in the output

2. 'shows help bar in edit mode'
   - render output should contain 'Save&Exit' and 'Discard'

3. 'shows > indicator on current line in edit mode'
   - The current cursor line should have '>' in the gutter

4. 'shows cursor character on current line'
   - The cursor position should be visible (inverse video or special rendering)

5. 'does not show editing label when not in edit mode'
   - Normal render should NOT contain 'editing'

6. 'does not show help bar when not in edit mode'
   - Normal render should NOT contain 'Save&Exit'

Use chalk.stripAnsi or similar to check content without ANSI codes, or just check the raw string contains the expected substrings.

IMPORTANT: The render changes don't exist yet. These tests MUST fail. Write them assuming the render() method will be updated to show these elements in edit mode.

Run: cd /Users/david/Development/strudel-tui && bun test tests/pattern-panel-editor.test.ts
Report which tests fail (they should be the new render tests).`,
  { label: 'write-render-tests', phase: 'RED: Write render tests' }
)

// ===========================================================================
// Phase 4: GREEN — Implement render for edit mode
// ===========================================================================
phase('GREEN: Implement render for edit mode')

await agent(
  `Update PatternPanel.render() in src/tui/PatternPanel.ts to support edit mode display.

Read the test file at tests/pattern-panel-editor.test.ts to understand exactly what's expected.

Modify the render(width) method to:

1. Change signature to render(width: number, height?: number)

2. Title bar changes when _editMode:
   - Show '── editing ──' in the dash area (using colors.warning)
   - Keep the playing/stopped indicator

3. Pattern lines in edit mode:
   - Use _editBuffer instead of _pattern.split('\\n')
   - Show '>' prefix on the current cursor line's gutter
   - On the cursor line, render cursor as chalk.inverse() over the character at cursor position
   - Adjust _scrollOffset to keep cursor line visible

4. Help bar in edit mode:
   - After pattern lines, before bottom border, add:
     │ ^X Save&Exit ^E Discard │
   - Use colors.textMuted for the text

5. When NOT in edit mode, render exactly as before (no changes)

Also add a private renderLineWithCursor(line: string, maxWidth: number): string method that:
- Splits line at cursor col
- Highlights before and after with highlightLine()
- Wraps cursor char with chalk.inverse()
- Returns the combined string

After implementing, run: cd /Users/david/Development/strudel-tui && bun test tests/pattern-panel-editor.test.ts
Report the results. All tests should pass.`,
  { label: 'implement-render', phase: 'GREEN: Implement render for edit mode' }
)

// ===========================================================================
// Phase 5: Wire up StrudelTUI and theme
// ===========================================================================
phase('Wire up StrudelTUI and theme')

await agent(
  `Wire up the editor toggle in src/tui/StrudelTUI.ts and update the theme.

## StrudelTUI changes:

1. Add state field after exitArmed (line ~118):
   private wasPlaying = false;

2. Wire up onApply callback after patternPanel.setPattern (line ~155):
   this.patternPanel.onApply = (editedPattern: string) => {
     this.pattern = editedPattern;
     void this.applyEditedPattern();
   };

3. Add applyEditedPattern() method after handleSave():
   private async applyEditedPattern(): Promise<void> {
     try {
       if (this.playing) {
         await this.audio.play(this.pattern);
       }
       this.patternPanel.setPattern(this.pattern);
       this.addMessage('system', 'Pattern applied');
     } catch (err: any) {
       this.addMessage('error', \`Apply error: \${err.message}\`);
     }
   }

4. In handleGlobalInput(), after the Ctrl+L handler and BEFORE the Escape handler, add:

   // Ctrl+E: toggle editor mode
   if (matchesKey(data, Key.ctrl('e'))) {
     if (this.patternPanel.editMode) {
       this.patternPanel.exitEditMode(false);
       this.addMessage('system', 'Editor closed (discarded)');
     } else {
       this.wasPlaying = this.playing;
       this.patternPanel.enterEditMode();
     }
     this.tui.requestRender();
     return { consume: true };
   }

   // Ctrl+X: save & exit editor (only in edit mode)
   if (matchesKey(data, Key.ctrl('x')) && this.patternPanel.editMode) {
     const edited = this.patternPanel.exitEditMode(true);
     this.pattern = edited;
     void this.applyEditedPattern();
     this.tui.requestRender();
     return { consume: true };
   }

5. In handleGlobalInput(), after the Ctrl+X handler and BEFORE the Escape handler, add input routing:

   // Route input to editor when in edit mode
   if (this.patternPanel.editMode) {
     const consumed = this.patternPanel.handleInput(data);
     if (consumed) {
       this.tui.requestRender();
       return { consume: true };
     }
   }

## Theme changes:

In src/tui/theme.ts:
1. Add to ColorPalette interface after 'pattern':
   editCursor: string;
   editHelp: string;

2. Add to dark palette after 'pattern':
   editCursor: '#E07C4F',
   editHelp: '#555555',

3. Add to light palette after 'pattern':
   editCursor: '#B85C2F',
   editHelp: '#999999',

## StatusBar changes:

In src/tui/StatusBar.ts, find the tips array and add:
   'Ctrl+E: edit pattern directly',

After all changes, run: cd /Users/david/Development/strudel-tui && bun test
Report results — all existing tests should still pass.`,
  { label: 'wire-up-tui', phase: 'Wire up StrudelTUI and theme' }
)

// ===========================================================================
// Phase 6: Verify — build and type check
// ===========================================================================
phase('Verify')

await agent(
  `Verify the implementation compiles and all tests pass.

Run these commands:
1. cd /Users/david/Development/strudel-tui && bun test
2. cd /Users/david/Development/strudel-tui && npx tsc --noEmit 2>&1 | head -30

Report:
- Test results (pass/fail count)
- TypeScript errors (if any)
- Any issues found

If there are errors, fix them and re-run until clean.`,
  { label: 'verify-build', phase: 'Verify' }
)
