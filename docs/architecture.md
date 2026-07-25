# Architecture

strudel-tui is organized into four layers, each with a single responsibility.

Decisions: [ADR-001 — pi-tui over Ink for the TUI layer](adr-001-tui-framework.md)

## Layers

```
┌─────────────────────────────────────────────┐
│                  CLI Layer                  │  citty command parsing
├─────────────────────────────────────────────┤
│                  TUI Layer                  │  pi-tui terminal UI
├─────────────────────────────────────────────┤
│                 Agent Layer                 │  LLM + keyword routing
├──────────────┬──────────────┬───────────────┤
│  Engine Layer│  Audio Layer │  Config Layer │
│  @strudel/*  │  browser tab │  config.json  │
└──────────────┴──────────────┴───────────────┘
```

## Source Layout

```
src/
├── index.ts                     # CLI entry point
├── version.ts                   # Version, single-sourced from package.json
│
├── config/
│   └── ConfigManager.ts         # Load/save ~/.strudel-tui/config.json
│
├── llm/
│   ├── OpenAIClient.ts          # OpenAI-compatible streaming client
│   ├── ChatHistory.ts           # OpenAI wire-format message list
│   ├── SSEParser.ts             # Server-Sent Events framing
│   └── tools.ts                 # Tool definitions + system prompt
│
├── agent/
│   ├── Agent.ts                 # Main agent (LLM + keyword fallback)
│   ├── LLMAdapter.ts            # LLM streaming + multi-round tool dispatch
│   ├── KeywordAdapter.ts        # Regex intent detection (no API key)
│   ├── ToolExecutor.ts          # Tool dispatch (no state)
│   └── HelpText.ts              # Command/shortcut/example constants
│
├── pattern/
│   └── PatternOwner.ts          # Single source of truth for pattern + undo/redo
│
├── session/
│   ├── ChatLog.ts               # In-memory conversation messages
│   └── SessionStore.ts          # Session persistence to disk
│
├── engine/
│   ├── PatternSyntax.ts         # Pure: validate, generate (no runtime)
│   ├── Engine.ts                # Runtime: evaluate, analyse (requires init)
│   └── PatternLoader.ts         # Embedded built-ins + ~/.strudel-tui/patterns
│
├── audio/
│   ├── AudioController.ts       # Backend selection: WebView → browser → console
│   └── BrowserBridge.ts         # Localhost server + WebSocket to the audio tab
│
└── tui/
    ├── StrudelTUI.ts            # Main layout, input handling, screen lifecycle
    ├── InlineConfig.ts          # Interactive config setup
    ├── StatusBar.ts             # Playback state, BPM, shortcuts
    ├── MessageHistory.ts        # Chat + system messages
    ├── PatternPanel.ts          # Current pattern display + editor
    ├── SlashCommandMenu.ts      # Slash command autocomplete
    ├── GutterContainer.ts       # Layout helper
    └── theme.ts                 # Colors and spinner frames
```

## Data Flow

```
User Input
    │
    ▼
┌─────────┐     ┌──────────┐     ┌─────────────┐
│  Input   │────▶│  Agent   │────▶│  Engine     │
│  Box     │     │  (LLM /  │     │  (validate, │
│          │     │  keyword) │     │   analyze)  │
└─────────┘     └────┬─────┘     └─────────────┘
                     │
                     ▼
              ┌──────────┐     ┌─────────────┐
              │  Tools   │────▶│  Audio      │
              │  (play,  │     │  Controller │
              │   edit)  │     │  (browser)  │
              └──────────┘     └─────────────┘
```

1. User types in the **Input Box**
2. **Agent** receives the message:
   - With API key: sends to LLM, which calls tools (play, generate, edit, etc.)
   - Without API key: keyword matching routes to built-in handlers
3. **Engine** validates and analyzes patterns
4. **Audio Controller** plays patterns in a browser tab via the bridge

## Key Design Decisions

### Dual-mode Agent

The Agent works in two modes:
- **LLM mode**: User messages go to an OpenAI-compatible API. The LLM uses function calling to invoke Strudel tools (play, generate, edit, validate, etc.)
- **Keyword mode**: Simple regex-based intent detection. Works without any API key.

The mode is selected automatically based on whether an API key is configured, and re-evaluated when the in-app config panel saves.

### Browser Bridge for Audio

A terminal process cannot produce WebAudio, so `BrowserBridge` runs a token-gated HTTP + WebSocket server on `127.0.0.1` and opens a page in the user's default browser. The page loads `@strudel/web` (SRI-pinned from the CDN) and executes play/stop messages pushed from the TUI, which makes live edits replace the running pattern instantly. Browsers require a user gesture before audio can start, so the page asks for one "Enable audio" click; code sent before the click is queued and played on it.

`AudioController` selects a backend at first play: a hidden `Bun.WebView` if the runtime ever ships one, otherwise the browser bridge, otherwise a console fallback that logs patterns.

### Embedded Built-in Patterns

The compiled binary ships without a repo checkout, so `patterns/*.strudel` are embedded at build time via Bun text imports. User-saved patterns live in `~/.strudel-tui/patterns/` and shadow built-ins of the same name.

### Streaming Responses

In LLM mode, responses stream token-by-token into the TUI. Tool calls are displayed as they execute, and tool results are shown inline. Tool rounds are bounded (5, then a forced text round), and ctrl+c aborts the in-flight request via `AbortController`.

### Pattern Validation Before Playback

All patterns pass through `PatternSyntax.validate()` before reaching the audio layer. Validation is transpile-only and never executes the pattern; event/voice analysis (which does evaluate the code, in-process) is a separate, explicit `get_pattern_info` tool.

## Dependencies

| Package | Purpose |
|---------|---------|
| `bun` | Runtime, build system, localhost audio server |
| `citty` | CLI argument parsing |
| `@earendil-works/pi-tui` | Terminal UI framework |
| `chalk` | Terminal colors |
| `@strudel/core` | Pattern evaluation, scheduling |
| `@strudel/mini` | Mini-notation parser |
| `@strudel/transpiler` | Code transpilation |
