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

const MessageHistory: React.FC<MessageHistoryProps> = ({ messages, height }) => {
  const maxVisible = Math.max(1, height - 2);
  const visible = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      {visible.length === 0 ? (
        <Text color="gray">Type a message and press Enter.</Text>
      ) : (
        visible.map((msg, idx) => (
          <Text key={idx} color={TYPE_COLORS[msg.type]}>
            {TYPE_PREFIX[msg.type]} {msg.content}
          </Text>
        ))
      )}
    </Box>
  );
};

export default MessageHistory;
