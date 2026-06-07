import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';
import MoonSpinner from './MoonSpinner.js';

interface StatusBarProps {
  playing: boolean;
  bpm: number;
  patternName: string;
  mode: 'llm' | 'keyword';
  streaming?: boolean;
  model?: string;
  width: number;
}

// Rotating tips — weighted round-robin
interface ToolbarTip { text: string; priority?: number; }

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

// Tips shown when AI is not configured (higher priority for setup)
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

function tipsForIndex(index: number, rotation: ToolbarTip[] = ROTATION): string {
  const n = rotation.length;
  if (n === 0) return '';
  const offset = ((index % n) + n) % n;
  return rotation[offset]!.text;
}

/**
 * Clean header — matches Claude Code's style:
 *   Line 1: "strudel-tui v0.1.0" (left)  |  tip (right)
 *   Line 2: status info (state, bpm, pattern, mode)
 *   Line 3: separator ─────────────────────────────
 */
const StatusBar: React.FC<StatusBarProps> = ({ playing, bpm, patternName, mode, streaming = false, model, width }) => {
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIdx(prev => (prev + 1) % ROTATION.length);
    }, TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const stateLabel = playing ? 'PLAYING' : 'STOPPED';
  const stateColor = playing ? colors.playing : colors.stopped;
  const isConfigured = mode === 'llm';
  const modeLabel = isConfigured ? '◆ AI' : '◇ keyword';
  const modeColor = isConfigured ? colors.success : colors.textMuted;

  const rotation = isConfigured ? ROTATION : SETUP_ROTATION;
  const tip = tipsForIndex(tipIdx, rotation);

  // Line 1: title + tip
  const title = 'strudel-tui v0.1.0';
  const titleWidth = title.length;
  const tipWidth = tip.length;
  const gap = Math.max(2, width - titleWidth - tipWidth);

  return (
    <Box flexDirection="column" width={width}>
      {/* Line 1: title + tip */}
      <Text>
        <Text color={colors.primary} bold>{title}</Text>
        <Text>{' '.repeat(gap)}</Text>
        <Text color={colors.textMuted}>{tip}</Text>
      </Text>
      {/* Line 2: status */}
      <Text>
        {streaming ? (
          <MoonSpinner color={colors.primary} variant="braille" />
        ) : (
          <Text color={stateColor} bold>{stateLabel}</Text>
        )}
        <Text color={colors.textMuted}>  ·  </Text>
        <Text color={colors.bpm}>{bpm} BPM</Text>
        <Text color={colors.textMuted}>  ·  </Text>
        <Text color={colors.pattern}>{patternName}</Text>
        <Text color={colors.textMuted}>  ·  </Text>
        <Text color={modeColor}>{modeLabel}</Text>
        <Text color={colors.textMuted}>  ·  </Text>
        {isConfigured && model ? (
          <Text color={colors.textDim}>{model}</Text>
        ) : (
          <Text color={colors.warning}>model not set — /config</Text>
        )}
      </Text>
      {/* Line 3: separator */}
      <Text color={colors.border}>{'─'.repeat(width)}</Text>
    </Box>
  );
};

export default StatusBar;
