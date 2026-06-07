/**
 * StatusBar — pi-tui Component that renders the header area.
 *
 *   Line 1: "strudel-tui v0.1.0" (left)  |  rotating tip (right)
 *   Line 2: status info (state, bpm, pattern, mode, model)
 *   Line 3: separator ─────────────────────────────
 */

import chalk from 'chalk';
import { Component, visibleWidth, truncateToWidth } from '@earendil-works/pi-tui';
import { colors } from './theme.js';

// ---------------------------------------------------------------------------
// Braille spinner (text-based, no React hooks)
// ---------------------------------------------------------------------------

const BRAILLE_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Returns the current braille frame character for a given tick. */
function brailleFrame(tick: number): string {
  return BRAILLE_DOTS[tick % BRAILLE_DOTS.length]!;
}

// ---------------------------------------------------------------------------
// Rotating tips — weighted round-robin
// ---------------------------------------------------------------------------

interface ToolbarTip {
  text: string;
  priority?: number;
}

const TOOLBAR_TIPS: ToolbarTip[] = [
  { text: 'Send /help for all commands', priority: 3 },
  { text: 'ctrl+p play/stop · ctrl+s save', priority: 2 },
  { text: '/make <desc> to generate a pattern', priority: 2 },
  { text: '/edit <instruction> to modify pattern', priority: 2 },
  { text: '/config to set up AI provider', priority: 2 },
  { text: '/undo · /redo to navigate history', priority: 1 },
  { text: '/load <file> to load a pattern file', priority: 1 },
  { text: 'ctrl+l to clear chat history', priority: 1 },
];

const SETUP_TIPS: ToolbarTip[] = [
  { text: 'No AI provider configured — send /config to set up', priority: 5 },
  { text: 'Send /config to configure API key and model', priority: 4 },
  { text: 'Supported: OpenAI · DeepSeek · Moonshot · Qwen · OpenRouter', priority: 2 },
  ...TOOLBAR_TIPS,
];

const TIP_INTERVAL_MS = 10_000;

function buildWeightedRotation(tips: ToolbarTip[]): ToolbarTip[] {
  const items = tips.map(t => ({
    tip: t,
    weight: Math.max(1, Math.trunc(t.priority ?? 1)),
    current: 0,
  }));
  const total = items.reduce((s, i) => s + i.weight, 0);
  const seq: ToolbarTip[] = [];
  for (let n = 0; n < total; n++) {
    let best = items[0]!;
    for (const it of items) {
      it.current += it.weight;
      if (it.current > best.current) best = it;
    }
    best.current -= total;
    seq.push(best.tip);
  }
  return seq;
}

const ROTATION = buildWeightedRotation(TOOLBAR_TIPS);
const SETUP_ROTATION = buildWeightedRotation(SETUP_TIPS);

function tipAtIndex(index: number, rotation: ToolbarTip[]): string {
  const n = rotation.length;
  if (n === 0) return '';
  const offset = ((index % n) + n) % n;
  return rotation[offset]!.text;
}

// ---------------------------------------------------------------------------
// Props & Component
// ---------------------------------------------------------------------------

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

  /** Tick counter for braille spinner animation. */
  private _spinTick = 0;
  /** Rotating tip index. */
  private _tipIdx = 0;
  /** Timestamp of last tip rotation. */
  private _lastTipTime = Date.now();

  constructor(props: StatusBarProps) {
    this._props = { streaming: false, ...props };
  }

  /** Update props and trigger a re-render. */
  update(props: Partial<StatusBarProps>): void {
    Object.assign(this._props, props);
    this.invalidate();
  }

  invalidate(): void {
    this._invalidate?.();
  }

  /** Register the invalidate callback (called by Container). */
  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  render(width: number): string[] {
    const { playing, bpm, patternName, mode, streaming, model } = this._props;

    // Advance spinner tick
    if (streaming) {
      this._spinTick++;
    }

    // Advance tip rotation
    const now = Date.now();
    if (now - this._lastTipTime >= TIP_INTERVAL_MS) {
      this._tipIdx++;
      this._lastTipTime = now;
    }

    const isConfigured = mode === 'llm';
    const rotation = isConfigured ? ROTATION : SETUP_ROTATION;
    const tip = tipAtIndex(this._tipIdx, rotation);

    // --- Line 1: title + tip ---
    const title = 'strudel-tui v0.1.0';
    const styledTitle = chalk.hex(colors.primary).bold(title);
    const styledTip = chalk.hex(colors.textMuted)(tip);
    // Compute gap using visible (non-ANSI) widths
    const titleVis = visibleWidth(title);
    const tipVis = visibleWidth(tip);
    const gap = Math.max(2, width - titleVis - tipVis);
    const line1 = styledTitle + ' '.repeat(gap) + styledTip;

    // --- Line 2: status info ---
    const stateLabel = playing ? 'PLAYING' : 'STOPPED';
    const stateColor = playing ? colors.playing : colors.stopped;
    const stateStyled = streaming
      ? chalk.hex(colors.primary)(brailleFrame(this._spinTick))
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

    const line2 = stateStyled + sep + bpmStyled + sep + patternStyled + sep + modeStyled + sep + modelText;

    // --- Line 3: separator ---
    const line3 = chalk.hex(colors.border)('─'.repeat(width));

    return [line1, line2, line3];
  }
}
