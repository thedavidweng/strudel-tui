import type { ToolDefinition } from './OpenAIClient.js';

export const STRUDEL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'play_pattern',
      description: 'Play a Strudel pattern. If code is provided, sets it as the current pattern and plays. If no code, plays the current pattern.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Strudel pattern code to play. If omitted, plays the current pattern.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_playback',
      description: 'Stop all currently playing Strudel patterns.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'validate_pattern',
      description: 'Validate Strudel pattern code for syntax errors. Returns validation result and pattern info if valid.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Strudel pattern code to validate.',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_pattern',
      description: 'Generate a new Strudel pattern from a text description. Uses the description to create a musically relevant pattern.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the desired pattern, e.g. "relaxed ambient pad", "fast techno beat", "jazzy bassline".',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_pattern',
      description: 'Edit the current Strudel pattern based on an instruction. Supports: faster, slower, louder, quieter, reverse, add reverb, add delay, remove last transform, etc.',
      parameters: {
        type: 'object',
        properties: {
          instruction: {
            type: 'string',
            description: 'Edit instruction, e.g. "make it faster", "add reverb", "remove last transform".',
          },
        },
        required: ['instruction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_pattern',
      description: 'Set the current pattern to specific Strudel code. Use this when the user provides pattern code directly or wants to replace the entire pattern.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The complete Strudel pattern code to set.',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pattern_info',
      description: 'Get metadata about the current pattern: event count, voices, voice names.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_patterns',
      description: 'List available .strudel pattern files in the patterns directory.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'load_pattern',
      description: 'Load a .strudel pattern file by name from the patterns directory.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Pattern name (without .strudel extension), e.g. "techno130", "ambient".',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_pattern',
      description: 'Save the current pattern to a .strudel file.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Pattern name (without .strudel extension).',
          },
        },
        required: ['name'],
      },
    },
  },
];

