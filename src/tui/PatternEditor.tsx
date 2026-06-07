import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

interface PatternEditorProps {
  code: string;
  maxWidth?: number;
}

/**
 * Pattern code display — clean, no box borders, like Claude Code's open layout.
 * Uses color and spacing for visual hierarchy instead of heavy borders.
 */
const PatternEditor: React.FC<PatternEditorProps> = ({ code, maxWidth }) => {
  const lines = code.split('\n');
  const gutterWidth = String(lines.length).length;
  const width = maxWidth ?? 60;

  const truncate = (text: string, max: number): string => {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + '…';
  };

  // Available content width: total - gutter - separator - margin
  const contentMax = width - gutterWidth - 3 - 2;

  return (
    <Box flexDirection="column" width={width}>
      {lines.map((line, idx) => {
        const lineNum = String(idx + 1).padStart(gutterWidth, ' ');
        const content = truncate(line, contentMax);
        return (
          <Text key={idx}>
            <Text color={colors.textMuted}> {lineNum}</Text>
            <Text color={colors.border}> │ </Text>
            <Text color={colors.text}>{content}</Text>
          </Text>
        );
      })}
    </Box>
  );
};

export default PatternEditor;
