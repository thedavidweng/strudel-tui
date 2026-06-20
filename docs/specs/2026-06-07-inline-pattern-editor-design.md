# Inline Pattern Editor Design

## Overview

Turn the read-only `PatternPanel` into a nano-like inline code editor, allowing users to directly edit Strudel patterns in the TUI (like strudel.cc). A shortcut toggles between the editor and chat input.

## Goals

- Edit patterns directly in the PatternPanel without going through the chat
- Simple, nano-like editing: cursor movement, insert/delete, line splitting
- Seamless toggle between editor and chat with Ctrl+E / Ctrl+X
- Auto-apply pattern on save (Ctrl+X), auto-play if playback was active

## Visual Design

**Read-only mode** (unchanged):
```
┌ Pattern Editor ───────────────────── stopped ┐
│  1 │ s("bd sn").lpf(800)                     │
│  2 │ .room(0.5)                              │
└──────────────────────────────────────────────┘
```

**Edit mode**:
```
┌ Pattern Editor ───── editing ─────── stopped ┐
│  1 │ s("bd sn").lpf(800)                     │
│> 2 │ .r▌oom(0.5)                             │
│                                               │
│ ^X Save&Exit ^E Discard                       │
└──────────────────────────────────────────────┘
```

- Cursor renders as inverse-video character over the text (`▌`)
- Current line gets `>` indicator on the line number
- Title bar shows `── editing ──` instead of `────────────`
- Bottom help bar shows `^X Save&Exit ^E Discard`
- View scrolls to keep cursor visible when pattern has more lines than panel height

## Key Bindings

### Mode Switching (Global, handled in StrudelTUI.handleGlobalInput)

| Key | From Chat | From Editor |
|-----|-----------|-------------|
| Ctrl+E | Enter editor mode | Exit editor, discard changes |
| Ctrl+X | (no-op) | Save & exit editor, apply pattern |

### Editor Keys (handled by PatternPanel.handleInput)

| Key | Action |
|-----|--------|
| Up/Down/Left/Right arrows | Cursor movement |
| Home / End | Line start / line end |
| Backspace | Delete char before cursor (join lines if at col 0) |
| Delete | Delete char at cursor |
| Enter | Split line at cursor position |

## Architecture

### Modified Files

#### 1. `src/tui/PatternPanel.ts` (major changes)

**New state fields:**
- `_editMode: boolean` — whether editor is active
- `_cursorLine: number` — cursor line index (0-based)
- `_cursorCol: number` — cursor column index (0-based)
- `_editBuffer: string[]` — lines being edited (mutable copy)
- `_originalPattern: string` — pattern before editing (for discard)
- `_scrollOffset: number` — vertical scroll offset for long patterns
- `_helpBar: boolean` — whether to show the help bar (always true in edit mode)

**New public methods:**
- `enterEditMode(): void` — copies `_pattern` to `_editBuffer` and `_originalPattern`, sets cursor to last line/col, sets `_editMode = true`
- `exitEditMode(apply: boolean): string` — if `apply`, joins `_editBuffer` into string and sets `_pattern`; if discard, restores `_originalPattern`. Returns the resulting pattern string. Sets `_editMode = false`.
- `handleInput(data: Buffer): boolean` — processes keystrokes when in edit mode, returns `true` if the key was consumed

**New callback:**
- `onApply: (pattern: string) => void` — called when Ctrl+X applies the pattern

**Modified render():**
- When `_editMode`:
  - Render cursor character with inverse video ANSI escape (`\x1b[7m`)
  - Prefix current line number with `>` instead of space
  - Adjust `_scrollOffset` so cursor line is visible within available height
  - Render help bar at bottom: `│ ^X Save&Exit ^E Discard │`
  - Title shows `── editing ──`
- When not `_editMode`: render exactly as before

**Private editing helpers:**
- `insertChar(ch: string)` — insert character at cursor, advance cursor
- `deleteCharBackward()` — delete char before cursor, or join with previous line if at col 0
- `deleteCharForward()` — delete char at cursor, or join with next line if at end
- `splitLine()` — split current line at cursor position, move cursor to start of new line
- `moveCursor(dLine, dCol)` — move cursor with bounds checking, wrapping at line ends

#### 2. `src/tui/StrudelTUI.ts` (moderate changes)

**In constructor:**
- Wire up `patternPanel.onApply` callback to apply pattern and trigger evaluation

**In handleGlobalInput():**
- Add Ctrl+E handling:
  - If not in edit mode: save `_wasPlaying` state, call `patternPanel.enterEditMode()`, `tui.setFocus(patternPanel)` (or route input to panel)
  - If in edit mode: call `patternPanel.exitEditMode(false)`, `tui.setFocus(inputField)`
- Add Ctrl+X handling (only when in edit mode):
  - Call `patternPanel.exitEditMode(true)`, get resulting pattern
  - Apply to engine via `toolExecutor` or direct `strudelEngine.evaluate()`
  - If `_wasPlaying`, trigger playback
  - `tui.setFocus(inputField)`
- When in edit mode, route non-shortcut input to `patternPanel.handleInput(data)`

**Focus management (input routing approach):**
- PatternPanel does NOT need to become Focusable. Instead, `handleGlobalInput` checks `patternPanel._editMode` to route input.
- Flow: `handleGlobalInput` first checks global shortcuts (Ctrl+C, Ctrl+P, Ctrl+S, Ctrl+L). Then checks Ctrl+E / Ctrl+X for mode switching. Then if in edit mode, forwards remaining input to `patternPanel.handleInput(data)`. If not in edit mode, falls through to the Input component as before.

#### 3. `src/tui/theme.ts` (minor)

- Add `editCursor` color to theme (or use existing inverse video)
- Add `helpBar` color for the bottom help text

### Data Flow

```
Chat mode:
  Input.onSubmit → handleSubmit → Agent → patternPanel.setPattern()

Edit mode:
  handleGlobalInput → patternPanel.handleInput → _editBuffer mutation
  Ctrl+X → patternPanel.exitEditMode(true) → onApply callback → engine.evaluate()
```

### Pattern Sync

- When the agent updates the pattern while user is in edit mode, the update is buffered — the editor keeps its buffer. On exit (apply or discard), the agent's latest pattern is overwritten.
- Alternative: show a warning if the agent changes the pattern while editing. This is out of scope for v1.

## Edge Cases

1. **Empty pattern**: Editor should allow creating patterns from scratch (empty buffer with one empty line)
2. **Single line**: All operations work on a single line; Enter creates line 2
3. **Cursor at boundaries**: Arrow up on line 0 → no-op. Arrow left at col 0 → move to end of previous line.
4. **Long patterns**: View scrolls vertically. `_scrollOffset` adjusts to keep cursor visible.
5. **Wide lines**: Content truncates at panel width (existing behavior). Cursor position is clamped to visible area.
6. **Ctrl+P during edit**: Global play/stop still works. Pattern being edited is not auto-applied.
7. **Ctrl+S during edit**: Save current edit buffer to file (joins `_editBuffer` lines and saves, does NOT exit edit mode or apply to engine).
8. **Agent changes pattern while editing**: Edit buffer is preserved; agent changes are lost on Ctrl+X apply. Future improvement: detect conflict.

## Out of Scope (v1)

- Syntax highlighting in edit mode (would need per-character state tracking)
- Undo/redo in editor
- Selection / copy-paste (beyond single line)
- Multi-cursor
- Autocomplete
- Shift+Tab or other advanced navigation
