# How to: Manage pattern files

strudel-tui ships six built-in patterns and saves yours to
`~/.strudel-tui/patterns/`. This guide covers listing, loading, saving, and
overriding.

> In-TUI replies below are illustrative — they use the app's real message
> formats (`src/agent/ToolExecutor.ts`, `src/tui/StrudelTUI.ts`) with a
> representative set of patterns. Terminal output from the `strudel-tui` command
> itself is captured from real runs.

---

## Scenario: see what's available

You want to know which patterns you can load.

```text
> list
Available patterns:
  - acid
  - ambient
  - basic-beat
  - breakbeat
  - melody
  - techno130
  - untitled (user)
```
*(Illustrative — six built-ins plus one saved pattern. Built-ins are embedded in
the binary; saved ones come from `~/.strudel-tui/patterns/`.)*

## Scenario: load a pattern

You want the acid bassline.

```text
> load acid
Loaded "acid": // Acid bassline pattern
setcps(130/60/4);
…
```
*(Illustrative — the reply quotes the full loaded file; elided here, from
`src/agent/ToolExecutor.ts`.)*

The pattern replaces whatever was in the editor. Loading does not start or
change playback on its own — `play` afterwards if you want to hear it.

Loading by name fails cleanly when nothing matches:

```text
> load nope
Could not load pattern: No pattern named "nope".
```
*(Illustrative — messages from `src/engine/PatternLoader.ts` via `src/agent/ToolExecutor.ts`.)*

**Next step:** `play` to hear it.

## Scenario: save what you have

You tweaked a pattern and want to keep it.

Press `Ctrl+S` in the TUI. This saves the current pattern under a fixed name:

```text
Saved to ~/.strudel-tui/patterns/untitled.strudel
```
*(Illustrative — message after `Ctrl+S`.)*

With an AI agent configured, you can name it in one line instead:

```text
> save this as my-beat
```

```text
Pattern saved as "my-beat" in ~/.strudel-tui/patterns.
```
*(Illustrative — tool result message.)*

Names accept letters, numbers, hyphens, and underscores; a `.strudel` suffix is
stripped if you type one. You can also manage the directory by hand — each
pattern is a plain text file:

```bash
mv ~/.strudel-tui/patterns/untitled.strudel ~/.strudel-tui/patterns/my-beat.strudel
```

**Next step:** `list` should now show `my-beat (user)`, and `load my-beat`
brings it back in any session.

## Scenario: override a built-in

You want `load acid` to use your own version.

Save your pattern under the built-in's name:

```text
> save this as acid
```

User patterns **shadow** built-ins of the same name — `list` shows one `acid`
entry, marked `(user)`, and `load acid` picks yours. Delete
`~/.strudel-tui/patterns/acid.strudel` to fall back to the built-in.

## Scenario: start with a pattern already loaded

You always begin a session with your favorite pattern.

```bash
strudel-tui --pattern ~/.strudel-tui/patterns/my-beat.strudel
```

A path that doesn't exist is an error, not a silent empty start:

```bash
$ strudel-tui --pattern /tmp/definitely-missing.strudel
Failed to read pattern file "/tmp/definitely-missing.strudel": ENOENT: no such file or directory, open '/tmp/definitely-missing.strudel'
```
*(Captured from a real run; exit code 1.)*

## Where patterns live

| Source | Location | Notes |
|--------|----------|-------|
| Built-in | embedded in the binary | six patterns from the repo's `patterns/` dir |
| Saved | `~/.strudel-tui/patterns/*.strudel` | plain text; shadow built-ins by name |

---

## Next steps

- [Edit patterns](edit-patterns.md) — transforms and undo before you save
- [Reference: pattern files](../reference/pattern-files.md) — the built-ins and the mini-notation syntax they use
