import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LLMAdapter } from '../src/agent/LLMAdapter';
import { ToolExecutor } from '../src/agent/ToolExecutor';
import { PatternOwner } from '../src/pattern/PatternOwner';

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

describe('LLMAdapter', () => {
  let executor: ToolExecutor;
  let patterns: PatternOwner;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    patterns = new PatternOwner('');
    executor = new ToolExecutor(patterns);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('construction', () => {
    test('can be created with a valid config', () => {
      const adapter = new LLMAdapter(executor, patterns, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('tool call handling', () => {
    test('executor is shared between adapter instances', () => {
      const _adapter = new LLMAdapter(executor, patterns, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      patterns.set('s("bd sn")');
      expect(patterns.currentPattern).toBe('s("bd sn")');
    });
  });

  describe('error handling', () => {
    test('emits error event when fetch throws', async () => {
      globalThis.fetch = (() => Promise.reject(new Error('Network down'))) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, patterns, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      const events: string[] = [];
      await adapter.processMessageStreaming('hello', '', (ev) => {
        if (ev.type === 'error') events.push(ev.error);
        if (ev.type === 'done' && ev.response.action === 'error') events.push(ev.response.error!);
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toContain('Network down');
    });

    test('emits error event when fetch throws non-Error value', async () => {
      globalThis.fetch = (() => Promise.reject('string error')) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, patterns, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      let errorMsg = '';
      await adapter.processMessageStreaming('hello', '', (ev) => {
        if (ev.type === 'error') errorMsg = ev.error;
      });

      expect(errorMsg).toContain('string error');
    });

    test('handles malformed tool_call_end arguments gracefully', async () => {
      const sse = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"play_pattern","arguments":""}}]},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"not valid json"}}]},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, patterns, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      let toolCallSeen = false;
      let done = false;
      await adapter.processMessageStreaming('play something', '', (ev) => {
        if (ev.type === 'tool_call') toolCallSeen = true;
        if (ev.type === 'done') done = true;
      });

      expect(toolCallSeen).toBe(true);
      expect(done).toBe(true);
    });

    test('handles malformed arguments in remaining tool calls', async () => {
      const sse = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"stop_playback","arguments":"{bad json}"}}]},"finish_reason":null}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, patterns, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      let toolCallSeen = false;
      let done = false;
      await adapter.processMessageStreaming('stop', '', (ev) => {
        if (ev.type === 'tool_call') toolCallSeen = true;
        if (ev.type === 'done') done = true;
      });

      expect(toolCallSeen).toBe(true);
      expect(done).toBe(true);
    });
  });
});
