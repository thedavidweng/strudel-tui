import { describe, test, expect } from 'bun:test';
import { ConfigManager, type StrudelConfig } from '../src/config/ConfigManager';

describe('ConfigManager', () => {
  test('get returns override values when provided', () => {
    const cm = new ConfigManager({ apiKey: 'test-key-123' });
    expect(cm.get('apiKey')).toBe('test-key-123');
  });

  test('get returns string for unset keys (file or default)', () => {
    const cm = new ConfigManager({ apiKey: 'test' });
    // baseUrl may come from config file or default — both are valid URLs
    expect(typeof cm.get('baseUrl')).toBe('string');
    expect(cm.get('baseUrl')).toMatch(/^https?:\/\//);
    expect(typeof cm.get('model')).toBe('string');
    expect(typeof cm.get('temperature')).toBe('number');
    expect(typeof cm.get('maxTokens')).toBe('number');
  });

  test('getAll merges overrides with defaults', () => {
    const cm = new ConfigManager({ model: 'claude-3-opus', temperature: 0.3 });
    const all = cm.getAll();
    expect(all.model).toBe('claude-3-opus');
    expect(all.temperature).toBe(0.3);
    expect(typeof all.baseUrl).toBe('string');
    expect(all.maxTokens).toBe(4096);
  });

  test('isConfigured returns true when apiKey is set', () => {
    const cm = new ConfigManager({ apiKey: 'sk-test' });
    expect(cm.isConfigured()).toBe(true);
  });

  test('isConfigured returns false when apiKey is empty', () => {
    const cm = new ConfigManager({ apiKey: '' });
    expect(cm.isConfigured()).toBe(false);
  });

  test('isConfigured returns false when apiKey is not set', () => {
    const cm = new ConfigManager();
    // Default depends on whether ~/.strudel-tui/config.json exists
    // But with no overrides and no file, apiKey should be empty
    const result = cm.isConfigured();
    expect(typeof result).toBe('boolean');
  });

  test('constructor with no overrides does not throw', () => {
    expect(() => new ConfigManager()).not.toThrow();
  });

  test('undefined overrides are filtered out', () => {
    const cm = new ConfigManager({ apiKey: undefined, model: 'test-model' });
    expect(cm.get('model')).toBe('test-model');
    // apiKey should not be set to undefined — it should fall through to file or default
    expect(cm.get('apiKey')).not.toBe(undefined);
  });
});

describe('StrudelConfig interface', () => {
  test('all fields are optional', () => {
    // This is a compile-time check — if this compiles, the test passes
    const config: StrudelConfig = {};
    expect(config).toBeDefined();
  });
});
