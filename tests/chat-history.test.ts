import { describe, test, expect } from 'bun:test';
import { ChatHistory } from '../src/llm/ChatHistory';

describe('ChatHistory', () => {
  test('starts with just the system prompt', () => {
    const chat = new ChatHistory();
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe('system');
  });

  test('addUser appends a user message', () => {
    const chat = new ChatHistory();
    chat.addUser('hello');
    expect(chat.messages.length).toBe(2);
    expect(chat.messages[1].role).toBe('user');
    expect(chat.messages[1].content).toBe('hello');
  });

  test('addToolCall appends paired assistant + tool messages', () => {
    const chat = new ChatHistory();
    chat.addUser('play');
    chat.addToolCall('call_1', 'play_pattern', '{"code":"s(\\"bd\\")"}', 'Pattern set');
    const msgs = chat.messages;
    expect(msgs.length).toBe(4);
    expect(msgs[2].role).toBe('assistant');
    expect(msgs[2].tool_calls?.[0].id).toBe('call_1');
    expect(msgs[3].role).toBe('tool');
    expect(msgs[3].tool_call_id).toBe('call_1');
    expect(msgs[3].content).toBe('Pattern set');
  });

  test('addAssistant appends an assistant text message', () => {
    const chat = new ChatHistory();
    chat.addUser('hi');
    chat.addAssistant('hello there');
    const msgs = chat.messages;
    expect(msgs[2].role).toBe('assistant');
    expect(msgs[2].content).toBe('hello there');
  });

  test('clear resets to system prompt only', () => {
    const chat = new ChatHistory();
    chat.addUser('hi');
    chat.addAssistant('hello');
    chat.clear();
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe('system');
  });

  describe('forRequest', () => {
    test('appends context suffix to the last user message', () => {
      const chat = new ChatHistory();
      chat.addUser('make a beat');
      const req = chat.forRequest('\n\nCurrent pattern: X');
      expect(req[1].content).toBe('make a beat\n\nCurrent pattern: X');
      // stored history is not mutated
      expect(chat.messages[1].content).toBe('make a beat');
    });

    test('returns messages unchanged when last message is not user', () => {
      const chat = new ChatHistory();
      chat.addUser('play');
      chat.addToolCall('c1', 'stop_playback', '{}', 'stopped');
      const req = chat.forRequest('suffix');
      // last is a tool message — suffix is not appended
      expect(req[req.length - 1].content).toBe('stopped');
    });

    test('returns a fresh array (does not expose internals)', () => {
      const chat = new ChatHistory();
      chat.addUser('hi');
      const req = chat.forRequest('');
      req.push({ role: 'user', content: 'mutation' });
      expect(chat.messages.length).toBe(2);
    });

    test('empty suffix on user message returns copy without modification', () => {
      const chat = new ChatHistory();
      chat.addUser('hi');
      const req = chat.forRequest('');
      expect(req[1].content).toBe('hi');
    });
  });
});
