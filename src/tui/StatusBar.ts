import chalk from 'chalk';
import { Component, visibleWidth, truncateToWidth } from '@earendil-works/pi-tui';
import { colors, BRAILLE_DOTS } from './theme.js';
import { VERSION } from '../version.js';

const TOOLBAR_TIPS: string[] = [
  'Send /help for all commands',
  'ctrl+p play/stop · ctrl+s save',
  '/make <desc> to generate a pattern',
  '/edit <instruction> to modify pattern',
  '/config to set up AI provider',
  '/undo · /redo to navigate history',
  '/load <file> to load a pattern file',
  'ctrl+l to clear chat history',
];

const SETUP_TIPS: string[] = [
  'No AI provider configured — send /config to set up',
  'Send /config to configure API key and model',
  'Supported: OpenAI · DeepSeek · Moonshot · Qwen · OpenRouter',
  ...TOOLBAR_TIPS,
];

const TIP_INTERVAL_MS = 10_000;

export interface StatusBarProps {
  playing: boolean;
  bpm: number;
  patternName: string;
  mode: 'llm' | 'keyword';
  streaming?: boolean;
  model?: string;
}

export class StatusBar implements Component {
  private _invalidate: (() => void) | null = null;
  private _props: StatusBarProps;
  private _spinTick = 0;
  private _tipIdx = 0;
  private _lastTipTime = Date.now();

  constructor(props: StatusBarProps) {
    this._props = { streaming: false, ...props };
  }

  update(props: Partial<StatusBarProps>): void {
    Object.assign(this._props, props);
    this.invalidate();
  }

  invalidate(): void {
    this._invalidate?.();
  }

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number): string[] {
    const { playing, bpm, patternName, mode, streaming, model } = this._props;

    if (streaming) {
      this._spinTick++;
    }

    const now = Date.now();
    if (now - this._lastTipTime >= TIP_INTERVAL_MS) {
      this._tipIdx++;
      this._lastTipTime = now;
    }

    const isConfigured = mode === 'llm';
    const tips = isConfigured ? TOOLBAR_TIPS : SETUP_TIPS;
    const tip = tips[this._tipIdx % tips.length]!;

    const title = `strudel-tui v${VERSION}`;
    const styledTitle = chalk.hex(colors.primary).bold(title);
    const styledTip = chalk.hex(colors.textMuted)(tip);
    const titleVis = visibleWidth(title);
    const tipVis = visibleWidth(tip);
    const gap = Math.max(2, width - titleVis - tipVis);
    const line1Raw = styledTitle + ' '.repeat(gap) + styledTip;
    const line1 = truncateToWidth(line1Raw, width);

    const stateLabel = playing ? 'PLAYING' : 'STOPPED';
    const stateColor = playing ? colors.playing : colors.stopped;
    const stateStyled = streaming
      ? chalk.hex(colors.primary)(BRAILLE_DOTS[this._spinTick % BRAILLE_DOTS.length]!)
      : chalk.hex(stateColor).bold(stateLabel);

    const modeLabel = isConfigured ? '◆ AI' : '◇ keyword';
    const modeColor = isConfigured ? colors.success : colors.textMuted;

    const sep = chalk.hex(colors.textMuted)('  ·  ');
    const bpmStyled = chalk.hex(colors.bpm)(`${bpm} BPM`);
    const patternStyled = chalk.hex(colors.pattern)(patternName);
    const modeStyled = chalk.hex(modeColor)(modeLabel);

    const modelText = (isConfigured && model)
      ? chalk.hex(colors.textDim)(model)
      : chalk.hex(colors.warning)('model not set — /config');

    const line2Raw = stateStyled + sep + bpmStyled + sep + patternStyled + sep + modeStyled + sep + modelText;
    const line2 = truncateToWidth(line2Raw, width);

    const line3 = chalk.hex(colors.border)('─'.repeat(width));

    return [line1, line2, line3];
  }
}
