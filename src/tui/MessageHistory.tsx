import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

export type MessageType = 'user' | 'agent' | 'error' | 'system' | 'tool';

export interface Message {
  type: MessageType;
  content: string;
}

interface MessageHistoryProps {
  messages: Message[];
  height: number;
  width?: number;
}

// Clean message styling — minimal, matching Claude Code's open feel
const TYPE_STYLE: Record<MessageType, { symbol: string; color: string }> = {
  user:   { symbol: '✦', color: colors.roleUser },
  agent:  { symbol: '●', color: colors.text },
  error:  { symbol: '✗', color: colors.error },
  system: { symbol: '◆', color: colors.textMuted },
  tool:   { symbol: '▸', color: colors.roleTool },
};

const MessageHistory: React.FC<MessageHistoryProps> = ({ messages, height, width }) => {
  const maxVisible = Math.max(1, height - 2);
  const visible = messages.slice(-maxVisible);
  const textWidth = width ? Math.max(10, width - 2) : undefined;

  const truncate = (text: string): string => {
    if (!textWidth || text.length <= textWidth) return text;
    return text.slice(0, textWidth - 1) + '…';
  };

  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      {visible.length === 0 ? (
        <Text color={colors.textMuted}>  No messages yet</Text>
      ) : (
        visible.map((msg, idx) => {
          const style = TYPE_STYLE[msg.type];
          const content = truncate(msg.content);
          return (
            <Text key={idx} wrap="truncate">
              <Text color={style.color}> {style.symbol} </Text>
              <Text color={msg.type === 'system' ? colors.textDim : colors.text}>
                {content}
              </Text>
            </Text>
          );
        })
      )}
    </Box>
  );
};

export default MessageHistory;
