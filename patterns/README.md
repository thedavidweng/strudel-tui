# Example Patterns

This directory contains example Strudel patterns for Strudel-TUI.
Load them via the CLI or PatternLoader to hear them.

## Patterns

- `basic-beat.strudel` -- Simple 4/4 kick and snare at 120 BPM. A clean starting point with kick on every beat, snare on 2 and 4, and eighth-note hi-hats.
- `ambient.strudel` -- Slow ambient pad at 60 BPM. Layered sine and triangle pads with a sub bass, evolving over long cycles.
- `breakbeat.strudel` -- Breakbeat rhythm at 140 BPM. Syncopated kick and snare with fast hi-hats and percussion hits.
- `melody.strudel` -- Simple melodic pattern at 110 BPM. A triangle-wave melody with call-and-response phrasing over a filtered sawtooth bass.
- `acid.strudel` -- Acid bassline at 130 BPM. Sawtooth bass with a sweeping low-pass filter and resonance, driving kick and off-beat hats.
- `techno130.strudel` -- Four-on-the-floor kick and hi-hat at 130 BPM.

## Adding Patterns

Drop a `.strudel` file in this directory. Each file should contain valid Strudel code.
Use `setcps(bpm/60/4)` at the top to set the tempo. Patterns can be loaded at runtime
via `PatternLoader.loadPattern()`.
