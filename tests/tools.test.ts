import { describe, test, expect } from 'bun:test';
import { STRUDEL_TOOLS } from '../src/llm/tools';

describe('STRUDEL_TOOLS', () => {
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
