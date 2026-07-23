import { describe, test, expect, afterEach } from 'bun:test';
import { OpenAIClient } from '../src/llm/OpenAIClient';

function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
}

function makeResponse(stream: ReadableStream<Uint8Array>, status = 200): Response {
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('OpenAIClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('streamChat', () => {
    test('yields text_delta events for content chunks', async () => {
      const sse = [
        'data: {"choices":[{"delta":{"content":"hello"},"finish_reason":null}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      const events: string[] = [];
      for await (const ev of client.streamChat([{ role: 'user', content: 'hi' }])) {
        if (ev.type === 'text_delta') events.push(ev.delta);
      }
      expect(events).toEqual(['hello']);
    });

    test('yields done event on [DONE] sentinel', async () => {
      const sse = ['data: [DONE]'];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      let sawDone = false;
      for await (const ev of client.streamChat([{ role: 'user', content: 'hi' }])) {
        if (ev.type === 'done') sawDone = true;
      }
      expect(sawDone).toBe(true);
    });

    test('yields error event on non-200 response', async () => {
      globalThis.fetch = (() =>
        Promise.resolve(
          new Response('Bad Request', { status: 400 }),
        )) as unknown as typeof fetch;

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      let errorMsg = '';
      for await (const ev of client.streamChat([{ role: 'user', content: 'hi' }])) {
        if (ev.type === 'error') errorMsg = ev.error;
      }
      expect(errorMsg).toContain('400');
    });

    test('skips malformed SSE chunks without crashing', async () => {
      const sse = [
        'data: {invalid json}',
        'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":null}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      const events: string[] = [];
      for await (const ev of client.streamChat([{ role: 'user', content: 'hi' }])) {
        if (ev.type === 'text_delta') events.push(ev.delta);
      }
      expect(events).toEqual(['ok']);
    });

    test('handles tool_call events in stream', async () => {
      const sse = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"play_pattern","arguments":""}}]},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"code\\":\\"s(\\\\\\"bd\\\\\\")\\"}"}}]},"finish_reason":null}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const client = new OpenAIClient({
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      let toolCallEnd: { id: string; name: string; arguments: string } | null = null;
      for await (const ev of client.streamChat([{ role: 'user', content: 'play' }])) {
        if (ev.type === 'tool_call_end') {
          toolCallEnd = { id: ev.id, name: ev.name, arguments: ev.arguments };
        }
      }
      expect(toolCallEnd).not.toBeNull();
      expect(toolCallEnd!.name).toBe('play_pattern');
    });
  });
});
