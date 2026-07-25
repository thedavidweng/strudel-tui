import chalk from 'chalk';
import { Component, fuzzyFilter, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

export interface SlashCommand {
  name: string;
  alias?: string[];
  description: string;
  args?: string;
}

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

export class SlashCommandMenu implements Component {
  private _invalidate: (() => void) | null = null;

  private _commands: SlashCommand[];

  private _filter = '';

  private _filtered: SlashCommand[] = [];

  private _selectedIndex = 0;

  private _confirmed = false;

  constructor(commands: SlashCommand[] = SLASH_COMMANDS) {
    this._commands = commands;
    this._filtered = [...commands];
  }

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number, _height?: number): string[] {
    if (this._filtered.length === 0 || this._filter.length === 0) return [];

    const lines: string[] = [];
    const contentWidth = Math.max(20, width - 2);

    lines.push(chalk.hex(colors.border)('─'.repeat(contentWidth)));

    for (let i = 0; i < this._filtered.length; i++) {
      const cmd = this._filtered[i]!;
      const isSelected = i === this._selectedIndex;

      const indicator = isSelected ? '▸' : ' ';
      const styledIndicator = chalk.hex(isSelected ? colors.primary : colors.textMuted)(indicator);

      const displayArgs = cmd.args ? ` ${cmd.args}` : '';
      const nameStr = cmd.name + displayArgs;
      const styledName = isSelected
        ? chalk.hex(colors.primary).bold(` ${nameStr}`)
        : chalk.hex(colors.text)(` ${nameStr}`);

      const nameVis = visibleWidth(nameStr) + 2; // indicator + space + name
      const pad = Math.max(1, 20 - nameVis);
      const padding = ' '.repeat(pad);

      const styledDesc = chalk.hex(colors.textDim)(cmd.description);

      lines.push(styledIndicator + styledName + padding + styledDesc);
    }

    lines.push(chalk.hex(colors.border)('─'.repeat(contentWidth)));

    return lines;
  }

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

  getSelected(): SlashCommand | null {
    if (!this._confirmed || this._filtered.length === 0) return null;
    return this._filtered[this._selectedIndex] ?? null;
  }

  navigateUp(): void {
    if (this._filtered.length === 0) return;
    this._selectedIndex = (this._selectedIndex - 1 + this._filtered.length) % this._filtered.length;
    this._confirmed = false;
    this.invalidate();
  }

  navigateDown(): void {
    if (this._filtered.length === 0) return;
    this._selectedIndex = (this._selectedIndex + 1) % this._filtered.length;
    this._confirmed = false;
    this.invalidate();
  }

  confirm(): void {
    if (this._filtered.length === 0) return;
    this._confirmed = true;
    this.invalidate();
  }

  get visible(): boolean {
    return this._filtered.length > 0 && this._filter.length > 0;
  }

  get length(): number {
    return this._filtered.length;
  }

  get filter(): string {
    return this._filter;
  }

  reset(): void {
    this._filter = '';
    this._filtered = [...this._commands];
    this._selectedIndex = 0;
    this._confirmed = false;
    this.invalidate();
  }

  invalidate(): void {
    this._invalidate?.();
  }

  private _recomputeFiltered(): void {
    const query = this._filter.trim();

    if (query.length === 0) {
      this._filtered = [...this._commands];
      return;
    }

    const fuzzyResults = fuzzyFilter(
      this._commands,
      query,
      (cmd) => [cmd.name, cmd.description, ...(cmd.alias ?? [])].join(' '),
    );

    if (fuzzyResults.length > 0) {
      this._filtered = fuzzyResults;
      return;
    }

    const lower = query.toLowerCase();
    this._filtered = this._commands.filter((cmd) => {
      if (cmd.name.startsWith(lower)) return true;
      if (cmd.alias?.some((a) => a.startsWith(lower))) return true;
      if (cmd.description.toLowerCase().includes(lower)) return true;
      return false;
    });
  }
}
