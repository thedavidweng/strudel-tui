/**
 * Help text constants for the Strudel-TUI agent.
 * Commands, keyboard shortcuts, and example patterns.
 */

export interface CommandInfo {
  command: string;
  description: string;
  example?: string;
}

export interface ShortcutInfo {
  keys: string;
  description: string;
}

export interface ExamplePattern {
  name: string;
  code: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const COMMANDS: CommandInfo[] = [
  {
    command: 'play / start / go',
    description: 'Start audio playback of the current pattern',
  },
  {
    command: 'stop / pause / hush',
    description: 'Stop all playing patterns',
  },
  {
    command: 'make / create / generate <description>',
    description: 'Generate a new pattern from a text description',
    example: 'make a funky drum beat',
  },
  {
    command: 'edit / change / modify <instruction>',
    description: 'Modify the current pattern based on instructions',
    example: 'edit make it slower',
  },
  {
    command: 'validate / check',
    description: 'Validate the current pattern for syntax errors',
  },
  {
    command: 'undo',
    description: 'Revert to the previous pattern',
  },
  {
    command: 'redo',
    description: 'Re-apply the last undone pattern change',
  },
  {
    command: 'help',
    description: 'Show this help message',
  },
];

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

export const KEYBOARD_SHORTCUTS: ShortcutInfo[] = [
  { keys: 'Ctrl+P', description: 'Toggle play/stop' },
  { keys: 'Ctrl+S', description: 'Save current pattern to file' },
  { keys: 'Ctrl+L', description: 'Clear message history' },
  { keys: 'Ctrl+C', description: 'Quit strudel-tui' },
  { keys: 'Up/Down', description: 'Scroll through input history' },
];

// ---------------------------------------------------------------------------
// Example patterns
// ---------------------------------------------------------------------------

export const EXAMPLES: ExamplePattern[] = [
  {
    name: 'Basic drums',
    code: 's("bd sn hh cp")',
    description: 'Four basic drum sounds in sequence',
  },
  {
    name: 'Fast hi-hats',
    code: 's("hh*8")',
    description: 'Eight hi-hats per cycle',
  },
  {
    name: 'Kick and snare',
    code: 's("bd*4, [- sd]*2")',
    description: 'Four kicks with snare on beats 2 and 4',
  },
  {
    name: 'Melody',
    code: 'note("c d e f g a b c5").sound("triangle")',
    description: 'Simple ascending scale with triangle wave',
  },
  {
    name: 'Chord progression',
    code: 'note("<c e g> <d f a> <e g b>").sound("sawtooth").slow(2)',
    description: 'Slow chord progression with sawtooth',
  },
  {
    name: 'Techno beat',
    code: 's("bd*4, [- sd]*2, hh*8")',
    description: 'Classic techno kick-snare-hihat pattern',
  },
];

// ---------------------------------------------------------------------------
// Help formatter
// ---------------------------------------------------------------------------

/**
 * Format all help information into a single display string.
 */
export function formatHelp(): string {
  const lines: string[] = [];

  lines.push('=== Commands ===');
  for (const cmd of COMMANDS) {
    let line = `  ${cmd.command}  --  ${cmd.description}`;
    if (cmd.example) {
      line += `\n    Example: ${cmd.example}`;
    }
    lines.push(line);
  }

  lines.push('');
  lines.push('=== Keyboard Shortcuts ===');
  for (const shortcut of KEYBOARD_SHORTCUTS) {
    lines.push(`  ${shortcut.keys.padEnd(10)}  ${shortcut.description}`);
  }

  lines.push('');
  lines.push('=== Example Patterns ===');
  for (const ex of EXAMPLES) {
    lines.push(`  ${ex.name}: ${ex.code}`);
    lines.push(`    ${ex.description}`);
  }

  lines.push('');
  lines.push('Tip: Type any Strudel code directly to evaluate it as a pattern.');

  return lines.join('\n');
}
