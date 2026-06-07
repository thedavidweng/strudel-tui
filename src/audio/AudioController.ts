/**
 * AudioController manages the hidden browser process used to play Strudel
 * patterns.  It uses Bun's WebView API to spawn a headless browser that
 * loads Strudel's WebAudio engine from a CDN.
 *
 * If Bun.WebView is not available (e.g. older Bun versions, no display
 * server), a console-based fallback is used that logs patterns instead
 * of playing audio.  The interface remains identical so callers never
 * need to care which backend is active.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaybackStatus {
  isPlaying: boolean;
  isReady: boolean;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type ControllerState =
  | { tag: 'idle' }
  | { tag: 'ready'; view: any; usingFallback: boolean }
  | { tag: 'error'; message: string };

// ---------------------------------------------------------------------------
// HTML page loaded into the WebView
// ---------------------------------------------------------------------------

/**
 * Self-contained HTML page that loads Strudel from CDN and exposes
 * `window.evaluatePattern(code)` and `window.stopPlayback()`.
 *
 * The page waits for `initStrudel()` to finish before marking itself ready,
 * so the controller can await the ready signal before sending patterns.
 */
const ENGINE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>strudel-tui engine</title></head>
<body>
<script src="https://unpkg.com/@strudel/web@latest"></script>
<script>
  (async function() {
    try {
      // Initialise the Strudel runtime -- registers all pattern functions
      // on globalThis and sets up the default transpiler.
      await initStrudel();

      // Expose evaluatePattern so the controller can call it via
      // WebView.evaluate().
      window.evaluatePattern = async function(code) {
        try {
          // Strudel code is transpiled and evaluated in the global scope
          // where all pattern functions (note, s, cat, etc.) live.
          // We use Function() to evaluate arbitrary code strings while
          // keeping access to globals.
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const fn = new AsyncFunction(code);
          await fn();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err.message || err) };
        }
      };

      // Expose stopPlayback so the controller can call it.
      window.stopPlayback = async function() {
        try {
          // hush() is a global registered by Strudel that stops all
          // playing patterns.
          if (typeof hush === 'function') {
            hush();
          }
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err.message || err) };
        }
      };

      // Signal readiness.  The controller polls for this via
      // evaluate('window.__strudelReady').
      window.__strudelReady = true;
    } catch (err) {
      window.__strudelReady = false;
      window.__strudelError = String(err.message || err);
    }
  })();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// AudioController
// ---------------------------------------------------------------------------

export class AudioController {
  private _state: ControllerState = { tag: 'idle' };
  private _isPlaying = false;
  private _initPromise: Promise<void> | null = null;

  // -----------------------------------------------------------------------
  // start()
  // -----------------------------------------------------------------------

  /**
   * Lazily initialise the audio engine.  Creates a hidden WebView that
   * loads Strudel's WebAudio engine from CDN.  Returns a promise that
   * resolves when the engine is ready to accept patterns.
   *
   * Safe to call multiple times -- concurrent calls share the same
   * initialisation promise.
   */
  async start(): Promise<void> {
    if (this._state.tag === 'ready') return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doStart();
    try {
      await this._initPromise;
    } catch {
      // _doStart already sets _state to error on failure
    } finally {
      this._initPromise = null;
    }
  }

  private async _doStart(): Promise<void> {
    // ------------------------------------------------------------------
    // Try native Bun.WebView first
    // ------------------------------------------------------------------
    if (typeof (globalThis as any).Bun !== 'undefined' && (globalThis as any).Bun.WebView) {
      try {
        await this._startWebView();
        return;
      } catch (err: any) {
        console.warn(
          `[AudioController] WebView initialisation failed (${err.message}), falling back to console mode.`,
        );
      }
    }

    // ------------------------------------------------------------------
    // Fallback: console-based simulation
    // ------------------------------------------------------------------
    console.warn(
      '[AudioController] Bun.WebView not available -- using console fallback. ' +
        'Audio playback is simulated (patterns are logged to the console).',
    );
    this._state = {
      tag: 'ready',
      view: null,
      usingFallback: true,
    };
  }

