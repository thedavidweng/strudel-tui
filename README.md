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
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/bun-%3E%3D1.3.11-f9f1e1?logo=bun" alt="Bun"></a>
  <a href="https://strudel.cc"><img src="https://img.shields.io/badge/strudel-powered-ff69b4" alt="Strudel"></a>
</p>

---

**strudel-tui** is a lightweight, single-binary terminal application for live coding music with [Strudel](https://strudel.cc) — the JavaScript port of the Tidal Cycles pattern language. Chat with an AI agent, edit patterns, and play them back, all from your terminal.

## Features

- **Interactive TUI** — Terminal UI built with [pi-tui](https://github.com/earendil-works/pi) with message history, pattern editor, and status bar
- **IME Support** — Full input method editor support for CJK and other complex scripts
- **AI Agent** — Chat naturally to create and edit patterns. Supports any OpenAI-compatible API (OpenAI, DeepSeek, Qwen, Moonshot, OpenRouter, etc.)
- **Audio Playback** — Patterns play through your default browser: the TUI opens a small local page running Strudel's WebAudio engine and drives it live over WebSocket. One "Enable audio" click, then every edit replaces the running pattern instantly. No Electron, no bundled browser
- **Pattern Engine** — Validates, transpiles, and analyzes patterns using `@strudel/core` and `@strudel/transpiler`
- **Single Binary** — Compiles to a standalone executable with `bun build --compile`
- **Cross-Platform** — macOS (arm64/x64), Linux (arm64/x64), Windows (x64)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3.11 or later (only for running from source — the released binary is self-contained)
- A default browser, for audio playback (without one, playback falls back to logging patterns)
- Internet access on first play (the audio page loads Strudel's engine from a CDN)

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
| `list` / `patterns` | List built-in and saved patterns |
| `load <name>` | Load a pattern by name (e.g. `load acid`) |
| `undo` | Revert to the previous pattern |
| `redo` | Re-apply the last undone pattern change |
| `help` | Show available commands and shortcuts |

Slash-prefixed forms (`/play`, `/make …`, `/load …`) work the same and get autocomplete.

### How audio works

The terminal itself cannot produce sound. On first `play`, strudel-tui starts a token-gated server on `127.0.0.1` and opens a page in your browser that runs [Strudel's WebAudio engine](https://strudel.cc). Click **Enable audio** once (browsers require a user gesture); after that the TUI streams every play/stop/edit to the tab live. Close the tab and the next `play` reopens it. If no browser is available, playback falls back to logging patterns in the message history.

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
| `Ctrl+E` | Edit the pattern in place (`Ctrl+X` save, `Ctrl+E`/`Esc` discard) |
| `Ctrl+S` | Save current pattern to `~/.strudel-tui/patterns/` |
| `Ctrl+L` | Clear message history |
| `Ctrl+C` | Quit (press twice; single press clears input or interrupts the AI) |
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
├── version.ts                # Version, single-sourced from package.json
├── config/
│   └── ConfigManager.ts      # ~/.strudel-tui/config.json
├── llm/
│   ├── OpenAIClient.ts       # OpenAI-compatible streaming client
│   ├── ChatHistory.ts        # OpenAI wire-format message list
│   ├── SSEParser.ts          # Server-Sent Events framing
│   └── tools.ts              # Tool definitions + system prompt
├── agent/
│   ├── Agent.ts              # Conversational front end (LLM + keyword routing)
│   ├── LLMAdapter.ts         # LLM streaming + multi-round tool dispatch
│   ├── KeywordAdapter.ts     # Regex intent detection (no API key needed)
│   ├── ToolExecutor.ts       # Tool dispatch to engine/patterns/audio
│   └── HelpText.ts           # Command/shortcut/example constants
├── pattern/
│   └── PatternOwner.ts       # Single source of truth for pattern + undo/redo
├── session/
│   ├── ChatLog.ts            # In-memory conversation messages
│   └── SessionStore.ts       # Session persistence to ~/.strudel-tui/sessions
├── engine/
│   ├── PatternSyntax.ts      # Pure: validate, generate (no runtime)
│   ├── Engine.ts             # Runtime: evaluate, analyse (explicit init)
│   └── PatternLoader.ts      # Embedded built-ins + ~/.strudel-tui/patterns
├── audio/
│   ├── AudioController.ts    # Backend selection: WebView → browser → console
│   └── BrowserBridge.ts      # Localhost server + WebSocket to the audio tab
└── tui/
    ├── StrudelTUI.ts         # Main layout, input handling, screen lifecycle
    ├── InlineConfig.ts       # Interactive config setup panel
    ├── StatusBar.ts          # Playback state, BPM, mode, tips
    ├── MessageHistory.ts     # Chat and system messages
    ├── PatternPanel.ts       # Pattern display + edit mode
    ├── SlashCommandMenu.ts   # Slash command autocomplete
    ├── GutterContainer.ts    # Layout helper
    └── theme.ts              # Colors and spinner frames
```

TUI components use [pi-tui](https://github.com/earendil-works/pi)'s imperative component model — each component implements `render(width): string[]` to produce terminal output. No React/JSX; components are plain classes that compose via parent-child relationships.

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Lint and typecheck
bun run lint
bun run typecheck

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
