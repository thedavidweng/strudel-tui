# E2E Smoke Test Guide

Manual end-to-end tests for strudel-tui. Run these before releases or after major changes.

## Prerequisites

- Built binary: `bun run build` → `bin/strudel-tui`
- Audio output available (for playback tests)
- LLM API key configured (for AI tests)

## Test Matrix

### 1. Launch & Basic TUI

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | `./bin/strudel-tui` | App launches, shows welcome/status bar |
| 1.2 | `./bin/strudel-tui --bpm 140` | Status bar shows BPM 140 |
| 1.3 | `./bin/strudel-tui --debug` | Debug indicators visible |
| 1.4 | Resize terminal window | Layout adapts, no crashes |
| 1.5 | Press `Ctrl+C` once | Shows "Press ctrl+c again to exit" (or clears input / interrupts streaming) |
| 1.6 | Press `Ctrl+C` twice quickly | Exits; terminal restored to the normal screen, prompt intact |

### 2. Pattern Editor

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Type `s("bd sn")` and press Enter | Pattern set in editor panel |
| 2.2 | Verify syntax highlighting | Strings green, functions cyan, numbers yellow |
| 2.3 | Enter multi-line pattern | Line numbers display correctly |
| 2.4 | Enter invalid syntax | Error message in chat |

### 3. Playback

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Type `/play` or press `Ctrl+P` | Browser tab opens; after clicking "Enable audio" once, audio starts and status shows PLAYING |
| 3.2 | Press `Ctrl+P` again | Audio stops, status shows STOPPED |
| 3.3 | Type `/stop` | Audio stops |
| 3.4 | Type `play` (natural language) | Keyword adapter triggers playback |

### 4. Slash Commands

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Type `/` | Autocomplete menu appears |
| 4.2 | Type `/pl` | Menu filters to `/play` |
| 4.3 | Press `Down` then `Enter` | Selected command executes |
| 4.4 | Press `Escape` | Menu closes |
| 4.5 | Type `/help` | Help text displayed |
| 4.6 | Type `/undo` | Reverts to previous pattern |
| 4.7 | Type `/redo` | Re-applies change |
| 4.8 | Type `/clear` | Chat history cleared |
| 4.9 | Type `/save test-name` | Pattern saved to file |

### 5. AI Agent (requires API key)

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Type "make a chill beat" | Agent generates and sets pattern |
| 5.2 | Type "add reverb" | Agent modifies current pattern |
| 5.3 | Type "play" | Agent triggers playback |
| 5.4 | Type `/make a jazzy bassline` | Agent generates pattern |
| 5.5 | Type `/edit make it faster` | Agent modifies pattern |

### 6. Config

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Type `/config` | Config panel opens |
| 6.2 | Navigate config options | Values displayed correctly |
| 6.3 | Press `Escape` | Config panel closes |
| 6.4 | Type `/provider` | Provider selection opens |

### 7. Keyboard Shortcuts

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | `Ctrl+P` | Toggle play/stop |
| 7.2 | `Ctrl+S` | Save current pattern |
| 7.3 | `Ctrl+L` | Clear chat |
| 7.4 | `Ctrl+C` (while playing) | Stop playback |
| 7.5 | `Ctrl+C` (while idle) | Exit app |
| 7.6 | `Tab` | Accept slash command suggestion |
| 7.7 | `Up/Down` | Navigate input history or suggestions |
| 7.8 | `Escape` | Close overlays/menus |

### 8. Edge Cases

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Launch with `--pattern nonexistent.strudel` | Graceful error message |
| 8.2 | Send message while agent is streaming | Queued, processed after |
| 8.3 | Very long pattern (20+ lines) | Editor scrolls, no overflow |
| 8.4 | Rapid Ctrl+P presses | No crash, state consistent |
| 8.5 | Terminal too small (< 40 cols) | Graceful degradation |

## Sign-off Checklist

- [ ] All launch tests pass
- [ ] Pattern editor renders correctly
- [ ] Playback works (audio heard)
- [ ] Slash commands functional
- [ ] AI agent responds (if configured)
- [ ] Config panel works
- [ ] All keyboard shortcuts work
- [ ] No crashes on edge cases
- [ ] Clean exit on Ctrl+C

## Metrics to Capture

After each smoke test run, record:

- **Test execution time**: How long the full smoke test took
- **Defects found**: Count and severity
- **Defect leakage**: Any bugs found in E2E that should have been caught by unit/integration tests
- **Automation coverage**: Percentage of smoke tests that could be automated
