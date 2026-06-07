import React from 'react';
import { Box, Text } from 'ink';

interface PatternEditorProps {
  code: string;
}

const PatternEditor: React.FC<PatternEditorProps> = ({ code }) => {
  const lines = code.split('\n');
  const gutterWidth = String(lines.length).length;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {lines.map((line, idx) => {
        const lineNum = String(idx + 1).padStart(gutterWidth, ' ');
        return (
          <Text key={idx}>
            <Text color="gray">{lineNum}</Text>
            <Text color="gray"> | </Text>
            <Text color="white">{line}</Text>
          </Text>
        );
      })}
    </Box>
  );
};

export default PatternEditor;
