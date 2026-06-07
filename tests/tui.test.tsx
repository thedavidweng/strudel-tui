import { describe, test, expect } from 'bun:test';
import React from 'react';
import { renderToString } from 'ink';
import StatusBar from '../src/tui/StatusBar';
import PatternEditor from '../src/tui/PatternEditor';
import InputBox from '../src/tui/InputBox';
import MessageHistory from '../src/tui/MessageHistory';
import type { Message } from '../src/tui/MessageHistory';

describe('StatusBar', () => {
  test('renders stopped state without crashing', () => {
    const output = renderToString(
      <StatusBar playing={false} bpm={130} patternName="untitled" />,
    );
    expect(typeof output).toBe('string');
    expect(output).toContain('STOPPED');
    expect(output).toContain('130');
    expect(output).toContain('untitled');
  });

  test('renders playing state', () => {
    const output = renderToString(
      <StatusBar playing={true} bpm={120} patternName="my-pattern" />,
    );
    expect(output).toContain('PLAYING');
    expect(output).toContain('120');
    expect(output).toContain('my-pattern');
  });

  test('includes keyboard shortcut hints', () => {
    const output = renderToString(
      <StatusBar playing={false} bpm={130} patternName="test" />,
    );
    expect(output).toContain('Ctrl+P');
    expect(output).toContain('Ctrl+S');
    expect(output).toContain('Ctrl+C');
  });
});

describe('PatternEditor', () => {
  test('renders single-line code', () => {
    const output = renderToString(<PatternEditor code='s("bd sn")' />);
    expect(output).toContain('s("bd sn")');
    expect(output).toContain('1');
  });

  test('renders multi-line code with line numbers', () => {
    const code = '// comment\ns("bd*4");\ns("hh*8");';
    const output = renderToString(<PatternEditor code={code} />);
    expect(output).toContain('// comment');
    expect(output).toContain('s("bd*4")');
    expect(output).toContain('s("hh*8")');
    // Should have line numbers
    expect(output).toContain('1');
    expect(output).toContain('2');
    expect(output).toContain('3');
  });
});

describe('InputBox', () => {
  test('renders with empty value', () => {
    const output = renderToString(<InputBox value="" />);
    expect(output).toContain('>');
  });

  test('renders with a value', () => {
    const output = renderToString(<InputBox value="hello world" />);
    expect(output).toContain('hello world');
    expect(output).toContain('>');
  });
});

describe('MessageHistory', () => {
  test('renders empty state', () => {
    const output = renderToString(<MessageHistory messages={[]} height={10} />);
    expect(output).toBeTruthy();
  });

  test('renders messages', () => {
    const messages: Message[] = [
      { type: 'user', content: 'play' },
      { type: 'agent', content: 'Starting playback...' },
      { type: 'system', content: 'Ready' },
      { type: 'error', content: 'Something broke' },
    ];
    const output = renderToString(<MessageHistory messages={messages} height={20} />);
    expect(output).toContain('play');
    expect(output).toContain('Starting playback');
    expect(output).toContain('Ready');
    expect(output).toContain('Something broke');
  });
});

describe('App module', () => {
  test('imports without throwing', async () => {
    const mod = await import('../src/tui/App');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
