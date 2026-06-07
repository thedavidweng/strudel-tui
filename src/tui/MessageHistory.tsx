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

const TYPE_COLORS: Record<MessageType, string> = {
  user: 'white',
  agent: 'green',
  error: 'red',
  system: 'gray',
  tool: 'yellow',
};

const TYPE_PREFIX: Record<MessageType, string> = {
  user: '>',
  agent: '<',
  error: '!',
  system: '*',
  tool: '#',
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
        <Text color="gray">No messages yet.</Text>
      ) : (
        visible.map((msg, idx) => (
          <Text key={idx} color={TYPE_COLORS[msg.type]} wrap="truncate">
            {TYPE_PREFIX[msg.type]} {truncate(msg.content)}
          </Text>
        ))
      )}
    </Box>
  );
};

export default MessageHistory;
