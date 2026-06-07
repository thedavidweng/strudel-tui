# Architecture

strudel-tui is organized into four layers, each with a single responsibility.

## Layers

```
┌─────────────────────────────────────────────┐
│                  CLI Layer                  │  citty command parsing
├─────────────────────────────────────────────┤
│                  TUI Layer                  │  Ink terminal UI
├─────────────────────────────────────────────┤
│                 Agent Layer                 │  LLM + keyword routing
├──────────────┬──────────────┬───────────────┤
│  Engine Layer│  Audio Layer │  Config Layer │
│  @strudel/*  │  Bun.WebView │  config.json  │
└──────────────┴──────────────┴───────────────┘
```

## Source Layout

```
src/
├── index.ts                     # CLI entry point
│
├── config/
│   └── ConfigManager.ts         # Load/save ~/.strudel-tui/config.json
│
├── llm/
│   ├── OpenAIClient.ts          # OpenAI-compatible streaming client
│   └── tools.ts                 # Tool definitions + system prompt
│
├── agent/
│   ├── Agent.ts                 # Main agent (LLM + keyword fallback)
│   ├── DiffGenerator.ts         # Unified diff for pattern changes
│   ├── SessionHistory.ts        # Message + pattern undo/redo history
│   └── HelpText.ts              # Command/shortcut/example constants
│
├── engine/
│   ├── StrudelEngineWrapper.ts  # Validate, query, generate patterns
│   └── PatternLoader.ts         # Load/save .strudel files
│
├── audio/
│   └── AudioController.ts       # Bun.WebView → Strudel WebAudio
│
└── tui/
    ├── App.tsx                  # Main layout + state management
    ├── ConfigWizard.tsx          # Interactive config setup
    ├── StatusBar.tsx             # Playback state, BPM, shortcuts
    ├── MessageHistory.tsx        # Chat + system messages
    ├── PatternEditor.tsx         # Current pattern display
    └── InputBox.tsx              # User input
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
              │   edit)  │     │  (WebView)  │
              └──────────┘     └─────────────┘
```

1. User types in the **Input Box**
2. **Agent** receives the message:
   - With API key: sends to LLM, which calls tools (play, generate, edit, etc.)
   - Without API key: keyword matching routes to built-in handlers
3. **Engine** validates and analyzes patterns
4. **Audio Controller** plays patterns through a hidden WebView

## Key Design Decisions

### Dual-mode Agent

The Agent works in two modes:
- **LLM mode**: User messages go to an OpenAI-compatible API. The LLM uses function calling to invoke Strudel tools (play, generate, edit, validate, etc.)
- **Keyword mode**: Simple regex-based intent detection. Works without any API key.

The mode is selected automatically based on whether an API key is configured.

### Hidden WebView for Audio

Bun.WebView spawns a headless WebKit/Chromium instance to run Strudel's WebAudio engine. This avoids bundling a full browser binary. On macOS it uses the system WebKit; on Linux/Windows it uses an installed Chromium. If WebView is unavailable, a console fallback logs patterns instead of playing them.

### Streaming Responses

In LLM mode, responses stream token-by-token into the TUI. Tool calls are displayed as they execute, and tool results are shown inline. This gives immediate feedback during long operations.

### Pattern Validation Before Playback

All patterns pass through `StrudelEngineWrapper.validate()` before reaching the audio layer. This catches syntax errors early and provides structured error messages with line/column information.

## Dependencies

| Package | Purpose |
|---------|---------|
| `bun` | Runtime, build system, WebView |
| `citty` | CLI argument parsing |
| `ink` | React-based terminal UI |
| `ink-select-input` | Selection component for TUI |
| `ink-text-input` | Text input component for TUI |
| `@strudel/core` | Pattern evaluation, scheduling |
| `@strudel/mini` | Mini-notation parser |
| `@strudel/transpiler` | Code transpilation |
