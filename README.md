<p align="center">
  <h1 align="center">strudel-tui</h1>
  <p align="center">
    Terminal-based live coding interface for <a href="https://strudel.cc">Strudel</a> with AI agent
  </p>
</p>

<p align="center">
  <a href="https://github.com/thedavidweng/strudel-tui/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/thedavidweng/strudel-tui/releases"><img src="https://img.shields.io/github/v/release/thedavidweng/strudel-tui" alt="Release"></a>
  <a href="https://github.com/thedavidweng/strudel-tui/actions"><img src="https://img.shields.io/github/actions/workflow/status/thedavidweng/strudel-tui/ci.yml?branch=main" alt="CI"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/bun-%3E%3D1.3.12-f9f1e1?logo=bun" alt="Bun"></a>
  <a href="https://strudel.cc"><img src="https://img.shields.io/badge/strudel-powered-ff69b4" alt="Strudel"></a>
</p>

---

**strudel-tui** is a lightweight, single-binary terminal application for live coding music with [Strudel](https://strudel.cc) — the JavaScript port of the Tidal Cycles pattern language. Chat with an AI agent, edit patterns, and play them back, all from your terminal.

## Features

- **Interactive TUI** — Terminal UI built with [pi-tui](https://github.com/earendil-works/pi) with message history, pattern editor, and status bar
- **IME Support** — Full input method editor support for CJK and other complex scripts
- **AI Agent** — Chat naturally to create and edit patterns. Supports any OpenAI-compatible API (OpenAI, DeepSeek, Qwen, Moonshot, OpenRouter, etc.)
- **Audio Playback** — Patterns play through a hidden WebView using Strudel's WebAudio engine. No Electron, no bundled browser
- **Pattern Engine** — Validates, transpiles, and analyzes patterns using `@strudel/core` and `@strudel/transpiler`
- **Single Binary** — Compiles to a standalone executable with `bun build --compile`
- **Cross-Platform** — macOS (arm64/x64), Linux (arm64/x64), Windows (x64)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3.12 or later

### Install

**Homebrew (macOS):**

```bash
brew tap thedavidweng/tap
brew install --cask strudel-tui
```

**From source:**

```bash
git clone https://github.com/thedavidweng/strudel-tui.git
cd strudel-tui
bun install
```

### Run

```bash
bun run src/index.ts
```

### Configure AI Agent (Optional)

```bash
# Interactive wizard — select provider and enter API key
bun run src/index.ts config init

# Or set directly
bun run src/index.ts config set apiKey sk-...
bun run src/index.ts config set baseUrl https://api.deepseek.com/v1
bun run src/index.ts config set model deepseek-chat
```

Supported providers: OpenAI, DeepSeek, Moonshot (Kimi), Zhipu (GLM), Qwen (Tongyi), OpenRouter, or any OpenAI-compatible endpoint.

You can also use environment variables or CLI flags:

```bash
# Environment variables
OPENAI_API_KEY=sk-... bun run src/index.ts

# CLI flags
bun run src/index.ts --api-key sk-... --base-url https://api.deepseek.com/v1 --model deepseek-chat
```

### Build Binary

```bash
bun run build
# Output: bin/strudel-tui

# Run the binary
./bin/strudel-tui --help
```

## Usage

### TUI Interface

The terminal UI uses a sidebar layout:

```
┌──────────────────────────────┬──────────────────┐
│ STOPPED | BPM: 130 | shortcuts                  │  ← Status bar
├──────────────────────────────┼──────────────────┤
│                              │ > make a chill   │
│  1 | s("bd sn").lpf(800)    │ # generate...    │
│                              │ < note("c d e f")│
│ Pattern Editor               │                  │
│                              │ Message          │
│                              │ History          │
│ > _                          │                  │
│ Input                        │                  │
└──────────────────────────────┴──────────────────┘
```

### Commands

Type these in the input box:

| Command | Description |
|---------|-------------|
| `play` / `start` / `go` | Start audio playback of the current pattern |
| `stop` / `pause` / `hush` | Stop all playing patterns |
| `make <description>` | Generate a pattern from a text description |
| `edit <instruction>` | Modify the current pattern (e.g. `edit make it slower`) |
| `validate` / `check` | Validate the current pattern for syntax errors |
| `undo` | Revert to the previous pattern |
| `redo` | Re-apply the last undone pattern change |
| `help` | Show available commands and shortcuts |

With AI agent enabled, you can chat naturally:

```
> make a jazzy drum loop at 120 bpm
> add some reverb to that
> make it half time
> play it
```

### Keyboard Shortcuts

| Keys | Description |
|------|-------------|
| `Ctrl+P` | Toggle play/stop |
| `Ctrl+S` | Save current pattern to file |
| `Ctrl+L` | Clear message history |
| `Ctrl+C` | Quit |
| `Up/Down` | Scroll through input history |

### CLI Options

```
strudel-tui [OPTIONS] [COMMAND]

OPTIONS
  -p, --pattern=<file>    Load a .strudel pattern file on startup
  --bpm=<number>          Set initial BPM (default: 130)
  --debug                 Enable debug logging
  --api-key=<key>         OpenAI-compatible API key (overrides config)
  --base-url=<url>        API base URL (overrides config)
  --model=<name>          Model name (overrides config)

COMMANDS
  config                  Manage configuration
    config init           Interactive setup wizard
    config set <k> <v>    Set a config value (apiKey, baseUrl, model, temperature, maxTokens)
    config show           Show current configuration
```

### Edit Instructions

When using keyword mode (no AI agent), these edit instructions are supported:

| Instruction | Effect |
|-------------|--------|
| `faster` / `speed up` | `.fast(2)` |
| `slower` / `slow down` | `.slow(2)` |
| `louder` | `.gain(1.5)` |
| `quieter` / `softer` | `.gain(0.5)` |
| `reverse` / `backwards` | `.rev()` |
| `reverb` | `.room(0.5)` |
| `delay` | `.delay(0.5)` |
| `distort` | `.distort(0.5)` |
| `filter` / `low pass` | `.lpf(800)` |
| `high pass` | `.hpf(800)` |
| `remove last` | Remove the last transform |

## Example Patterns

The `patterns/` directory contains sample `.strudel` files:

| Pattern | Description |
|---------|-------------|
| `techno130` | Four-on-the-floor kick and hi-hat at 130 BPM |
| `basic-beat` | Simple 4/4 kick and snare |
| `ambient` | Slow ambient pad |
| `breakbeat` | Breakbeat rhythm |
| `melody` | Simple melodic pattern |
| `acid` | Acid bassline |

Load a pattern on startup:

```bash
bun run src/index.ts --pattern patterns/acid.strudel
```

## Architecture

```
src/
├── index.ts                  # CLI entry point (citty)
├── config/
│   └── ConfigManager.ts      # ~/.strudel-tui/config.json
├── llm/
│   ├── OpenAIClient.ts       # OpenAI-compatible streaming client
│   └── tools.ts              # Tool definitions for function calling
├── agent/
│   ├── Agent.ts              # AI agent with LLM + keyword fallback
│   ├── DiffGenerator.ts      # Pattern diff generation
│   ├── SessionHistory.ts     # Conversation and pattern history
│   └── HelpText.ts           # Help text constants
├── engine/
│   ├── StrudelEngineWrapper.ts  # Pattern validation, analysis, generation
│   └── PatternLoader.ts      # Load/save .strudel files
├── audio/
│   └── AudioController.ts    # Bun.WebView audio playback
└── tui/
    ├── App.tsx               # Main TUI layout (pi-tui component tree)
    ├── ConfigWizard.tsx       # Interactive config setup
    ├── StatusBar.tsx          # Playback state, BPM, shortcuts
    ├── MessageHistory.tsx     # Chat and system messages
    ├── PatternEditor.tsx      # Current pattern display
    ├── InputBox.tsx           # User input with IME support
    ├── SlashCommandMenu.tsx   # Slash command autocomplete
    └── MoonSpinner.tsx        # Loading spinner animation
```

TUI components use [pi-tui](https://github.com/earendil-works/pi)'s imperative component model — each component implements `render(width): string[]` to produce terminal output. No React/JSX; components are plain classes that compose via parent-child relationships.

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Build binary
bun run build

# Run goreleaser (requires goreleaser CLI)
make release
```

## Acknowledgments

- **[pi-tui](https://github.com/earendil-works/pi)** — The terminal UI framework powering strudel-tui, by Mario Zechner (badlogic), Armin Ronacher (mitsuhiko), and contributors. MIT License.
- **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** (PI Agent) — By Moonshot AI. The TUI architecture, component patterns, and input handling design are heavily referenced from Kimi Code. MIT License.
- **[Strudel](https://strudel.cc)** — The live coding music framework that strudel-tui is built on.
- **[Tidal Cycles](https://tidalcycles.org)** — The pattern language that inspired Strudel.

## License

[MIT](LICENSE)
