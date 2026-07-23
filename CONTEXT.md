# CONTEXT.md — strudel-tui domain language

A single-context glossary for strudel-tui. Names the concepts that the
codebase organises around. Architecture reviews and ADRs should use these
terms.

## Core concepts

**Pattern** — a Strudel mini-notation / JavaScript code string that
describes a musical pattern (e.g. `s("bd sn hh cp")`). The central artifact
the user edits and plays.

**PatternOwner** — the single source of truth for the current Pattern and
its undo/redo stack. All pattern mutation flows through it. Callers read
`currentPattern`; they do not hold their own copy.

**Agent** — the conversational front end. Receives a user message and
routes it to either the LLM adapter or the keyword adapter. Owns the
PatternOwner, ChatLog, and tool executor.

**Tool** — a named capability the LLM can invoke (play, stop, validate,
generate, edit, set, get info, list, load, save). Dispatched by
ToolExecutor.

**ToolExecutor** — dispatches Tool calls to the Engine, PatternOwner, and
Audio. Holds no pattern state of its own; it mutates the PatternOwner.

**Engine** — the Strudel runtime wrapper. Evaluates and analyses
patterns using `@strudel/core`. Requires explicit `init()` before use
(lazy-imports the runtime and patches globalThis). No audio.

**PatternSyntax** — pure, side-effect-free pattern operations: validate,
generate, and seed-based generation. No runtime, no init, no globals.
Safe to call at any time.

**Audio** — the playback backend. A hidden Bun.WebView runs Strudel's
WebAudio engine; a console fallback logs patterns when WebView is
unavailable. Interface: `play(code)` / `stop()`.

**ChatLog** — in-memory conversation messages (user / agent / system /
error) for the current session. Distinct from the LLM wire-format
history.

**SessionStore** — persistence for a session: writes ChatLog messages and
the PatternOwner's undo/redo stack to one JSON file per session.

## Adapters

**LLMAdapter** — talks to an OpenAI-compatible streaming API, dispatches
tool calls, and feeds results back. Owns the OpenAI wire-format chat
history.

**ChatHistory** — owns the OpenAI wire-format message list for one
conversation: system prompt, user/assistant/tool messages, and the
context-suffix injection that appends the current pattern to a request.
Distinct from ChatLog (domain messages for persistence).

**SSEParser** — Server-Sent Events framing. Takes a byte stream and
yields `data:` payloads, handling partial chunks and multi-byte splits.
Knows nothing about OpenAI or JSON — reusable for any SSE endpoint.

**KeywordAdapter** — regex-based intent detection that routes messages to
Tools without an API key.
