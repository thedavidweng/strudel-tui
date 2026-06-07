import React from 'react';
import { Box, Text } from 'ink';

export interface SlashCommand {
  name: string;
  description: string;
  alias?: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/play', description: 'Start playback of the current pattern', alias: ['/start', '/go'] },
  { name: '/stop', description: 'Stop all playing patterns', alias: ['/pause', '/hush'] },
  { name: '/make', description: 'Generate a pattern from a description', alias: ['/create'] },
  { name: '/edit', description: 'Edit the current pattern', alias: ['/change'] },
  { name: '/validate', description: 'Validate the current pattern', alias: ['/check'] },
  { name: '/undo', description: 'Revert to the previous pattern' },
  { name: '/redo', description: 'Re-apply the last undone change' },
  { name: '/save', description: 'Save the current pattern to a file' },
  { name: '/load', description: 'Load a pattern file by name' },
  { name: '/config', description: 'Show current AI provider configuration' },
  { name: '/provider', description: 'Switch AI provider (OpenAI, DeepSeek, etc.)' },
  { name: '/clear', description: 'Clear the message history', alias: ['/cls'] },
  { name: '/help', description: 'Show available commands and shortcuts' },
  { name: '/quit', description: 'Exit the application', alias: ['/exit', '/q'] },
];

export function filterCommands(query: string): SlashCommand[] {
  const lower = query.toLowerCase();
  return SLASH_COMMANDS.filter(cmd => {
    if (cmd.name.startsWith(lower)) return true;
    if (cmd.alias?.some(a => a.startsWith(lower))) return true;
    if (cmd.description.toLowerCase().includes(lower)) return true;
    return false;
  });
}

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  maxWidth: number;
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({ commands, selectedIndex, maxWidth }) => {
  if (commands.length === 0) return null;

  const descWidth = Math.max(20, maxWidth - 22);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {commands.map((cmd, idx) => (
        <Text key={cmd.name}>
          <Text color={idx === selectedIndex ? 'cyan' : 'white'} bold={idx === selectedIndex}>
            {cmd.name}
          </Text>
          <Text color="gray">{' '.repeat(Math.max(1, 22 - cmd.name.length))}</Text>
          <Text color={idx === selectedIndex ? 'white' : 'gray'}>
            {cmd.description.length > descWidth
              ? cmd.description.slice(0, descWidth - 1) + '…'
              : cmd.description}
          </Text>
        </Text>
      ))}
    </Box>
  );
};

export default SlashCommandMenu;
