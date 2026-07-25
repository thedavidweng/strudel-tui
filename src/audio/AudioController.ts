import { BrowserBridge } from './BrowserBridge.js';

/**
 * Playback outcome: 'playing' means sound is (or is about to be) running;
 * 'awaiting-browser' means a browser tab was opened and the pattern will
 * start as soon as the user clicks "Enable audio" there.
 */
export type PlayResult = 'playing' | 'awaiting-browser';

type Backend =
  | { kind: 'webview'; view: any }
  | { kind: 'browser'; bridge: BrowserBridge }
  | { kind: 'console' };

type ControllerState =
  | { tag: 'idle' }
  | { tag: 'ready'; backend: Backend }
  | { tag: 'error'; message: string };

const ENGINE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>strudel-tui engine</title></head>
<body>
<script src="https://unpkg.com/@strudel/web@1.2.6/dist/index.js" integrity="sha384-6SxFGprJU+pzaOgfaK+HU0ILOMhDKJ6O5uAExCh2wD/WtS5I4xa2cKZpaUuozLlq" crossorigin="anonymous"></script>
<script>
  (async function() {
    try {
      await initStrudel();
      window.evaluatePattern = async function(code) {
        try {
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const fn = new AsyncFunction(code);
          await fn();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err.message || err) };
        }
      };
      window.stopPlayback = async function() {
        try {
          if (typeof hush === 'function') {
            hush();
          }
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err.message || err) };
        }
      };
      window.__strudelReady = true;
    } catch (err) {
      window.__strudelReady = false;
      window.__strudelError = String(err.message || err);
    }
  })();
