/**
 * Welcome — pi-tui Component that renders a bordered welcome box.
 *
 * Matches Kimi Code's welcome screen style:
 *   ╭──────────────────────────────────╮
 *   │                                  │
 *   │  ▐█▛█▌ strudel-tui              │
 *   │  ▐███▌ Terminal live coding      │
 *   │                                  │
 *   │  Model:     gpt-4o               │
 *   │  Mode:      ◆ AI                │
 *   │  Version:   0.1.0               │
 *   │                                  │
 *  ╰──────────────────────────────────╯
 */

import chalk from 'chalk';
import { Component, visibleWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

export interface WelcomeProps {
  model?: string;
  mode: 'llm' | 'keyword';
  version: string;
}

export class Welcome implements Component {
  private _invalidate: (() => void) | null = null;
  private readonly props: WelcomeProps;

  constructor(props: WelcomeProps) {
    this.props = props;
  }

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number): string[] {
    const { model, mode, version } = this.props;
    const lines: string[] = [];
    const innerWidth = Math.max(20, width - 4);

    // Top blank line
    lines.push('');

    // Top border
    lines.push(chalk.hex(colors.primary)('╭' + '─'.repeat(innerWidth) + '╮'));

    // Empty padding
    lines.push(chalk.hex(colors.primary)('│') + ' '.repeat(innerWidth) + chalk.hex(colors.primary)('│'));

    // Logo + title
    const logo1 = chalk.hex(colors.primary).bold('▐█▛█▌');
    const logo2 = chalk.hex(colors.primary).bold('▐███▌');
    const titleLine = logo1 + '  ' + chalk.hex(colors.primary).bold('strudel-tui');
    const subtitleLine = logo2 + '  ' + chalk.hex(colors.textDim)('Terminal live coding for Strudel');
    lines.push(this._contentLine(titleLine, innerWidth));
    lines.push(this._contentLine(subtitleLine, innerWidth));

    // Empty padding
    lines.push(chalk.hex(colors.primary)('│') + ' '.repeat(innerWidth) + chalk.hex(colors.primary)('│'));

    // Info lines
    const isConfigured = mode === 'llm';
    const modelText = (isConfigured && model)
      ? model
      : chalk.hex(colors.warning)('not set — send /config');
    const modeText = isConfigured
      ? chalk.hex(colors.success)('◆ AI')
      : chalk.hex(colors.textMuted)('◇ keyword');

    lines.push(this._infoLine('Model', String(modelText), innerWidth));
    lines.push(this._infoLine('Mode', String(modeText), innerWidth));
    lines.push(this._infoLine('Version', version, innerWidth));

    // Empty padding
    lines.push(chalk.hex(colors.primary)('│') + ' '.repeat(innerWidth) + chalk.hex(colors.primary)('│'));

    // Bottom border
    lines.push(chalk.hex(colors.primary)('╰' + '─'.repeat(innerWidth) + '╯'));

    // Bottom blank line
    lines.push('');

    return lines;
  }

  invalidate(): void {
    this._invalidate?.();
  }

  private _contentLine(content: string, innerWidth: number): string {
    const vis = visibleWidth(content);
    const pad = Math.max(0, innerWidth - vis - 4); // 4 = 2 left + 2 right padding
    return chalk.hex(colors.primary)('│') + '  ' + content + ' '.repeat(pad + 2) + chalk.hex(colors.primary)('│');
  }

  private _infoLine(label: string, value: string, innerWidth: number): string {
    const labelText = chalk.hex(colors.textDim).bold(`  ${label.padEnd(10)}`);
    const valueStr = value;
    const full = labelText + valueStr;
    const vis = visibleWidth(labelText) + visibleWidth(valueStr);
    const pad = Math.max(0, innerWidth - vis - 2); // 2 for right padding
    return chalk.hex(colors.primary)('│') + full + ' '.repeat(pad + 2) + chalk.hex(colors.primary)('│');
  }
}

export default Welcome;
