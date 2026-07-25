import { randomBytes } from 'node:crypto';

/**
 * Audio backend that drives Strudel's WebAudio engine in a browser tab.
 *
 * The TUI cannot produce sound itself, so this serves a small page on
 * 127.0.0.1 that loads @strudel/web and connects back over WebSocket. The
 * TUI pushes play/stop over that socket, which makes live editing work: a
 * new pattern replaces the running one without touching the browser again.
 *
 * Browsers refuse to start audio without a user gesture, so the page shows
 * an "Enable audio" button once; code sent before that is queued and played
 * as soon as the user clicks.
 */

export type BridgeStatus =
  | { type: 'waiting' }
  | { type: 'ready' }
  | { type: 'playing' }
  | { type: 'stopped' }
  | { type: 'error'; error: string }
  | { type: 'disconnected' };

export type BridgeStatusHandler = (status: BridgeStatus) => void;

interface BridgeSocketData {
  authorized: boolean;
}

export class BrowserBridge {
  private _server: ReturnType<typeof Bun.serve> | null = null;
  private _client: Bun.ServerWebSocket<BridgeSocketData> | null = null;
  private _clientReady = false;
  private _pendingCode: string | null = null;
  private readonly _token: string = randomBytes(16).toString('hex');
  private readonly _onStatus: BridgeStatusHandler;

  constructor(onStatus: BridgeStatusHandler) {
    this._onStatus = onStatus;
  }

