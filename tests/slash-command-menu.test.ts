import { describe, test, expect, beforeEach } from 'bun:test';
import { SlashCommandMenu, SLASH_COMMANDS, type SlashCommand } from '../src/tui/SlashCommandMenu';

describe('SLASH_COMMANDS registry', () => {
  test('each command has name and description', () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(typeof cmd.name).toBe('string');
      expect(cmd.name.startsWith('/')).toBe(true);
      expect(typeof cmd.description).toBe('string');
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });

  test('aliases are arrays of strings when present', () => {
    for (const cmd of SLASH_COMMANDS) {
      if (cmd.alias) {
        expect(Array.isArray(cmd.alias)).toBe(true);
        for (const a of cmd.alias) {
          expect(typeof a).toBe('string');
          expect(a.startsWith('/')).toBe(true);
        }
      }
    }
  });
});

describe('SlashCommandMenu', () => {
  let menu: SlashCommandMenu;

  beforeEach(() => {
    menu = new SlashCommandMenu();
  });

  describe('initial state', () => {
    test('starts with empty filter', () => {
      expect(menu.filter).toBe('');
    });

    test('starts invisible', () => {
      expect(menu.visible).toBe(false);
    });

    test('getSelected returns null initially', () => {
      expect(menu.getSelected()).toBeNull();
    });
  });

  describe('setFilter', () => {
    test('updates the filter', () => {
      menu.setFilter('/play');
      expect(menu.filter).toBe('/play');
    });

    test('shows matching commands', () => {
      menu.setFilter('/play');
      expect(menu.visible).toBe(true);
      expect(menu.length).toBeGreaterThan(0);
    });

    test('filters to exact match', () => {
      menu.setFilter('/play');
      // Should include /play and possibly aliases like /start, /go
      expect(menu.length).toBeGreaterThanOrEqual(1);
    });

    test('empty filter hides menu', () => {
      menu.setFilter('/play');
      menu.setFilter('');
      expect(menu.visible).toBe(false);
    });

    test('whitespace-only filter lists every command', () => {
      menu.setFilter('/play');
      const all = menu.length;
      menu.setFilter('   ');
      expect(menu.length).toBeGreaterThanOrEqual(all);
      expect(menu.visible).toBe(true);
    });

    test('setInvalidate runs when the filter changes', () => {
      let calls = 0;
      menu.setInvalidate(() => {
        calls++;
      });
      menu.setFilter('/play');
      expect(calls).toBe(1);
    });

    test('no match returns empty', () => {
      menu.setFilter('/zzzznonexistent');
      expect(menu.length).toBe(0);
      expect(menu.visible).toBe(false);
    });

    test('fuzzy match works', () => {
      menu.setFilter('play');
      expect(menu.length).toBeGreaterThan(0);
    });

    test('description match works', () => {
      menu.setFilter('playback');
      expect(menu.length).toBeGreaterThan(0);
    });
  });

  describe('navigation', () => {
    test('navigateDown moves selection', () => {
      menu.setFilter('/');
      const initial = menu.length;
      expect(initial).toBeGreaterThan(1);
      // navigateDown should not throw
      menu.navigateDown();
    });

    test('navigateUp moves selection', () => {
      menu.setFilter('/');
      menu.navigateDown();
      menu.navigateUp();
    });

    test('navigation wraps around', () => {
      menu.setFilter('/');
      const len = menu.length;
      menu.navigateUp();
      for (let i = 0; i < len; i++) {
        menu.navigateDown();
      }
    });
  });

  describe('confirm / getSelected', () => {
    test('confirm makes getSelected return a command', () => {
      menu.setFilter('/play');
      menu.confirm();
      const selected = menu.getSelected();
      expect(selected).not.toBeNull();
      expect(selected!.name).toBe('/play');
    });

    test('getSelected returns null before confirm', () => {
      menu.setFilter('/play');
      expect(menu.getSelected()).toBeNull();
    });

    test('filter change resets confirmed state', () => {
      menu.setFilter('/play');
      menu.confirm();
      menu.setFilter('/stop');
      expect(menu.getSelected()).toBeNull();
    });
  });

  describe('render', () => {
    test('returns empty array when no filter', () => {
      const lines = menu.render(80);
      expect(lines).toEqual([]);
    });

    test('returns lines when filter is set', () => {
      menu.setFilter('/play');
      const lines = menu.render(80);
      expect(lines.length).toBeGreaterThan(0);
    });

    test('returns empty array when no matches', () => {
      menu.setFilter('/zzzznonexistent');
      const lines = menu.render(80);
      expect(lines).toEqual([]);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      menu.setFilter('/play');
      menu.confirm();
      menu.reset();
      expect(menu.filter).toBe('');
      expect(menu.visible).toBe(false);
      expect(menu.getSelected()).toBeNull();
    });
  });

  describe('custom commands', () => {
    test('accepts custom command list', () => {
      const custom: SlashCommand[] = [
        { name: '/test', description: 'Test command' },
      ];
      const customMenu = new SlashCommandMenu(custom);
      customMenu.setFilter('/test');
      expect(customMenu.length).toBe(1);
    });
  });
});
