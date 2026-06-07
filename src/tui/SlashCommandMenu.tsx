import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

export interface SlashCommand {
  name: string;
  description: string;
  alias?: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/play', description: 'Start playback', alias: ['/start', '/go'] },
  { name: '/stop', description: 'Stop playback', alias: ['/pause', '/hush'] },
  { name: '/make', description: 'Generate a pattern', alias: ['/create'] },
  { name: '/edit', description: 'Edit the pattern', alias: ['/change'] },
  { name: '/validate', description: 'Validate pattern', alias: ['/check'] },
  { name: '/undo', description: 'Revert to previous' },
  { name: '/redo', description: 'Re-apply last change' },
  { name: '/save', description: 'Save to file' },
  { name: '/load', description: 'Load a file' },
  { name: '/config', description: 'Show AI config' },
  { name: '/provider', description: 'Switch AI provider' },
  { name: '/clear', description: 'Clear chat', alias: ['/cls'] },
  { name: '/help', description: 'Show commands' },
  { name: '/quit', description: 'Exit', alias: ['/exit', '/q'] },
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

/**
 * Slash command menu — clean, no box borders, matching Claude Code's open feel.
 */
const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({ commands, selectedIndex, maxWidth }) => {
  if (commands.length === 0) return null;

  return (
    <Box flexDirection="column" width={maxWidth} paddingX={1}>
      <Text color={colors.border}>{'─'.repeat(maxWidth - 2)}</Text>
      {commands.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        const pad = Math.max(1, 18 - cmd.name.length);
        return (
          <Text key={cmd.name}>
            <Text color={isSelected ? colors.primary : colors.textMuted}>
              {isSelected ? '▸' : ' '}
            </Text>
            <Text color={isSelected ? colors.primary : colors.text} bold={isSelected}>
              {' '}{cmd.name}
            </Text>
            <Text>{' '.repeat(pad)}</Text>
            <Text color={colors.textDim}>
              {cmd.description}
            </Text>
          </Text>
        );
      })}
      <Text color={colors.border}>{'─'.repeat(maxWidth - 2)}</Text>
    </Box>
  );
};

export default SlashCommandMenu;
