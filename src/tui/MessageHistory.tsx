import React from 'react';
import { Box, Text } from 'ink';

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

// Kimi-code style: colored bullets instead of plain prefixes
const TYPE_STYLE: Record<MessageType, { symbol: string; color: string }> = {
  user:   { symbol: '✦', color: '#f59e0b' },  // amber
  agent:  { symbol: '●', color: '#22c55e' },  // green
  error:  { symbol: '✗', color: '#ef4444' },  // red
  system: { symbol: '◆', color: '#6b7280' },  // gray
  tool:   { symbol: '▸', color: '#3b82f6' },  // blue
};

const MessageHistory: React.FC<MessageHistoryProps> = ({ messages, height, width }) => {
  const maxVisible = Math.max(1, height - 2);
  const visible = messages.slice(-maxVisible);
  // Account for border (2) + paddingX (2) = 4 chars overhead
  const textWidth = width ? Math.max(10, width - 4) : undefined;

  const truncate = (text: string): string => {
    if (!textWidth || text.length <= textWidth) return text;
    return text.slice(0, textWidth - 1) + '…';
  };

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width={width} flexShrink={0}>
      {visible.length === 0 ? (
        <Text color="gray" dimColor>Type a message or / for commands</Text>
      ) : (
        visible.map((msg, idx) => {
          const style = TYPE_STYLE[msg.type];
          return (
            <Text key={idx} wrap="truncate">
              <Text color={style.color}> {style.symbol} </Text>
              <Text color={msg.type === 'system' ? 'gray' : 'white'}>
                {truncate(msg.content)}
              </Text>
            </Text>
          );
        })
      )}
    </Box>
  );
};

export default MessageHistory;
