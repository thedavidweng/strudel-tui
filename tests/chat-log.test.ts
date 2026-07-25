import { describe, test, expect } from 'bun:test';
import { ChatLog } from '../src/session/ChatLog';

describe('ChatLog', () => {
  test('generates a session id when none provided', () => {
    const log = new ChatLog();
    expect(log.sessionId).toBeTruthy();
    expect(log.sessionId.startsWith('session-')).toBe(true);
  });

  test('uses the provided session id', () => {
    const log = new ChatLog('my-session');
    expect(log.sessionId).toBe('my-session');
  });

  test('addMessage stores messages', () => {
    const log = new ChatLog('test-1');
    log.addMessage('user', 'hello');
    log.addMessage('agent', 'hi there');
    const msgs = log.exportMessages();
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hello');
    expect(msgs[1].role).toBe('agent');
    expect(msgs[1].content).toBe('hi there');
  });

  test('clearMessages empties the history', () => {
    const log = new ChatLog('test-3');
    log.addMessage('user', 'hello');
    log.clearMessages();
    expect(log.exportMessages().length).toBe(0);
  });
});
