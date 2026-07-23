import { describe, test, expect } from 'bun:test';
import { SSEParser } from '../src/llm/SSEParser';

function makeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const parser = new SSEParser(stream);
  const out: string[] = [];
  let data: string | null;
  while ((data = await parser.next()) !== null) out.push(data);
  parser.release();
  return out;
}

describe('SSEParser', () => {
  test('yields data payloads from complete lines', async () => {
    const stream = makeStream([
      encode('data: hello\n'),
      encode('data: world\n'),
    ]);
    expect(await collect(stream)).toEqual(['hello', 'world']);
  });

  test('handles data: with no space after colon', async () => {
    const stream = makeStream([encode('data:nospace\n')]);
    expect(await collect(stream)).toEqual(['nospace']);
  });

  test('skips blank lines and comments', async () => {
    const stream = makeStream([
      encode('\n'),
      encode(':this is a comment\n'),
      encode('data: kept\n'),
    ]);
    expect(await collect(stream)).toEqual(['kept']);
  });

  test('skips non-data fields (event, id, retry)', async () => {
    const stream = makeStream([
      encode('event: ping\n'),
      encode('id: 42\n'),
      encode('retry: 1000\n'),
      encode('data: payload\n'),
    ]);
    expect(await collect(stream)).toEqual(['payload']);
  });

  test('reassembles a payload split across chunks', async () => {
    const stream = makeStream([
      encode('data: hel'),
      encode('lo\n'),
    ]);
    expect(await collect(stream)).toEqual(['hello']);
  });

  test('handles a payload with no trailing newline at EOF', async () => {
    const stream = makeStream([encode('data: trailing')]);
    expect(await collect(stream)).toEqual(['trailing']);
  });

  test('returns null after the stream is exhausted', async () => {
    const parser = new SSEParser(makeStream([encode('data: one\n')]));
    expect(await parser.next()).toBe('one');
    expect(await parser.next()).toBeNull();
    expect(await parser.next()).toBeNull();
    parser.release();
  });

  test('returns null for an empty stream', async () => {
    const parser = new SSEParser(makeStream([]));
    expect(await parser.next()).toBeNull();
    parser.release();
  });

  test('preserves [DONE] sentinel as a data payload', async () => {
    const stream = makeStream([encode('data: [DONE]\n')]);
    expect(await collect(stream)).toEqual(['[DONE]']);
  });

  test('handles multiple data lines in one chunk', async () => {
    const stream = makeStream([
      encode('data: a\ndata: b\ndata: c\n'),
    ]);
    expect(await collect(stream)).toEqual(['a', 'b', 'c']);
  });

  test('handles multi-byte UTF-8 split across chunks', async () => {
    // "é" is 0xC3 0xA9 — split it between two chunks
    const stream = makeStream([
      encode('data: caf'),
      new Uint8Array([0xc3]),
      new Uint8Array([0xa9, 0x0a]), // é + newline
    ]);
    expect(await collect(stream)).toEqual(['café']);
  });
});
