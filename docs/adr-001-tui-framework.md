# ADR-001: pi-tui over Ink for the TUI layer

Status: **accepted** · Date: 2026-07-25

## Context

The project started on Ink (React) at inception (commit `bc031cd`, 2026-06-06)
and migrated to `@earendil-works/pi-tui` one day later (`c65c26f`) without a
recorded rationale. Docs kept describing the Ink version for weeks afterwards,
which prompted the question: which framework is actually the right choice?
This ADR records the evidence-based answer so the decision doesn't get
relitigated from stale docs.

## Decision

Stay on pi-tui.

## Evidence (all measured 2026-07-25, Bun 1.3.11, macOS arm64)

**Both work in `bun build --compile` binaries.** The historical Ink blocker
(standalone `yoga.wasm` not embedded, oven-sh/bun#13552) is gone —
yoga-layout ≥3.2.1 inlines the WASM as base64. Ink 7 does need
`react-devtools-core` added as a dependency to compile at all (its
`devtools.js` statically imports it); this is why the original Ink commit
carried that dependency.

| Measured | Ink 7.1.1 | pi-tui 0.80.3 |
|---|---|---|
| Compiled binary starts, renders, handles keys | ✅ | ✅ |
| Startup to first frame + exit (steady state) | ~100 ms | ~30 ms |
| Compiled binary size | 60.0 MB | 58.5 MB (Bun runtime dominates both) |
| Runtime dependency tree | 40 packages, 37 MB (React, reconciler, scheduler, yoga) | 2 packages, ~2 MB (get-east-asian-width, marked) |

**The deciding factor is CJK/IME input.** This project advertises IME
support. Ink has an open, untriaged structural bug — vadimdemedes/ink#759
(2025-08): IME composition input lags, drops characters, and mispositions the
cursor, because Ink does not buffer stdin until composition completes. pi-tui
ships exactly the missing layer: a dedicated `StdinBuffer` (adapted from
OpenTUI) that assembles partial escape/composition sequences, plus bracketed
paste, kitty keyboard protocol with capability detection, synchronized output
(`?2026`), and grapheme-cluster width measurement that handles east-asian
width, ZWJ emoji, and VS16 — including mid-stream emoji, which matters for
streamed LLM output.

**Migration economics.** The TUI layer is ~2,000 lines across 9 files, with
65 component tests (289 assertions) that drive components as pure
`render(width): string[]` functions — no PTY, no snapshot library. Moving to
Ink would rewrite all of it, replace the test approach with
ink-testing-library, and re-verify the manually-managed terminal lifecycle
(alternate screen, crash restore, abort handling) — for an app whose layout
is a fixed vertical stack that needs none of Ink's flexbox or ecosystem.

**Maintenance risk, honestly stated.** Ink is the healthier project
(~39.5k stars, monthly releases, 7.1.1 shipped 2026-07-16). pi-tui is niche
(earendil-works/pi, the Kimi Code / pi-agent TUI) and pre-1.0 with breaking
minors — mitigated by the caret range `^0.80.3` (patch-only for 0.x),
dependabot, and the small API surface we touch (`Component`, `Container`,
`TUI`, `ProcessTerminal`, `Input`, `matchesKey`, 4 text utils). Its native
`.node` prebuilds (macOS modifier keys, Windows console mode) are optional
with graceful fallback — verified harmless in the compiled binary.

## Consequences

- Ink's ecosystem components are unavailable; all widgets stay bespoke
  (they already are: pattern editor with syntax highlighting, slash menu,
  inline config wizard).
- Revisit only if pi-tui stops shipping or the app outgrows string-array
  rendering (e.g. needs complex reactive layout). The trigger to re-evaluate
  Ink specifically is vadimdemedes/ink#759 being fixed.
