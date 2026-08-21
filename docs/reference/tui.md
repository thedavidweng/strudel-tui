# Reference: TUI commands and shortcuts

Everything you can type or press inside the running TUI.

> The `help` output below is rendered from the same `formatHelp()` function the
> TUI prints. Screenshots of panels are illustrative; every command and key
> listed is real.

## Input box commands

Type these in the input box (left pane) and press `Enter`. Slash-prefixed forms
(`/play`, `/make …`, `/load …`) work identically, with autocomplete via
`SlashCommandMenu`.

| Command | Aliases | Effect |
|---------|---------|--------|
| `play` | `start`, `go` | Start playback of the current pattern |
| `stop` | `pause`, `hush` | Stop all playing patterns |
| `make <description>` | `create`, `generate` | Generate a pattern — AI-interpreted with an agent; a seeded algorithmic melody in keyword mode ([details](../how-to/edit-patterns.md#scenario-generate-a-pattern-without-an-agent)) |
| `edit <instruction>` | `change`, `modify` | Transform the current pattern |
| `validate` | `check` | Syntax-check the current pattern (`Valid pattern.` / `Invalid: …`) |
| `list` | `patterns` | List built-in and saved patterns |
| `load <name>` | `open` | Load a pattern by name |
| `undo` | | Revert to the previous pattern |
| `redo` | | Re-apply the last undone change |
| `help` | | Print the help block below |

Anything else is treated as Strudel code and set directly as the current
pattern:

```text
> s("bd*4, [- sd]*2, hh*8")
Pattern set.
```
*(Illustrative.)*

## `help` output

```text
=== Commands ===
  play / start / go  --  Start audio playback of the current pattern
  stop / pause / hush  --  Stop all playing patterns
  make / create / generate <description>  --  Generate a new pattern from a text description
    Example: make a funky drum beat
  edit / change / modify <instruction>  --  Modify the current pattern based on instructions
    Example: edit make it slower
  validate / check  --  Validate the current pattern for syntax errors
  list / patterns  --  List built-in and saved patterns
  load / open <name>  --  Load a pattern by name
    Example: load acid
  undo  --  Revert to the previous pattern
  redo  --  Re-apply the last undone pattern change
  help  --  Show this help message

=== Keyboard Shortcuts ===
  Ctrl+P      Toggle play/stop
  Ctrl+E      Edit pattern in place (Ctrl+X save, Ctrl+E/Esc discard)
  Ctrl+S      Save current pattern to file
  Ctrl+L      Clear message history
  Ctrl+C      Quit strudel-tui (press twice)
  Up/Down     Scroll through input history

=== Example Patterns ===
  Basic drums: s("bd sn hh cp")
    Four basic drum sounds in sequence
  Fast hi-hats: s("hh*8")
    Eight hi-hats per cycle
  Kick and snare: s("bd*4, [- sd]*2")
    Four kicks with snare on beats 2 and 4
  Melody: note("c d e f g a b c5").sound("triangle")
    Simple ascending scale with triangle wave
  Chord progression: note("<c e g> <d f a> <e g b>").sound("sawtooth").slow(2)
    Slow chord progression with sawtooth
  Techno beat: s("bd*4, [- sd]*2, hh*8")
    Classic techno kick-snare-hihat pattern

Tip: Type any Strudel code directly to evaluate it as a pattern.
```

## Keyboard shortcuts

| Keys | Description |
|------|-------------|
| `Ctrl+P` | Toggle play/stop |
| `Ctrl+E` | Edit the pattern in place (`Ctrl+X` saves, `Ctrl+E`/`Esc` discards) |
| `Ctrl+S` | Save the current pattern to `~/.strudel-tui/patterns/untitled.strudel` |
| `Ctrl+L` | Clear the message history |
| `Ctrl+C` | Quit (press twice; a single press clears the input or interrupts a streaming reply) |
| `Up` / `Down` | Step through your input history |

## Status bar

Three lines pinned above the panes (`src/tui/StatusBar.ts`): title plus a
rotating tip, then state, BPM, pattern name, agent mode, and model:

```text
strudel-tui v0.1.0                          ctrl+p play/stop · ctrl+s save
STOPPED  ·  130 BPM  ·  untitled  ·  ◇ keyword  ·  model not set — /config
──────────────────────────────────────────────────────────────────────────────
```
*(Illustrative — keyword mode, not playing. Playing shows `PLAYING`; with an AI
agent the mode reads `◆ AI` followed by the model name, e.g.
`◆ AI  ·  deepseek-chat`.) The tip on line one rotates every ~10 s through
hints like `Send /help for all commands` and `/config to set up AI provider`.)*

While the agent streams, the state slot becomes a Braille spinner.
