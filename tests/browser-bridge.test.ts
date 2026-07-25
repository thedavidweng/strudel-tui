import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BrowserBridge, type BridgeStatus } from '../src/audio/BrowserBridge';

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('connect failed'));
  });
}

function nextMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    ws.onmessage = (e) => resolve(JSON.parse(String(e.data)));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('BrowserBridge', () => {
  let bridge: BrowserBridge;
  let statuses: BridgeStatus[];

  beforeEach(() => {
    statuses = [];
    bridge = new BrowserBridge((s) => statuses.push(s));
    bridge.start();
  });

  afterEach(() => {
    bridge.shutdown();
  });

  test('serves the bridge page on localhost', async () => {
    const res = await fetch(bridge.url);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Enable audio');
    expect(html).toContain('@strudel/web');
  });

  test('rejects a websocket without the token', async () => {
    const res = await fetch(bridge.url.replace(/\/$/, '') + '/ws');
    expect(res.status).toBe(403);
  });

  test('accepts a tokenized websocket and reports ready', async () => {
    const html = await (await fetch(bridge.url)).text();
    const token = html.match(/token=([0-9a-f]+)/)![1];
    const ws = await connect(`${bridge.url.replace('http', 'ws')}ws?token=${token}`);

    expect(bridge.hasClient).toBe(true);
    expect(bridge.hasReadyClient).toBe(false);

    ws.send(JSON.stringify({ type: 'ready' }));
    await sleep(50);

    expect(bridge.hasReadyClient).toBe(true);
    expect(statuses.some((s) => s.type === 'ready')).toBe(true);
    ws.close();
  });

  test('play() before a client connects queues; queued code plays on ready', async () => {
    expect(bridge.play('s("bd sn")')).toBe(false);

    const html = await (await fetch(bridge.url)).text();
    const token = html.match(/token=([0-9a-f]+)/)![1];
    const ws = await connect(`${bridge.url.replace('http', 'ws')}ws?token=${token}`);

    const incoming = nextMessage(ws);
    ws.send(JSON.stringify({ type: 'ready' }));
    const msg = await incoming;

    expect(msg.type).toBe('play');
    expect(msg.code).toBe('s("bd sn")');
    ws.close();
  });

  test('play() with a ready client sends immediately', async () => {
    const html = await (await fetch(bridge.url)).text();
    const token = html.match(/token=([0-9a-f]+)/)![1];
    const ws = await connect(`${bridge.url.replace('http', 'ws')}ws?token=${token}`);
    ws.send(JSON.stringify({ type: 'ready' }));
    await sleep(50);

    const incoming = nextMessage(ws);
    expect(bridge.play('s("hh*8")')).toBe(true);
    const msg = await incoming;
    expect(msg).toEqual({ type: 'play', code: 's("hh*8")' });
    ws.close();
  });

  test('stop() sends stop and clears queued code', async () => {
    bridge.play('s("bd")'); // queued
    bridge.stop(); // clears the queue

    const html = await (await fetch(bridge.url)).text();
    const token = html.match(/token=([0-9a-f]+)/)![1];
    const ws = await connect(`${bridge.url.replace('http', 'ws')}ws?token=${token}`);

    let received: any[] = [];
    ws.onmessage = (e) => received.push(JSON.parse(String(e.data)));
    ws.send(JSON.stringify({ type: 'ready' }));
    await sleep(80);

    // Queue was cleared before the client became ready — nothing plays.
    expect(received.filter((m) => m.type === 'play')).toEqual([]);
    ws.close();
  });

  test('client disconnect reports a status and resets readiness', async () => {
    const html = await (await fetch(bridge.url)).text();
    const token = html.match(/token=([0-9a-f]+)/)![1];
    const ws = await connect(`${bridge.url.replace('http', 'ws')}ws?token=${token}`);
    ws.send(JSON.stringify({ type: 'ready' }));
    await sleep(50);
    expect(bridge.hasReadyClient).toBe(true);

    ws.close();
    await sleep(80);

    expect(bridge.hasClient).toBe(false);
    expect(bridge.hasReadyClient).toBe(false);
    expect(statuses.some((s) => s.type === 'disconnected')).toBe(true);
  });

  test('playback errors from the page are surfaced', async () => {
    const html = await (await fetch(bridge.url)).text();
    const token = html.match(/token=([0-9a-f]+)/)![1];
    const ws = await connect(`${bridge.url.replace('http', 'ws')}ws?token=${token}`);
    ws.send(JSON.stringify({ type: 'error', error: 'bad pattern' }));
    await sleep(50);

    const err = statuses.find((s) => s.type === 'error');
    expect(err).toEqual({ type: 'error', error: 'bad pattern' });
    ws.close();
  });
});
