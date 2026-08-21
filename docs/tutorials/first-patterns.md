# Tutorial: Your first patterns

Make a beat in strudel-tui, hear it, change it, and save it — no API key needed.

This tutorial uses only keyword mode, which works out of the box. (Later you can
[connect an AI agent](../how-to/configure-ai-agent.md) and type plain English
instead.)

> **About the examples:** terminal output from the `strudel-tui` command itself is
> captured from real runs. Screens shown *inside* the TUI are illustrative — they
> use the app's real labels and messages, but your exact layout will differ with
> your terminal size and theme.

---

## 1. Install and launch

Install strudel-tui ([Homebrew](../../README.md#install) or from source), then launch it:

```bash
strudel-tui
```

You get a two-pane terminal UI: the pattern editor and input box on the left,
message history on the right, and a three-line status bar on top.

```text
strudel-tui v0.1.0                    No AI provider configured — send /config to set up
STOPPED  ·  130 BPM  ·  untitled  ·  ◇ keyword  ·  model not set — /config
──────────────────────────────────────────────────────────────────────────────
┌────────────────────────────────────────────┬─────────────────────────────┐
│                                            │                             │
│ > _                                        │                             │
│                                            │                             │
└────────────────────────────────────────────┴─────────────────────────────┘
```
*(Illustrative — empty session right after launch; the pattern slot reads
`untitled` until you save.)*

The status bar reads `STOPPED` until you play, and shows which mode the agent
is in: `◇ keyword` without an API key, `◆ AI` with your model's name when one
is configured.

## 2. Type a pattern

Type Strudel code directly into the input box and press `Enter`:

```text
> s("bd sn hh cp")
```

The pattern appears in the left pane and becomes the current pattern:

```text
1 | s("bd sn hh cp")
```
*(Illustrative — pattern panel after step 2.)*

Nothing sounds yet — you have only set what *will* play.

## 3. Check it

Ask strudel-tui to validate the pattern:

```text
> validate
```

```text
Valid pattern.
```
*(Illustrative — message history reply.)*

If you mistype, validation tells you where. For `s("bd sn"` (a missing closing
paren):

```text
Invalid: Unexpected token (1:9)
```
*(Illustrative — message from the same validator, `src/engine/PatternSyntax.ts`.)*

## 4. Play it

```text
> play
```

The status bar switches to `PLAYING`. The first time you play, two things happen:

1. strudel-tui starts a small local server and opens a page in your default
   browser.
2. The page shows one button — click **▶ Enable audio** (browsers only allow
   sound after a click).

```text
strudel-tui v0.1.0                    Send /help for all commands
PLAYING  ·  130 BPM  ·  untitled  ·  ◇ keyword  ·  model not set — /config
───────────────────────────────────────────────────────────────────────────────────
```
*(Illustrative — playing state; only the status bar shown.)*

You should now hear a kick, snare, hat, and clap loop. Details and troubleshooting:
[Play audio through your browser](../how-to/play-audio.md).

## 5. Change it

Transform the pattern:

```text
> edit faster
```

Each keyword edit is one of a fixed set of transforms
([full list](../how-to/edit-patterns.md)). Try a few:

```text
> edit louder
> edit reverse
> edit slower
```

Edits update the editor right away, but an already-running loop keeps playing
the version it started with — run `play` (or press `Ctrl+P`) to hear the latest
pattern. Made a change you dislike? Undo it:

```text
> undo
```

Then `play` again.

## 6. Stop and save

```text
> stop
```

Save the pattern so you can come back to it. Press `Ctrl+S`.

```text
Saved to ~/.strudel-tui/patterns/untitled.strudel
```
*(Illustrative — message after `Ctrl+S`.)*

Saved patterns live in `~/.strudel-tui/patterns/` and appear in `list` marked
`(user)`. Learn how to name and organize them:
[Manage pattern files](../how-to/manage-patterns.md).

## 7. Quit

Press `Ctrl+C` twice.

---

## Next steps

- [Connect an AI agent](../how-to/configure-ai-agent.md) and say `make a jazzy drum loop at 120 bpm`
- [Edit patterns](../how-to/edit-patterns.md) — every keyword transform, plus the in-place editor
- [Manage pattern files](../how-to/manage-patterns.md) — load, save, and shadow built-ins
- Curious how the browser makes sound? [Why audio runs in a browser tab](../explanation/audio-bridge.md)
