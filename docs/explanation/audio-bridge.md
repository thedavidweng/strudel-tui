# Why audio runs in a browser tab

strudel-tui is a terminal app, yet patterns play as real audio. This page
explains the design: why a browser is involved, what the "Enable audio" click
is for, and what happens when things go missing.

For the code path, see `src/audio/BrowserBridge.ts` and
`src/audio/AudioController.ts`; for the wider architecture,
[Architecture](architecture.md).

## The constraint: WebAudio lives in browsers

Strudel's sound engine is WebAudio code running in a JavaScript runtime.
Terminals have no WebAudio, and strudel-tui deliberately ships no Electron and
no bundled browser — the binary stays small and cross-platform. The one
WebAudio runtime every user already has is their browser.

So on first `play`, strudel-tui starts a small HTTP + WebSocket server on
`127.0.0.1` and opens a page in your default browser. The page loads
`@strudel/web` — pinned to an exact version with a Subresource Integrity hash,
so the engine cannot change underneath you — and from then on the TUI streams
play/stop/code messages to the tab over the WebSocket.

## The click: browser autoplay rules

Browsers refuse to make sound until the user has interacted with the page —
no page may autoplay audio. The bridge page therefore shows one
**▶ Enable audio** button. Code sent before you click is queued and plays the
moment you do. One click per page load: reopen the tab (close it, then `play`
again) and you click again.

## The gate: why the URL has a token

The local server would otherwise accept connections from any page or process
on your machine. Each session generates a random token; both the page URL and
the WebSocket URL carry it, and requests without it are rejected. Nothing but
your own TUI session can drive the audio tab.

## The fallbacks

`AudioController` picks a backend in order:

1. **Embedded WebView** — if the Bun runtime ever ships a `Bun.WebView`, sound
   needs no browser at all. (It doesn't yet.)
2. **Browser bridge** — the normal path described above.
3. **Console fallback** — no browser available? Playback "plays" by logging
   patterns into the message history, so the rest of the workflow still works.

If the tab closes mid-session, the TUI notices and tells you on the next play
that it will reopen it.

## Why edits don't interrupt playback

The bridge replaces the pattern inside the running Strudel engine rather than
restarting audio. That's why `play` after an edit swaps the loop in place with
no gap — and why an edit *without* a following `play` leaves the old loop
sounding ([How to: hear an edit](../how-to/play-audio.md#scenario-hear-an-edit-you-just-made)).
