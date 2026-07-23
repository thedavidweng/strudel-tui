type ControllerState =
  | { tag: 'idle' }
  | { tag: 'ready'; view: any; usingFallback: boolean }
  | { tag: 'error'; message: string };

const ENGINE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>strudel-tui engine</title></head>
<body>
<script src="https://unpkg.com/@strudel/web@1.2.6"></script>
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
    if (typeof (globalThis as any).Bun !== 'undefined' && (globalThis as any).Bun.WebView) {
      try {
        await this._startWebView();
        return;
      } catch (err: unknown) {
        console.warn(
          `[AudioController] WebView initialisation failed (${err instanceof Error ? err.message : err}), falling back to console mode.`,
        );
      }
    }

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

    this._state = {
      tag: 'ready',
      view,
      usingFallback: false,
    };
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

  async play(code: string): Promise<void> {
    await this.start();

    const state = this._state;
    if (state.tag !== 'ready') {
      throw new Error(`AudioController is not ready (state: ${state.tag})`);
    }

    if (state.usingFallback) {
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
    } catch (err: unknown) {
      if (this._isWebViewGone(err)) {
        this._resetToError('WebView crashed or was closed');
      }
      throw new Error(`Pattern evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
    } catch (err: unknown) {
      if (this._isWebViewGone(err)) {
        this._resetToError('WebView crashed or was closed');
      } else {
        console.warn('[AudioController] Error stopping playback:', err instanceof Error ? err.message : err);
      }
      this._isPlaying = false;
    }
  }

  async shutdown(): Promise<void> {
    const state = this._state;

    if (state.tag === 'ready' && state.view) {
      try {
        state.view.close();
      } catch {
        // Already closed
      }
    }

    this._state = { tag: 'idle' };
    this._isPlaying = false;
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
