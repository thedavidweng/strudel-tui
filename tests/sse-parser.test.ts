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
  test('yields one payload per blank-line-delimited event', async () => {
    const stream = makeStream([
      encode('data: hello\n\n'),
      encode('data: world\n\n'),
    ]);
    expect(await collect(stream)).toEqual(['hello', 'world']);
  });

  test('joins multiple data lines of one event with newline (spec §9.2.6)', async () => {
    const stream = makeStream([
      encode('data: {"a":\ndata: 1}\n\n'),
      encode('data: next\n\n'),
    ]);
    expect(await collect(stream)).toEqual(['{"a":\n1}', 'next']);
  });

  test('handles data: with no space after colon', async () => {
    const stream = makeStream([encode('data:nospace\n\n')]);
    expect(await collect(stream)).toEqual(['nospace']);
  });

  test('skips comments and empty events', async () => {
    const stream = makeStream([
      encode('\n'),
      encode(':this is a comment\n\n'),
      encode('data: kept\n\n'),
    ]);
    expect(await collect(stream)).toEqual(['kept']);
  });

  test('non-data fields do not dispatch or join into the payload', async () => {
    const stream = makeStream([
      encode('event: ping\nid: 42\nretry: 1000\ndata: payload\n\n'),
    ]);
    expect(await collect(stream)).toEqual(['payload']);
  });

  test('reassembles a payload split across transport chunks', async () => {
    const stream = makeStream([
      encode('data: hel'),
      encode('lo\n\n'),
    ]);
    expect(await collect(stream)).toEqual(['hello']);
  });

  test('flushes a pending event at EOF without trailing delimiter', async () => {
    const stream = makeStream([encode('data: trailing')]);
    expect(await collect(stream)).toEqual(['trailing']);
  });

  test('flushes accumulated data lines at EOF', async () => {
    const stream = makeStream([encode('data: a\ndata: b')]);
    expect(await collect(stream)).toEqual(['a\nb']);
  });

  test('handles CRLF line endings', async () => {
    const stream = makeStream([encode('data: one\r\n\r\ndata: two\r\n\r\n')]);
    expect(await collect(stream)).toEqual(['one', 'two']);
  });

  test('returns null after the stream is exhausted', async () => {
    const parser = new SSEParser(makeStream([encode('data: one\n\n')]));
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
    const stream = makeStream([encode('data: [DONE]\n\n')]);
    expect(await collect(stream)).toEqual(['[DONE]']);
  });

  test('handles multiple events in one transport chunk', async () => {
    const stream = makeStream([
      encode('data: a\n\ndata: b\n\ndata: c\n\n'),
    ]);
    expect(await collect(stream)).toEqual(['a', 'b', 'c']);
  });

  test('handles multi-byte UTF-8 split across chunks', async () => {
    // "é" is 0xC3 0xA9 — split it between two chunks
    const stream = makeStream([
      encode('data: caf'),
      new Uint8Array([0xc3]),
      new Uint8Array([0xa9, 0x0a, 0x0a]), // é + blank-line delimiter
    ]);
    expect(await collect(stream)).toEqual(['café']);
  });
});