</script>
</body>
</html>`;

const ENGINE_DATA_URI = 'data:text/html;base64,' + Buffer.from(ENGINE_HTML).toString('base64');

export class AudioController {
  private _state: ControllerState = { tag: 'idle' };
  private _isPlaying = false;
  private _initPromise: Promise<void> | null = null;
  private _browserOpened = false;
  private readonly _onPlaybackChange: ((playing: boolean) => void) | null;

  /**
   * @param onPlaybackChange invoked when playback starts or stops outside a
   * direct play()/stop() call — e.g. the browser tab starts a queued pattern
   * after the user's enable click, or the tab is closed mid-playback.
   */
  constructor(onPlaybackChange?: (playing: boolean) => void) {
    this._onPlaybackChange = onPlaybackChange ?? null;
  }

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
    // Hidden WebView is the ideal backend, but no released Bun exposes one
    // yet — the check is here so it lights up if that changes.
    if (typeof (globalThis as any).Bun !== 'undefined' && (globalThis as any).Bun.WebView) {
      try {
        await this._startWebView();
        return;
      } catch (err: unknown) {
        console.warn(
          `[AudioController] WebView initialisation failed (${err instanceof Error ? err.message : err}), trying browser bridge.`,
        );
      }
    }

    try {
      const bridge = new BrowserBridge((status) => {
        switch (status.type) {
          case 'ready':
            console.log('[audio] Browser audio ready');
            break;
          case 'playing':
            this._isPlaying = true;
            this._onPlaybackChange?.(true);
            break;
          case 'error':
            console.warn(`[audio] Browser playback error: ${status.error}`);
            break;
          case 'disconnected':
            this._isPlaying = false;
            this._browserOpened = false;
            this._onPlaybackChange?.(false);
            console.warn('[audio] Browser audio tab closed — playing again will reopen it');
            break;
        }
      });
      bridge.start();
      this._state = { tag: 'ready', backend: { kind: 'browser', bridge } };
      return;
    } catch (err: unknown) {
      console.warn(
        `[AudioController] Browser bridge failed to start (${err instanceof Error ? err.message : err}), falling back to console mode.`,
      );
    }

    console.warn(
      '[AudioController] No audio backend available -- using console fallback. ' +
        'Audio playback is simulated (patterns are logged to the console).',
    );
    this._state = { tag: 'ready', backend: { kind: 'console' } };
  }

  private async _startWebView(): Promise<void> {
    const BunRef = (globalThis as any).Bun;

    const view = new BunRef.WebView({
      width: 1,
      height: 1,
    });

    await view.navigate(ENGINE_DATA_URI);

    const ready = await this._waitForReady(view, 15_000);
    if (!ready) {
      view.close();
      throw new Error('Strudel engine failed to initialise within timeout');
    }

    const initError = await view.evaluate('window.__strudelError || null');
    if (initError) {
      view.close();
      throw new Error(`Strudel engine init error: ${initError}`);
    }

    this._state = { tag: 'ready', backend: { kind: 'webview', view } };
  }

  private async _waitForReady(view: any, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 200;

    while (Date.now() < deadline) {
      try {
        const ready = await view.evaluate('!!window.__strudelReady');
        if (ready) return true;
      } catch {
        // evaluate() may fail while the page is still loading
      }
      await sleep(pollInterval);
    }
    return false;
  }

  async play(code: string): Promise<PlayResult> {
    await this.start();

    const state = this._state;
    if (state.tag !== 'ready') {
      throw new Error(`AudioController is not ready (state: ${state.tag})`);
    }

    switch (state.backend.kind) {
      case 'console':
        console.log(`[AudioController] Playing pattern (simulated):\n${code}`);
        this._isPlaying = true;
        return 'playing';

      case 'browser': {
        const bridge = state.backend.bridge;
        const sent = bridge.play(code);
        if (sent) {
          this._isPlaying = true;
          return 'playing';
        }
        // Queued: open a tab once and wait for the user's enable click.
        // _browserOpened resets when a connected tab drops, so a closed tab
        // is reopened on the next play without ever stacking duplicates.
        if (!bridge.hasClient && !this._browserOpened) {
          bridge.openBrowser();
          this._browserOpened = true;
        }
        return 'awaiting-browser';
      }

      case 'webview': {
        try {
          const result = await state.backend.view.evaluate(
            `window.evaluatePattern(${JSON.stringify(code)})`,
          );

          if (result && result.ok === false) {
            throw new Error(result.error || 'Unknown evaluation error');
          }

          this._isPlaying = true;
          return 'playing';
        } catch (err: unknown) {
          if (this._isWebViewGone(err)) {
            this._resetToError('WebView crashed or was closed');
          }
          throw new Error(`Pattern evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  async stop(): Promise<void> {
    const state = this._state;
    if (state.tag !== 'ready') return;

    switch (state.backend.kind) {
      case 'console':
        console.log('[AudioController] Playback stopped');
        this._isPlaying = false;
        return;

      case 'browser':
        state.backend.bridge.stop();
        this._isPlaying = false;
        return;

      case 'webview': {
        try {
          const result = await state.backend.view.evaluate('window.stopPlayback()');
          if (result && result.ok === false) {
            console.warn('[AudioController] stopPlayback returned error:', result.error);
          }
          this._isPlaying = false;
        } catch (err: unknown) {
          if (this._isWebViewGone(err)) {
            this._resetToError('WebView crashed or was closed');
          } else {
            console.warn('[AudioController] Error stopping playback:', err instanceof Error ? err.message : err);
          }
          this._isPlaying = false;
        }
        return;
      }
    }
  }

  async shutdown(): Promise<void> {
    const state = this._state;

    if (state.tag === 'ready') {
      switch (state.backend.kind) {
        case 'browser':
          state.backend.bridge.shutdown();
          break;
        case 'webview':
          try {
            state.backend.view.close();
          } catch {
            // Already closed
          }
          break;
      }
    }

    this._state = { tag: 'idle' };
    this._isPlaying = false;
    this._browserOpened = false;
  }

  private _isWebViewGone(err: unknown): boolean {
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    return (
      msg.includes('closed') ||
      msg.includes('destroyed') ||
      msg.includes('invalid_state') ||
      msg.includes('err_invalid_state')
    );
  }

  private _resetToError(message: string): void {
    console.warn(`[AudioController] ${message} -- will re-initialise on next play`);
    this._state = { tag: 'error', message };
    this._isPlaying = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
