import { describe, test, expect } from 'bun:test';
import { STRUDEL_TOOLS, SYSTEM_PROMPT } from '../src/llm/tools';

describe('STRUDEL_TOOLS', () => {
  test('is an array of 10 tool definitions', () => {
    expect(Array.isArray(STRUDEL_TOOLS)).toBe(true);
    expect(STRUDEL_TOOLS).toHaveLength(10);
  });

  test('each tool has correct top-level shape', () => {
    for (const tool of STRUDEL_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function).toBeDefined();
      expect(typeof tool.function.name).toBe('string');
      expect(typeof tool.function.description).toBe('string');
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.properties).toBeDefined();
      expect(Array.isArray(tool.function.parameters.required)).toBe(true);
    }
  });

  test('all tool names are unique', () => {
    const names = STRUDEL_TOOLS.map(t => t.function.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('expected tool names are present', () => {
    const names = STRUDEL_TOOLS.map(t => t.function.name);
    const expected = [
      'play_pattern', 'stop_playback', 'validate_pattern', 'generate_pattern',
      'edit_pattern', 'set_pattern', 'get_pattern_info', 'list_patterns',
      'load_pattern', 'save_pattern',
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  test('required params match declared properties', () => {
    for (const tool of STRUDEL_TOOLS) {
      const { properties, required } = tool.function.parameters;
      for (const req of required) {
        expect(properties).toHaveProperty(req);
      }
    }
  });

  test('play_pattern has optional code param', () => {
    const tool = STRUDEL_TOOLS.find(t => t.function.name === 'play_pattern')!;
    expect(tool.function.parameters.properties).toHaveProperty('code');
    expect(tool.function.parameters.required).toHaveLength(0);
  });

  test('validate_pattern requires code', () => {
    const tool = STRUDEL_TOOLS.find(t => t.function.name === 'validate_pattern')!;
    expect(tool.function.parameters.required).toContain('code');
  });

  test('stop_playback has no required params', () => {
    const tool = STRUDEL_TOOLS.find(t => t.function.name === 'stop_playback')!;
    expect(tool.function.parameters.required).toHaveLength(0);
  });
});

describe('SYSTEM_PROMPT', () => {
  test('is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  test('references all tool names', () => {
    for (const tool of STRUDEL_TOOLS) {
      expect(SYSTEM_PROMPT).toContain(tool.function.name);
    }
  });

  test('contains core rules section', () => {
    expect(SYSTEM_PROMPT).toContain('Core Rules');
  });

  test('contains mini-notation reference', () => {
    expect(SYSTEM_PROMPT).toContain('Mini-Notation');
  });

  test('contains example interactions', () => {
    expect(SYSTEM_PROMPT).toContain('Example Interactions');
  });
});