  /**
   * Create and initialise a Bun.WebView with the Strudel engine HTML.
   * Throws if anything goes wrong so the caller can fall back.
   */
  private async _startWebView(): Promise<void> {
    const BunRef = (globalThis as any).Bun;

    // Build a data URI from the engine HTML.  The WebView will load this
    // as a self-contained page.
    const dataUri = 'data:text/html;base64,' + Buffer.from(ENGINE_HTML).toString('base64');

    // Create the headless WebView.
    const view = new BunRef.WebView({
      width: 1,
      height: 1,
    });

    // Navigate to the engine page and wait for it to load.
    await view.navigate(dataUri);

    // Wait for Strudel to initialise.  Poll until __strudelReady is set
    // or a timeout is reached.
    const ready = await this._waitForReady(view, 15_000);
    if (!ready) {
      view.close();
      throw new Error('Strudel engine failed to initialise within timeout');
    }

    // Check for initialisation errors reported by the page.
    const initError = await view.evaluate('window.__strudelError || null');
    if (initError) {
      view.close();
      throw new Error(`Strudel engine init error: ${initError}`);
    }

    this._state = {
      tag: 'ready',
      view,
      usingFallback: false,
    };
  }

  /**
   * Poll the WebView until `window.__strudelReady === true` or the
   * timeout is reached.
   */
  private async _waitForReady(view: any, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 200; // ms

    while (Date.now() < deadline) {
      try {
        const ready = await view.evaluate('!!window.__strudelReady');
        if (ready) return true;
      } catch {
        // evaluate() may fail while the page is still loading -- that's ok
      }
      await sleep(pollInterval);
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // play(code)
  // -----------------------------------------------------------------------

  /**
   * Evaluate and play the given Strudel pattern code.
   *
   * If the engine is not yet started it will be initialised automatically.
   * Errors from the WebView (syntax errors, runtime errors) are re-thrown
   * with context so the caller can display them.
   */
  async play(code: string): Promise<void> {
    await this.start();

    const state = this._state;
    if (state.tag !== 'ready') {
      throw new Error(`AudioController is not ready (state: ${state.tag})`);
    }

    if (state.usingFallback) {
      // Fallback mode -- just log the pattern
      console.log(`[AudioController] Playing pattern:\n${code}`);
      this._isPlaying = true;
      return;
    }

    try {
      const result = await state.view.evaluate(
        `window.evaluatePattern(${JSON.stringify(code)})`,
      );

      if (result && result.ok === false) {
        throw new Error(result.error || 'Unknown evaluation error');
      }

      this._isPlaying = true;
    } catch (err: any) {
      // If the WebView has crashed or been closed, reset state so a
      // subsequent call will re-create it.
      if (this._isWebViewGone(err)) {
        this._resetToError('WebView crashed or was closed');
      }
      throw new Error(`Pattern evaluation failed: ${err.message}`);
    }
  }

  // -----------------------------------------------------------------------
  // stop()
  // -----------------------------------------------------------------------

  /**
   * Stop all currently playing patterns.
   */
  async stop(): Promise<void> {
    const state = this._state;
    if (state.tag !== 'ready') return;

    if (state.usingFallback) {
      console.log('[AudioController] Playback stopped');
      this._isPlaying = false;
      return;
    }

    try {
      const result = await state.view.evaluate('window.stopPlayback()');
      if (result && result.ok === false) {
        console.warn('[AudioController] stopPlayback returned error:', result.error);
      }
      this._isPlaying = false;
    } catch (err: any) {
      if (this._isWebViewGone(err)) {
        this._resetToError('WebView crashed or was closed');
      } else {
        console.warn('[AudioController] Error stopping playback:', err.message);
      }
      this._isPlaying = false;
    }
  }

  // -----------------------------------------------------------------------
  // shutdown()
  // -----------------------------------------------------------------------

  /**
   * Tear down the WebView and reset all state.  After shutdown the
   * controller can be re-started by calling start() or play().
   */
  async shutdown(): Promise<void> {
    const state = this._state;

    if (state.tag === 'ready' && state.view) {
      try {
        state.view.close();
      } catch {
        // Already closed -- ignore
      }
    }

    this._state = { tag: 'idle' };
    this._isPlaying = false;
  }

  // -----------------------------------------------------------------------
  // getStatus()
  // -----------------------------------------------------------------------

  /**
   * Return the current playback and readiness status.
   */
  getStatus(): PlaybackStatus {
    return {
      isPlaying: this._isPlaying,
      isReady: this._state.tag === 'ready',
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Heuristic: did the WebView die?  Bun throws when evaluate() is
   * called on a closed or crashed view.
   */
  private _isWebViewGone(err: any): boolean {
    const msg = String(err?.message || err).toLowerCase();
    return (
      msg.includes('closed') ||
      msg.includes('destroyed') ||
      msg.includes('invalid_state') ||
      msg.includes('err_invalid_state')
    );
  }

  /**
   * Reset to an error state so the next play() call will attempt to
   * re-create the engine.
   */
  private _resetToError(message: string): void {
    console.warn(`[AudioController] ${message} -- will re-initialise on next play`);
    this._state = { tag: 'error', message };
    this._isPlaying = false;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
