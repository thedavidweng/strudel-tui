# How to: Play audio through your browser

A terminal cannot produce WebAudio, so strudel-tui plays patterns through a
small page it opens in your default browser. You play once, click one button,
and from then on each `play` streams straight to that tab.

> In-TUI screens below are illustrative (real labels, not a captured session);
> the underlying messages come from `src/audio/BrowserBridge.ts` and
> `src/tui/StrudelTUI.ts`.

---

## Scenario: first play

You launched `strudel-tui`, have a pattern loaded, and want to hear it.

```text
> play
Opened a browser tab for audio — click "Enable audio" there. Your pattern starts automatically.
```
*(Illustrative — the system message in the TUI's message history.)*

On first play strudel-tui starts a token-gated server on `127.0.0.1` and opens
the audio page in your default browser. The page asks for one click — browsers
require a user gesture before any sound:

```text
▶ Enable audio
```
*(Illustrative — the button on the browser page.)*

Click it once. The status bar in the TUI switches to `PLAYING` and you hear the
pattern loop. Every later `play` reuses the open tab with no extra clicks.

**Next step:** change the pattern while it plays — see
[Edit patterns](edit-patterns.md).

## Scenario: hear an edit you just made

You changed the pattern (via `edit`, direct code, or the agent) while it was
playing, and the loop still sounds like the old version.

Playback keeps running whatever it started with; run `play` again to push the
current pattern to the browser tab — it replaces what's sounding without a stop
in between:

```text
> play
```

With an AI agent configured this is usually automatic: when you ask for an edit,
the agent typically ends by playing the edited code, which swaps the running
pattern in one step.

## Scenario: stop

```text
> stop
```

The status bar returns to `STOPPED`. (`Ctrl+P` toggles play/stop from anywhere.)

## Scenario: closed the browser tab

You closed the tab and playback went silent.

Just play again:

```text
> play
```

strudel-tui notices the tab is gone and opens a fresh one. You'll need to click
**▶ Enable audio** again in the new tab — each page load needs its own gesture.

## Troubleshooting: no sound

Work down this list:

1. **The browser page isn't open.** Check your browser for the strudel-tui tab;
   if missing, just `play` again — strudel-tui reopens it.
2. **You haven't clicked Enable audio** since the page (re)loaded. Until you do,
   played patterns are queued, not sounding.
3. **Browser output device / muted tab.** The tab's own mute state and your OS
   output device apply as usual.
4. **Still nothing?** Run with debug logging and watch what the audio layer does:

   ```bash
   strudel-tui --debug
   ```

5. **No default browser available?** Playback falls back to logging patterns in
   the message history instead of sounding — you'll see pattern text replies
   rather than an opened tab.

For how the bridge actually works (token-gated localhost server, WebSocket,
CDN-loaded Strudel engine), read
[Why audio runs in a browser tab](../explanation/audio-bridge.md).
