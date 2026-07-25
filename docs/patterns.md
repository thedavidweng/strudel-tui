# Patterns

strudel-tui ships with example `.strudel` pattern files in the `patterns/` directory. These are valid Strudel mini-notation patterns that you can load, modify, and play.

## Included Patterns

| File | Description | BPM |
|------|-------------|-----|
| `techno130.strudel` | Four-on-the-floor kick and hi-hat | 130 |
| `basic-beat.strudel` | Simple 4/4 kick and snare | 120 |
| `ambient.strudel` | Slow ambient pad | 60 |
| `breakbeat.strudel` | Breakbeat rhythm | 140 |
| `melody.strudel` | Simple melodic pattern | 110 |
| `acid.strudel` | Acid bassline | 130 |

## Loading Patterns

### On startup

```bash
strudel-tui --pattern patterns/acid.strudel
```

### From within the TUI

With AI agent:
```
> load the acid pattern
```

Or set the code directly:
```
> setcps(130/60/4)
$s = note("<c2 c3> <e2 e3> <g2 g3>").sound("sawtooth").lpf(400)
```

## Writing Patterns

Patterns use Strudel mini-notation. Basic syntax:

```
# Drums: sound names in quotes
s("bd sn hh cp")

# Repeated sounds: use *
s("bd*4")

# Rests: use -
s("bd - sn -")

# Chords: use []
s("[bd sn] hh")

# Alternation: use <>
s("<bd sn>")

# Notes: use note()
note("c d e f g a b c5")

# Combine: use , for layers
s("bd*4, hh*8, [- sn]*2")

# Effects: chain with .
s("bd").gain(0.8).room(0.3)
note("c e g").sound("sawtooth").lpf(800)
```

### Common Sound Names

| Name | Sound |
|------|-------|
| `bd` | Bass drum / kick |
| `sn` / `sd` | Snare |
| `hh` | Hi-hat (closed) |
| `oh` | Hi-hat (open) |
| `cp` | Clap |
| `rim` | Rimshot |
| `tom` | Tom |
| `cymbal` | Crash cymbal |

### Common Effects

| Effect | Method | Example |
|--------|--------|---------|
| Gain / volume | `.gain(n)` | `.gain(0.5)` |
| Reverb | `.room(n)` | `.room(0.3)` |
| Delay | `.delay(n)` | `.delay(0.5)` |
| Low-pass filter | `.lpf(freq)` | `.lpf(800)` |
| High-pass filter | `.hpf(freq)` | `.hpf(400)` |
| Speed | `.fast(n)` / `.slow(n)` | `.fast(2)` |
| Reverse | `.rev()` | `.rev()` |
| Distortion | `.distort(n)` | `.distort(0.5)` |

## Saving Patterns

Saved patterns live in `~/.strudel-tui/patterns/` and shadow built-ins of the same name. `list` shows both.

### Keyboard shortcut

Press `Ctrl+S` to save the current pattern as `untitled.strudel`.

### With AI agent

```
> save this as my-beat
```
