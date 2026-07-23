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
    const msgs = log.getHistory();
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hello');
    expect(msgs[1].role).toBe('agent');
    expect(msgs[1].content).toBe('hi there');
  });

  test('getRecent returns last N messages', () => {
    const log = new ChatLog('test-2');
    for (let i = 0; i < 5; i++) {
      log.addMessage('user', `msg-${i}`);
    }
    const recent = log.getRecent(3);
    expect(recent.length).toBe(3);
    expect(recent[0].content).toBe('msg-2');
    expect(recent[2].content).toBe('msg-4');
  });

  test('clearMessages empties the history', () => {
    const log = new ChatLog('test-3');
    log.addMessage('user', 'hello');
    log.clearMessages();
    expect(log.getHistory().length).toBe(0);
  });

  test('export/import messages round-trips', () => {
    const log = new ChatLog('test-4');
    log.addMessage('user', 'a');
    log.addMessage('agent', 'b');
    const exported = log.exportMessages();
    const log2 = new ChatLog('test-4b');
    log2.importMessages(exported);
    expect(log2.getHistory().length).toBe(2);
    expect(log2.getHistory()[0].content).toBe('a');
  });
});
