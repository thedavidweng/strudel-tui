import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

interface InputBoxProps {
  value: string;
  maxWidth?: number;
}

/**
 * Input box with kimi-code style box-drawing borders.
 * Uses ╭╮╰╯ corners with connected-above mode (├┤) when mounted below other content.
 */
const InputBox: React.FC<InputBoxProps> = ({ value, maxWidth }) => {
  const width = maxWidth ?? 60;
  const innerWidth = width - 2;

  // Input content: "> " + value + cursor
  const inputContent = `> ${value}`;
  const padLen = Math.max(0, innerWidth - inputContent.length - 1); // -1 for cursor

  return (
    <Box flexDirection="column" width={width}>
      {/* Connected top border: ├──...──┤ (joins with editor above) */}
      <Text>
        <Text color={colors.border}>├</Text>
        <Text color={colors.border}>{'─'.repeat(innerWidth)}</Text>
        <Text color={colors.border}>┤</Text>
      </Text>
      {/* Input line */}
      <Text>
        <Text color={colors.border}>│</Text>
        <Text color={colors.primary} bold> {'>'} </Text>
        <Text color={colors.text}>{value}</Text>
        <Text color={colors.textDim}>▌</Text>
        <Text>{' '.repeat(Math.max(0, padLen))}</Text>
        <Text color={colors.border}>│</Text>
      </Text>
      {/* Bottom border: ╰──...──╯ */}
      <Text>
        <Text color={colors.border}>╰</Text>
        <Text color={colors.border}>{'─'.repeat(innerWidth)}</Text>
        <Text color={colors.border}>╯</Text>
      </Text>
    </Box>
  );
};

export default InputBox;
