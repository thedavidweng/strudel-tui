# Reference: Pattern files

The built-in `.strudel` patterns, where saved patterns live, and the
mini-notation syntax they are written in.

## Built-in patterns

Embedded in the binary at build time (from the repo's `patterns/` directory),
so they work without a checkout:

| Name | Description | BPM |
|------|-------------|-----|
| `techno130` | Four-on-the-floor kick and hi-hat | 130 |
| `basic-beat` | Simple 4/4 kick and snare | 120 |
| `ambient` | Slow ambient pad | 60 |
| `breakbeat` | Breakbeat rhythm | 140 |
| `melody` | Simple melodic pattern | 110 |
| `acid` | Acid bassline | 130 |

Load them with `load <name>` in the TUI, or start with one:
`strudel-tui --pattern patterns/acid.strudel`.

For example, `acid.strudel` is plain Strudel code:

```javascript
// Acid bassline pattern
setcps(130/60/4);

$bass = note("<[c2 ~ c3 ~] [e2 ~ e3 ~] [g2 ~ g3 ~] [b2 ~ b1 ~]>").sound("sawtooth").lpf(sine.range(200, 2000).slow(4)).lpq(12).gain(0.7);
$kick = s("bd*4") | gain(0.8);
$hat = s("[~ hh]*4") | gain(0.3);

bass + kick + hat;
```

## Saved patterns

Saved to `~/.strudel-tui/patterns/*.strudel` as plain text — safe to rename,
edit by hand, or check into dotfiles. User patterns shadow built-ins of the
same name; see [How to: Manage pattern files](../how-to/manage-patterns.md).

Name rules: letters, numbers, hyphens, underscores (a `.strudel` suffix is
stripped automatically).

## Mini-notation quick reference

Patterns use [Strudel](https://strudel.cc) mini-notation. The essentials:

```text
// Drums: sound names in quotes
s("bd sn hh cp")

// Repeated sounds: use *
s("bd*4")

// Rests: use ~ or -
s("bd - sn -")

// Sub-sequences: use []
s("[bd sn] hh")

// Alternation: use <>
s("<bd sn>")

// Notes: use note()
note("c d e f g a b c5")

// Layers: separate with ,
s("bd*4, hh*8, [- sd]*2")

// Effects: chain with .
s("bd").gain(0.8).room(0.3)
note("c e g").sound("sawtooth").lpf(800)
```

### Common sound names

| Name | Sound |
|------|-------|
| `bd` | Bass drum / kick |
| `sn` / `sd` | Snare |
| `hh` | Hi-hat (closed) |
| `oh` | Hi-hat (open) |
| `cp` | Clap |
| `rim` | Rimshot |
| `tom` | Tom |

### Common effects

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

The full language is documented at [strudel.cc](https://strudel.cc/learn/) —
anything valid there validates and plays here.
