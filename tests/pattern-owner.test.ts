import { describe, test, expect } from 'bun:test';
import { PatternOwner, applyEditHeuristic } from '../src/pattern/PatternOwner';

describe('PatternOwner', () => {
  describe('pattern state', () => {
    test('starts empty by default', () => {
      const po = new PatternOwner();
      expect(po.currentPattern).toBe('');
    });

    test('starts with the initial pattern', () => {
      const po = new PatternOwner('s("bd sn")');
      expect(po.currentPattern).toBe('s("bd sn")');
    });

    test('set updates currentPattern', () => {
      const po = new PatternOwner('');
      po.set('s("bd sn")');
      expect(po.currentPattern).toBe('s("bd sn")');
    });
  });

  describe('undo/redo', () => {
    test('undo returns undefined with no history', () => {
      const po = new PatternOwner('only');
      expect(po.undo()).toBeUndefined();
    });

    test('undo reverts to the previous pattern', () => {
      const po = new PatternOwner('first');
      po.set('second');
      expect(po.undo()).toBe('first');
      expect(po.currentPattern).toBe('first');
    });

    test('redo re-applies after undo', () => {
      const po = new PatternOwner('first');
      po.set('second');
      po.undo();
      expect(po.redo()).toBe('second');
      expect(po.currentPattern).toBe('second');
    });

    test('redo returns undefined at the latest version', () => {
      const po = new PatternOwner('only');
      expect(po.redo()).toBeUndefined();
    });

    test('set after undo discards forward history', () => {
      const po = new PatternOwner('a');
      po.set('b');
      po.set('c');
      po.undo();
      po.set('d');
      expect(po.currentPattern).toBe('d');
      expect(po.redo()).toBeUndefined();
    });

    test('canUndo and canRedo reflect state', () => {
      const po = new PatternOwner();
      expect(po.canUndo()).toBe(false);
      expect(po.canRedo()).toBe(false);

      po.set('a');
      expect(po.canUndo()).toBe(false);
      expect(po.canRedo()).toBe(false);

      po.set('b');
      expect(po.canUndo()).toBe(true);
      expect(po.canRedo()).toBe(false);

      po.undo();
      expect(po.canUndo()).toBe(false);
      expect(po.canRedo()).toBe(true);
    });

    test('stackSize tracks the stack', () => {
      const po = new PatternOwner();
      expect(po.stackSize()).toBe(0);
      po.set('a');
      expect(po.stackSize()).toBe(1);
      po.set('b');
      expect(po.stackSize()).toBe(2);
    });
  });

  describe('applyEdit', () => {
    test('faster appends .fast(2)', () => {
      const po = new PatternOwner('s("bd sn")');
      expect(po.applyEdit('faster')).toBe('s("bd sn").fast(2)');
    });

    test('slower appends .slow(2)', () => {
      const po = new PatternOwner('s("bd sn")');
      expect(po.applyEdit('slower')).toBe('s("bd sn").slow(2)');
    });

    test('reverb appends .room(0.5)', () => {
      const po = new PatternOwner('s("bd sn")');
      expect(po.applyEdit('add reverb')).toBe('s("bd sn").room(0.5)');
    });

    test('remove last removes the last transform', () => {
      const po = new PatternOwner('s("bd sn").fast(2)');
      expect(po.applyEdit('remove last')).toBe('s("bd sn")');
    });

    test('unrecognized instruction returns pattern unchanged', () => {
      const po = new PatternOwner('s("bd sn")');
      expect(po.applyEdit('make it purple')).toBe('s("bd sn")');
    });

    test('does not mutate currentPattern', () => {
      const po = new PatternOwner('s("bd sn")');
      po.applyEdit('faster');
      expect(po.currentPattern).toBe('s("bd sn")');
    });
  });

  describe('applyEditHeuristic (pure)', () => {
    test('faster on a .slow pattern converts to .fast', () => {
      expect(applyEditHeuristic('s("bd").slow(2)', 'faster')).toBe('s("bd").fast(2)');
    });

    test('remove last on a bare pattern returns it unchanged', () => {
      expect(applyEditHeuristic('s("bd sn")', 'remove last')).toBe('s("bd sn")');
    });
  });

  describe('export/import stack', () => {
    test('exportStack returns the stack and index', () => {
      const po = new PatternOwner('a');
      po.set('b');
      const { stack, index } = po.exportStack();
      expect(stack.length).toBe(2);
      expect(index).toBe(1);
    });
  });
});
