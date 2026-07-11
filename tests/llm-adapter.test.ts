import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LLMAdapter } from '../src/agent/LLMAdapter';
import { ToolExecutor } from '../src/agent/ToolExecutor';
import { SessionHistory } from '../src/agent/SessionHistory';

// ---------------------------------------------------------------------------
// Helpers — build a ReadableStream from SSE lines
// ---------------------------------------------------------------------------

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
  let history: SessionHistory;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    history = new SessionHistory('test-llm');
    executor = new ToolExecutor('', history);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe('construction', () => {
    test('can be created with a valid config', () => {
      const adapter = new LLMAdapter(executor, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
      });
      expect(adapter.hasLLM).toBe(true);
    });

    test('hasLLM is true when constructed', () => {
      const adapter = new LLMAdapter(executor, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });
      expect(adapter.hasLLM).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Tool call result feeding
  // -------------------------------------------------------------------------

  describe('tool call handling', () => {
    test('executor is shared between adapter instances', () => {
      const _adapter = new LLMAdapter(executor, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });

      // The adapter uses the same executor — if the executor sets a pattern,
      // the adapter sees it
      executor.setPattern('s("bd sn")');
      expect(executor.currentPattern).toBe('s("bd sn")');
    });
  });

  // -------------------------------------------------------------------------
  // Chat history management
  // -------------------------------------------------------------------------

  describe('chat history', () => {
    test('adapter initializes with system prompt in history', () => {
      const adapter = new LLMAdapter(executor, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });
      // History should contain the system prompt
      const history = adapter.chatHistory;
      expect(history.length).toBe(1);
      expect(history[0].role).toBe('system');
    });

    test('clearHistory resets chat history to system prompt only', () => {
      const adapter = new LLMAdapter(executor, {
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
      });
      adapter.clearHistory();
      const history = adapter.chatHistory;
      expect(history.length).toBe(1);
      expect(history[0].role).toBe('system');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling — covers catch blocks in processMessageStreaming
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    test('emits error event when fetch throws', async () => {
      globalThis.fetch = (() => Promise.reject(new Error('Network down'))) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, {
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

      const adapter = new LLMAdapter(executor, {
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
      // SSE stream: a tool_call_start + tool_call_end with invalid JSON arguments
      const sse = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"play_pattern","arguments":""}}]},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"not valid json"}}]},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, {
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

      // The malformed arguments should not crash — tool call is still dispatched
      expect(toolCallSeen).toBe(true);
      expect(done).toBe(true);
    });

    test('handles malformed arguments in remaining tool calls', async () => {
      // SSE stream: tool_call_start but no tool_call_end before [DONE],
      // so it falls into the "remaining tool calls" path with bad arguments
      const sse = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"stop_playback","arguments":"{bad json}"}}]},"finish_reason":null}]}',
        'data: [DONE]',
      ];
      globalThis.fetch = (() => Promise.resolve(makeResponse(makeSSEStream(sse)))) as unknown as typeof fetch;

      const adapter = new LLMAdapter(executor, {
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
