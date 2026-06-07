import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  playing: boolean;
  bpm: number;
  patternName: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ playing, bpm, patternName }) => {
  const stateLabel = playing ? 'PLAYING' : 'STOPPED';
  const stateColor = playing ? 'green' : 'red';

  return (
    <Box borderStyle="single" borderLeft={false} borderRight={false} borderTop={false} borderBottom={false} paddingX={1}>
      <Text>
        <Text color={stateColor} bold>
          {stateLabel}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="yellow">
          BPM: {bpm}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="cyan">
          {patternName}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="gray">
          Ctrl+P Play/Stop  Ctrl+S Save  Ctrl+L Clear  Ctrl+C Quit
        </Text>
      </Text>
    </Box>
  );
};

export default StatusBar;