  /** Starts the local server. Does not open a browser yet. */
  start(): void {
    if (this._server) return;

    this._server = Bun.serve<BridgeSocketData, never>({
      hostname: '127.0.0.1',
      port: 0,
      fetch: (req, server) => {
        const url = new URL(req.url);
        if (url.pathname === '/ws') {
          if (url.searchParams.get('token') !== this._token) {
            return new Response('forbidden', { status: 403 });
          }
          if (server.upgrade(req, { data: { authorized: true } })) {
            return undefined as unknown as Response;
          }
          return new Response('upgrade failed', { status: 400 });
        }
        if (url.pathname === '/') {
          return new Response(bridgePage(this._token), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        return new Response('not found', { status: 404 });
      },
      websocket: {
        open: (ws) => {
          // Latest tab wins; a stale tab would race play/stop otherwise.
          if (this._client) {
            try {
              this._client.close();
            } catch {
              // Already gone.
            }
          }
          this._client = ws;
          this._clientReady = false;
        },
        message: (_ws, raw) => this._handleMessage(String(raw)),
        close: (ws) => {
          if (this._client === ws) {
            this._client = null;
            this._clientReady = false;
            this._onStatus({ type: 'disconnected' });
          }
        },
      },
    });
  }

  get url(): string {
    if (!this._server) throw new Error('BrowserBridge is not started');
    return `http://127.0.0.1:${this._server.port}/`;
  }

  get hasReadyClient(): boolean {
    return this._client !== null && this._clientReady;
  }

  get hasClient(): boolean {
    return this._client !== null;
  }

  /**
   * Plays code in the connected tab, or queues it until the user enables
   * audio there. Returns true if it was sent immediately.
   */
  play(code: string): boolean {
    if (this._client && this._clientReady) {
      this._client.send(JSON.stringify({ type: 'play', code }));
      return true;
    }
    this._pendingCode = code;
    return false;
  }

  stop(): void {
    this._pendingCode = null;
    if (this._client && this._clientReady) {
      this._client.send(JSON.stringify({ type: 'stop' }));
    }
  }

  shutdown(): void {
    if (this._client) {
      try {
        this._client.send(JSON.stringify({ type: 'shutdown' }));
        this._client.close();
      } catch {
        // Already gone.
      }
      this._client = null;
    }
    this._clientReady = false;
    this._pendingCode = null;
    this._server?.stop(true);
    this._server = null;
  }

  /** Opens the bridge page in the default browser. */
  openBrowser(): void {
    const url = this.url;
    const cmd =
      process.platform === 'darwin'
        ? ['open', url]
        : process.platform === 'win32'
          ? ['cmd', '/c', 'start', '', url]
          : ['xdg-open', url];
    Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
  }

  private _handleMessage(raw: string): void {
    let msg: { type?: string; error?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'ready': {
        this._clientReady = true;
        this._onStatus({ type: 'ready' });
        if (this._pendingCode !== null) {
          const code = this._pendingCode;
          this._pendingCode = null;
          this._client?.send(JSON.stringify({ type: 'play', code }));
        }
        break;
      }
      case 'playing':
        this._onStatus({ type: 'playing' });
        break;
      case 'stopped':
        this._onStatus({ type: 'stopped' });
        break;
      case 'error':
        this._onStatus({ type: 'error', error: msg.error ?? 'unknown error' });
        break;
    }
  }
}

function bridgePage(token: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>strudel-tui audio</title>
<style>
  body { margin: 0; background: #14141b; color: #e8e8ef; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
  #enable { font-size: 1.4rem; padding: 1rem 2.5rem; border-radius: 8px; border: 1px solid #7c6df2; background: #221f33; color: #e8e8ef; cursor: pointer; }
  #enable:hover { background: #2d2947; }
  #status { margin-top: 1.5rem; color: #8a8a98; }
  #code { margin-top: 1rem; max-width: 80ch; white-space: pre-wrap; color: #a8e6a1; }
  .hidden { display: none; }
</style>
</head>
<body>
<button id="enable">&#9654; Enable audio</button>
<div id="status">strudel-tui is connected to this tab. Keep it open while you play.</div>
<pre id="code"></pre>
<script src="https://unpkg.com/@strudel/web@1.2.6/dist/index.js" integrity="sha384-6SxFGprJU+pzaOgfaK+HU0ILOMhDKJ6O5uAExCh2wD/WtS5I4xa2cKZpaUuozLlq" crossorigin="anonymous"></script>
<script>
  const statusEl = document.getElementById('status');
  const codeEl = document.getElementById('code');
  const enableBtn = document.getElementById('enable');
  const ws = new WebSocket('ws://' + location.host + '/ws?token=${token}');
  let ready = false;
  let pending = null;

  function send(msg) { try { ws.send(JSON.stringify(msg)); } catch (e) {} }

  async function run(code) {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      await new AsyncFunction(code)();
      codeEl.textContent = code;
      statusEl.textContent = 'playing';
      send({ type: 'playing' });
    } catch (err) {
      statusEl.textContent = 'pattern error: ' + (err && err.message || err);
      send({ type: 'error', error: String(err && err.message || err) });
    }
  }

  enableBtn.addEventListener('click', async () => {
    enableBtn.disabled = true;
    enableBtn.textContent = 'starting…';
    try {
      await initStrudel();
      ready = true;
      enableBtn.classList.add('hidden');
      statusEl.textContent = 'audio ready';
      send({ type: 'ready' });
      if (pending) { const c = pending; pending = null; run(c); }
    } catch (err) {
      enableBtn.disabled = false;
      enableBtn.textContent = '▶ Enable audio';
      statusEl.textContent = 'failed to start audio engine: ' + (err && err.message || err);
      send({ type: 'error', error: 'init failed: ' + String(err && err.message || err) });
    }
  });

  ws.addEventListener('message', (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'play') {
      if (!ready) { pending = msg.code; return; }
      run(msg.code);
    } else if (msg.type === 'stop') {
      if (ready && typeof hush === 'function') hush();
      statusEl.textContent = 'stopped';
      send({ type: 'stopped' });
    } else if (msg.type === 'shutdown') {
      statusEl.textContent = 'strudel-tui session ended — you can close this tab';
      if (ready && typeof hush === 'function') hush();
    }
  });

  ws.addEventListener('close', () => {
    if (ready && typeof hush === 'function') hush();
    statusEl.textContent = 'strudel-tui session ended — you can close this tab';
  });
</script>
</body>
</html>`;
}
