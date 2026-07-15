/**
 * SlashCommandMenu — pi-tui Component that renders an autocomplete dropdown
 * for slash commands, filtered by current input with keyboard navigation.
 *
 *   ─────────────────────────────────────
 *    ▸ /play         Start playback
 *      /stop         Stop playback
 *      /make <desc>  Generate a pattern
 *   ─────────────────────────────────────
 */

import chalk from 'chalk';
import { Component, fuzzyFilter, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

// ---------------------------------------------------------------------------
// SlashCommand type
// ---------------------------------------------------------------------------

export interface SlashCommand {
  name: string;
  alias?: string[];
  description: string;
  args?: string;
}

// ---------------------------------------------------------------------------
// Built-in slash command registry
// ---------------------------------------------------------------------------

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/play',    description: 'Start playback',       alias: ['/start', '/go'] },
  { name: '/stop',    description: 'Stop playback',        alias: ['/pause', '/hush'] },
  { name: '/save',    description: 'Save to file' },
  { name: '/clear',   description: 'Clear chat',           alias: ['/cls'] },
  { name: '/help',    description: 'Show commands' },
  { name: '/quit',    description: 'Exit',                  alias: ['/exit', '/q'] },
  { name: '/undo',    description: 'Revert to previous' },
  { name: '/redo',    description: 'Re-apply last change' },
  { name: '/make',    description: 'Generate a pattern',   alias: ['/create'], args: '<desc>' },
  { name: '/edit',    description: 'Edit the pattern',     alias: ['/change'], args: '<instruction>' },
  { name: '/load',    description: 'Load a file',          args: '<file>' },
  { name: '/config',  description: 'Show AI config' },
  { name: '/provider', description: 'Switch AI provider' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class SlashCommandMenu implements Component {
  private _invalidate: (() => void) | null = null;

  /** Full command list (immutable reference). */
  private _commands: SlashCommand[];

  /** Current filter text (user input). */
  private _filter = '';

  /** Filtered subset matching _filter. */
  private _filtered: SlashCommand[] = [];

  /** Index of the currently selected item within _filtered. */
  private _selectedIndex = 0;

  /** Whether the menu was explicitly confirmed (enter pressed). */
  private _confirmed = false;

  constructor(commands: SlashCommand[] = SLASH_COMMANDS) {
    this._commands = commands;
    this._filtered = [...commands];
  }

  // -- Component interface --------------------------------------------------

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  /**
   * Render the slash command menu.
   *
   * Returns an empty array when there are no matching commands, so the caller
   * can simply spread the result without a visibility guard.
   *
   * @param width  - available column width
   * @param height - available row count (unused — menu is always compact)
   */
  render(width: number, _height?: number): string[] {
    if (this._filtered.length === 0 || this._filter.length === 0) return [];

    const lines: string[] = [];
    const contentWidth = Math.max(20, width - 2);

    // --- Top separator ---
    lines.push(chalk.hex(colors.border)('─'.repeat(contentWidth)));

    // --- Command rows ---
    for (let i = 0; i < this._filtered.length; i++) {
      const cmd = this._filtered[i]!;
      const isSelected = i === this._selectedIndex;

      // Selection indicator
      const indicator = isSelected ? '▸' : ' ';
      const styledIndicator = chalk.hex(isSelected ? colors.primary : colors.textMuted)(indicator);

      // Command name (+ optional args)
      const displayArgs = cmd.args ? ` ${cmd.args}` : '';
      const nameStr = cmd.name + displayArgs;
      const styledName = isSelected
        ? chalk.hex(colors.primary).bold(` ${nameStr}`)
        : chalk.hex(colors.text)(` ${nameStr}`);

      // Padding between name and description
      const nameVis = visibleWidth(nameStr) + 2; // indicator + space + name
      const pad = Math.max(1, 20 - nameVis);
      const padding = ' '.repeat(pad);

      // Description
      const styledDesc = chalk.hex(colors.textDim)(cmd.description);

      lines.push(styledIndicator + styledName + padding + styledDesc);
    }

    // --- Bottom separator ---
    lines.push(chalk.hex(colors.border)('─'.repeat(contentWidth)));

    return lines;
  }

  // -- Public API -----------------------------------------------------------

  /**
   * Update the filter text and recompute the filtered command list.
   * Resets selection to the first item when the filter changes.
   */
  setFilter(text: string): void {
    if (text === this._filter) return;

    this._filter = text;
    this._confirmed = false;
    if (text.length > 0) {
      this._recomputeFiltered();
    } else {
      this._filtered = [];
    }
    this._selectedIndex = Math.min(this._selectedIndex, Math.max(0, this._filtered.length - 1));
    this.invalidate();
  }

  /**
   * Return the currently selected command, or null if the menu is empty or
   * was not explicitly confirmed.
   */
  getSelected(): SlashCommand | null {
    if (!this._confirmed || this._filtered.length === 0) return null;
    return this._filtered[this._selectedIndex] ?? null;
  }

  /**
   * Move selection up by one row. Wraps to the bottom.
   */
  navigateUp(): void {
    if (this._filtered.length === 0) return;
    this._selectedIndex = (this._selectedIndex - 1 + this._filtered.length) % this._filtered.length;
    this._confirmed = false;
    this.invalidate();
  }

  /**
   * Move selection down by one row. Wraps to the top.
   */
  navigateDown(): void {
    if (this._filtered.length === 0) return;
    this._selectedIndex = (this._selectedIndex + 1) % this._filtered.length;
    this._confirmed = false;
    this.invalidate();
  }

  /**
   * Confirm the current selection. After calling this, getSelected() will
   * return the chosen command until the filter changes or the menu is reset.
   */
  confirm(): void {
    if (this._filtered.length === 0) return;
    this._confirmed = true;
    this.invalidate();
  }

  /** Whether the menu has any matching commands to display. */
  get visible(): boolean {
    return this._filtered.length > 0 && this._filter.length > 0;
  }

  /** The number of filtered commands. */
  get length(): number {
    return this._filtered.length;
  }

  /** The current filter text. */
  get filter(): string {
    return this._filter;
  }

  /** Reset the menu to its initial state. */
  reset(): void {
    this._filter = '';
    this._filtered = [...this._commands];
    this._selectedIndex = 0;
    this._confirmed = false;
    this.invalidate();
  }

  // -- Internal -------------------------------------------------------------

  invalidate(): void {
    this._invalidate?.();
  }

  /**
   * Recompute the filtered command list using pi-tui's fuzzyFilter.
   *
   * Falls back to prefix + alias + description matching when fuzzyFilter
   * returns nothing (exact-strategy fallback).
   */
  private _recomputeFiltered(): void {
    const query = this._filter.trim();

    if (query.length === 0) {
      this._filtered = [...this._commands];
      return;
    }

    // Primary: fuzzy filter against name + description + aliases
    const fuzzyResults = fuzzyFilter(
      this._commands,
      query,
      (cmd) => [cmd.name, cmd.description, ...(cmd.alias ?? [])].join(' '),
    );

    if (fuzzyResults.length > 0) {
      this._filtered = fuzzyResults;
      return;
    }

    // Fallback: prefix match on name/alias, substring on description
    const lower = query.toLowerCase();
    this._filtered = this._commands.filter((cmd) => {
      if (cmd.name.startsWith(lower)) return true;
      if (cmd.alias?.some((a) => a.startsWith(lower))) return true;
      if (cmd.description.toLowerCase().includes(lower)) return true;
      return false;
    });
  }
}
