# How to: Edit a pattern

Three ways to change the current pattern: keyword transforms (no API key
needed), the in-place editor, and plain-English requests when an AI agent is
configured.

> In-TUI replies below are illustrative — they quote the app's real message
> formats (`src/agent/ToolExecutor.ts`, `src/agent/KeywordAdapter.ts`).

---

## Scenario: apply a quick transform

Your pattern is too fast / too quiet / too dry, and you don't want to rewrite it.

```text
> edit slower
Pattern edited: s("bd sn hh cp").slow(2)
```
*(Illustrative — the reply quotes the full edited pattern.)*

The instruction can appear anywhere after `edit` (`change`/`modify` work too):

```text
> edit add some reverb
Pattern edited: s("bd sn hh cp").slow(2).room(0.5)
```
*(Illustrative.)*

Recognized instructions and what they append:

| Instruction | Transform |
|-------------|-----------|
| `faster` / `speed up` | `.fast(2)` |
| `slower` / `slow down` | `.slow(2)` |
| `louder` / `volume up` | `.gain(1.5)` |
| `quieter` / `softer` / `volume down` | `.gain(0.5)` |
| `reverse` / `backwards` | `.rev()` |
| `reverb` | `.room(0.5)` |
| `delay` | `.delay(0.5)` |
| `distort` / `overdrive` | `.distort(0.5)` |
| `filter` / `low pass` | `.lpf(800)` |
| `high pass` | `.hpf(800)` |
| `remove last` / `undo last` | strips the trailing `.method(…)` |

Two instructions are smarter than plain appends: if the pattern already has
`.fast(n)` / `.slow(n)`, `slower`/`faster` flip it in place instead of stacking
another factor (`src/pattern/PatternOwner.ts`).

**Next step:** `play` to hear the current pattern — a running loop keeps
playing the version it started with until you do
([why](play-audio.md#scenario-hear-an-edit-you-just-made)).

## Scenario: the instruction did nothing

You typed an instruction the keyword matcher doesn't know.

```text
> edit make it swing
Could not apply that edit. Try being more specific or edit the pattern directly.
```
*(Illustrative — real message from `src/agent/ToolExecutor.ts`.)*

Either use a listed instruction, type the Strudel code yourself, or
[connect an AI agent](configure-ai-agent.md) for free-form instructions.

## Scenario: roll back

You stacked a few edits and want the previous version back.

```text
> undo
Reverted to previous pattern.
```

Went back too far?

```text
> redo
Re-applied pattern.
```

With nothing left to undo:

```text
> undo
Nothing to undo.
```
*(Illustrative — messages from `src/agent/KeywordAdapter.ts`.)*

## Scenario: edit the code in place

The transforms don't cover what you want — you'll edit the Strudel code by hand.

Press `Ctrl+E` to open the pattern editor over the pattern panel. Edit the code,
then:

- `Ctrl+X` — save your edit as the current pattern
- `Ctrl+E` or `Esc` — discard and return

**Next step:** `validate` to check your hand-edited code before playing.

## Scenario: generate a pattern without an agent

You have no API key and want the app to invent something to start from.

```text
> make a jazzy drum loop at 120 bpm
Generated: note(`f4 d#4 c4 a#4 g4 f#4`).sound(`sawtooth`)
```
*(Real output of the keyword-mode generator, captured from
`PatternSyntax.generateFromSeed`.)*

Be aware of what this is: without an agent, `make` does **not** interpret your
description musically. It hashes the description into a seed and deterministically
generates a note melody — the same description always yields the same pattern,
and "drum loop" won't produce drums. Treat it as a random starting point; use
[edits](#scenario-apply-a-quick-transform) and hand-tuning from there.

## Scenario: describe the change in words

You have an API key configured and want free-form editing.

```text
> edit make it half time with a shuffle
```

The agent edits the pattern with the full Strudel API, not just the fixed
transforms — anything it produces still passes validation before it reaches
your editor or the audio layer.

---

## Next steps

- [Manage pattern files](manage-patterns.md) — keep the result
- [Reference: TUI commands](../reference/tui.md) — every command and shortcut