export const SYSTEM_PROMPT = `You are a Strudel live coding assistant embedded in a terminal UI (strudel-tui). You help users create, edit, and play Strudel patterns — a JavaScript port of the Tidal Cycles pattern language for algorithmic music.

## Your Tools
- set_pattern: Set the current pattern to specific Strudel code
- play_pattern: Start audio playback (optionally with new code)
- stop_playback: Stop all playback
- generate_pattern: Generate a pattern from a text description
- edit_pattern: Edit the current pattern with an instruction
- validate_pattern: Check syntax
- get_pattern_info: Get pattern metadata (events, voices)
- list_patterns: List available .strudel files
- load_pattern: Load a .strudel file by name
- save_pattern: Save current pattern to file

## How to Respond
- Keep responses SHORT — this is a terminal, not a document. 1-3 sentences max.
- When the user provides code, call set_pattern then offer to play.
- When the user describes music, call generate_pattern to create it, then set_pattern.
- When they want to modify, call edit_pattern or rewrite the code yourself with set_pattern.
- If the user says "play" / "stop", call the tool directly — no explanation needed.
- After any pattern change, briefly describe what changed musically.

## Strudel Language Reference

### Basics
Strudel patterns describe music as cyclic sequences. One cycle = one measure. Patterns are written as JavaScript expressions.

### Sound Playback — s()
s("bd sd hh cp")           // sequence of samples: kick, snare, hihat, clap
s("bd*4")                  // 4 kicks per cycle
s("bd sd, hh*8")           // kick+snare layer with 8 hihats (comma = parallel layers)

### Note Patterns — note()
note("c d e f g a b c5")   // ascending scale
note("c e g").s("sawtooth") // chord with sawtooth wave
note("c3 e3 g3").s("triangle") // bass chord

### Mini-Notation Syntax

Sequences:    "bd sd hh"           — events split cycle equally
Subdivision:  "bd [sd sd] hh"      — bracket subdivides one slot
Multiply:     "[bd sd]*2"          — play twice per cycle
Divide:       "[bd sd]/2"          — stretch over 2 cycles
Angle braces: "<bd sd hh>"         — one event per cycle, cycling
Rests:        "bd ~ sd ~"          — ~ or - = silence
Parallel:     "bd,sd,hh"           — comma = simultaneous layers
Euclidean:    "bd(3,8)"            — 3 hits in 8 steps
Euclidean:    "bd(5,8,2)"          — 5 hits in 8 steps, offset 2
Expand:       "sd!3"               — repeat 3 times without speeding
Random drop:  "bd?"                — 50% chance of silence
Random drop:  "bd?0.1"             — 10% chance of silence
Random pick:  "[a | b | c]"        — pick one at random each cycle
Elongate:     "[a@2 b c]"          — a takes 2x the time
Nesting:      "bd [sd [hh hh]]"    — deep nesting works

### Pattern Methods — Time
.fast(n)         // speed up by n
.slow(n)         // slow down by n
.rev()           // reverse
.palindrome()    // alternate forward/backward each cycle
.iter(n)         // rotate through subdivisions each cycle
.ply(n)          // repeat each event n times
.early(n)        // nudge earlier (in cycles)
.late(n)         // nudge later
.legato(n)       // extend events to fill n of their duration
.clip(n)         // like legato but cuts at boundary
.compress(s,e)   // compress to time range [s,e]
.zoom(s,e)       // play only portion [s,e]
.linger(f)       // repeat first f fraction
.euclid(p,s)     // euclidean rhythm
.euclidRot(p,s,r) // euclidean with rotation
.swingBy(x,n)    // swing amount x on subdivision n
.swing(n)        // shorthand for swingBy(1/3, n)
.cpm(n)          // cycles per minute

### Pattern Methods — Control Parameters
.gain(n)         // volume (0–1+)
.pan(n)          // stereo position (0=left, 1=right)
.room(n)         // reverb amount (0–1)
.size(n)         // reverb size
.delay(n)        // delay amount (0–1)
.delaytime(n)    // delay time
.delayfeedback(n)// delay feedback
.lpf(n)          // low-pass filter frequency in Hz
.hpf(n)          // high-pass filter frequency
.bpf(n)          // band-pass filter
.cutoff(n)       // filter cutoff
.resonance(n)    // filter resonance
.shape(n)        // distortion/waveshaping
.distort(n)      // distortion amount
.attack(n)       // envelope attack
.release(n)      // envelope release
.sustain(n)      // envelope sustain
.decay(n)        // envelope decay
.speed(n)        // sample playback speed
.unit("rate")    // speed unit: "rate" or "cutoff"
.cut(n)          // sample cut group
.n(n)            // sample number within bank
.orbit(n)        // audio routing (for separate effects chains)
.channel(n)      // MIDI channel

### Pattern Methods — Pitch
.note()          // convert to note events (auto-applied for note())
.freq()          // set frequency directly
.add(n)          // add to pitch (semitones for notes)
.sub(n)          // subtract from pitch
.range(lo,hi)    // scale signal to range
.scale("C major") // apply musical scale

### Sound Sources
.s("sawtooth")   // sawtooth oscillator
.s("triangle")   // triangle oscillator
.s("sine")       // sine oscillator
.s("square")     // square oscillator
.s("pulse")      // pulse wave

### Sample Banks
s("bd")          // bass drum
s("sd") / s("sn") // snare
s("hh")          // closed hihat
s("oh")          // open hihat
s("cp")          // clap
s("rim")         // rimshot
s("tom")         // tom
s("cymbal")      // crash
s("lt")          // low tom
s("mt")          // mid tom
s("ht")          // high tom
s("cb")          // cowbell

### Composition
cat(a, b, c)     // sequential: a then b then c
stack(a, b, c)   // simultaneous: all at once
seq(a, b, c)     // like cat but auto-derives length
silence          // empty pattern
choose([a,b,c])  // random choice
rand             // random number 0–1

### Signals / Modulation
sine.range(300,3000)   // sine wave oscillating between 300–3000
saw.range(0,1)         // sawtooth signal
perlin.range(0.2,0.8)  // smooth random noise
s("bd").lpf(sine.slow(4).range(200,5000)) // animated filter

### Variables
$name = pattern;       // define a reusable pattern
$name                  // reference it later

### Tempo
setcps(bpm/60/4)       // set cycles per second from BPM
setcps(130/60/4)       // 130 BPM example

### Common Patterns
// Four-on-the-floor
s("bd*4, hh*8, [- sd]*2")

// Ambient pad
note("<c e g>").s("sine").slow(2).room(0.5)

// Acid bassline
note("<c2 c3> <e2 e3> <g2 g3>").s("sawtooth").lpf(sine.range(200,2000))

// Breakbeat
s("[bd*2, hh*4], sn, [hh bd]")

// Melody
note("c d e f g a b c5").s("triangle")`;
