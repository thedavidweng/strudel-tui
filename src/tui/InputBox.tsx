import React from 'react';
import { Box, Text } from 'ink';

interface InputBoxProps {
  value: string;
}

const InputBox: React.FC<InputBoxProps> = ({ value }) => {
  return (
    <Box borderStyle="round" paddingX={1} paddingY={0}>
      <Text color="cyan" bold>
        {'>'}
      </Text>
      <Text> {value}</Text>
      <Text color="gray">_</Text>
    </Box>
  );
};

export default InputBox;
