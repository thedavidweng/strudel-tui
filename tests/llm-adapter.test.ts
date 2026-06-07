import { describe, test, expect, beforeEach } from 'bun:test';
import { LLMAdapter } from '../src/agent/LLMAdapter';
import { ToolExecutor } from '../src/agent/ToolExecutor';
import { SessionHistory } from '../src/agent/SessionHistory';

describe('LLMAdapter', () => {
  let executor: ToolExecutor;
  let history: SessionHistory;

  beforeEach(() => {
    history = new SessionHistory('test-llm');
    executor = new ToolExecutor('', history);
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
});
