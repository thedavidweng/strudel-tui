import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  playing: boolean;
  bpm: number;
  patternName: string;
  mode: 'llm' | 'keyword';
  streaming?: boolean;
}

// Rotating tips for the status bar
const TIPS = [
  'Ctrl+P play/stop',
  'Ctrl+S save',
  'Ctrl+L clear',
  'Type / for commands',
  'Ctrl+C twice to quit',
  '/help for help',
  '/make to generate',
  '/edit to edit',
];

const StatusBar: React.FC<StatusBarProps> = ({ playing, bpm, patternName, mode, streaming = false }) => {
  const stateLabel = playing ? 'PLAYING' : 'STOPPED';
  const stateColor = playing ? '#22c55e' : '#ef4444';
  const [tipIdx, setTipIdx] = useState(0);

  // Rotate tips every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIdx(prev => (prev + 1) % TIPS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderLeft={false} borderRight={false} borderTop={false} borderBottom={false} paddingX={1}>
        <Text>
          <Text color={stateColor} bold>
            {streaming ? '◌ thinking' : stateLabel}
          </Text>
          <Text color="gray"> │ </Text>
          <Text color="#f59e0b">
            BPM {bpm}
          </Text>
          <Text color="gray"> │ </Text>
          <Text color="#3b82f6">
            {patternName}
          </Text>
          <Text color="gray"> │ </Text>
          <Text color={mode === 'llm' ? '#22c55e' : '#6b7280'}>
            {mode === 'llm' ? '◆ AI' : '◇ keyword'}
          </Text>
          <Text color="gray"> │ </Text>
          <Text color="gray" dimColor>
            {TIPS[tipIdx]}
          </Text>
        </Text>
      </Box>
    </Box>
  );
};

export default StatusBar;
