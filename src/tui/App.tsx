import React, { useState, useCallback, useRef } from 'react';
import { Box, useInput, useApp, useWindowSize } from 'ink';
import MessageHistory from './MessageHistory.js';
import type { Message } from './MessageHistory.js';
import PatternEditor from './PatternEditor.js';
import StatusBar from './StatusBar.js';
import InputBox from './InputBox.js';
import SlashCommandMenu, { filterCommands } from './SlashCommandMenu.js';
import type { SlashCommand } from './SlashCommandMenu.js';
import { AudioController } from '../audio/AudioController.js';
import { Agent } from '../agent/Agent.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import { writeFile } from 'node:fs/promises';

interface AppProps {
  initialPattern?: string;
  bpm?: number;
  debug?: boolean;
  configOverrides?: Partial<StrudelConfig>;
}

const DEFAULT_PATTERN = `// Start typing your Strudel pattern here
d1 $ s "bd sn"`;

const App: React.FC<AppProps> = ({ initialPattern, bpm = 130, debug: _debug = false, configOverrides }) => {
  const { exit } = useApp();
  const { rows, columns } = useWindowSize();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { type: 'system', content: 'Welcome to Strudel-TUI. Type a pattern or command and press Enter.' },
  ]);
  const [pattern, setPattern] = useState(initialPattern ?? DEFAULT_PATTERN);
  const [playing, setPlaying] = useState(false);
  const [patternName, _setPatternName] = useState('untitled');

  // Slash command menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);

  const agentRef = useRef(new Agent(initialPattern ?? '', undefined, configOverrides));
  const audioRef = useRef(new AudioController());
  const historyIndexRef = useRef(-1);
  const inputHistoryRef = useRef<string[]>([]);
  const streamingRef = useRef(false);

  // Show LLM mode status on mount
  React.useEffect(() => {
    const agent = agentRef.current;
    if (agent.hasLLM) {
      setMessages(prev => [...prev, { type: 'system', content: 'AI agent mode enabled. Chat naturally to create and edit patterns.' }]);
    } else {
      setMessages(prev => [...prev, { type: 'system', content: 'No API key configured. Using keyword mode. Run "strudel-tui config set apiKey <key>" to enable AI agent.' }]);
    }
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const handlePlay = useCallback(async () => {
    try {
      addMessage({ type: 'system', content: 'Starting playback...' });
      await audioRef.current.play(pattern);
      setPlaying(true);
      addMessage({ type: 'system', content: 'Playback started.' });
    } catch (err: any) {
      addMessage({ type: 'error', content: `Playback error: ${err.message}` });
    }
  }, [pattern, addMessage]);

  const handleStop = useCallback(async () => {
    try {
      await audioRef.current.stop();
      setPlaying(false);
      addMessage({ type: 'system', content: 'Playback stopped.' });
    } catch (err: any) {
      addMessage({ type: 'error', content: `Stop error: ${err.message}` });
    }
  }, [addMessage]);

  const handleSave = useCallback(async () => {
    const filename = `${patternName}.strudel`;
    try {
      await writeFile(filename, pattern, 'utf-8');
      addMessage({ type: 'system', content: `Pattern saved to ${filename}` });
    } catch (err: any) {
      addMessage({ type: 'error', content: `Save error: ${err.message}` });
    }
  }, [pattern, patternName, addMessage]);

  const executeSlashCommand = useCallback((cmd: SlashCommand) => {
    const cmdName = cmd.name;
    const needsArg = ['/make', '/edit', '/load'].includes(cmdName);

    if (needsArg) {
      // Keep the command in the input so user can type the argument
      setInput(cmdName + ' ');
      setSlashMenuOpen(false);
    } else {
      // Execute immediately
      setInput('');
      setSlashMenuOpen(false);
      addMessage({ type: 'user', content: cmdName });

      const agent = agentRef.current;
      agent.context.pattern = pattern;

      if (agent.hasLLM) {
        streamingRef.current = true;
        let streamingText = '';
        (async () => {
          try {
            await agent.processUserMessageStreaming(cmdName, (event) => {
              switch (event.type) {
                case 'text_delta':
                  streamingText += event.delta;
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'agent' && last.content.endsWith('▌')) {
                      return [...prev.slice(0, -1), { type: 'agent', content: streamingText + '▌' }];
                    }
                    return [...prev, { type: 'agent', content: streamingText + '▌' }];
                  });
                  break;
                case 'tool_call':
                  addMessage({ type: 'tool', content: `Calling ${event.name}(${JSON.stringify(event.args)})` });
                  break;
                case 'tool_result':
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'tool' && last.content.startsWith('Calling')) {
                      return [...prev.slice(0, -1), { type: 'tool', content: `${last.content} → ${event.result}` }];
                    }
                    return [...prev, { type: 'tool', content: `${event.name}: ${event.result}` }];
                  });
                  break;
                case 'pattern_update':
                  setPattern(event.pattern);
                  break;
                case 'done':
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'agent' && last.content.endsWith('▌')) {
                      return [...prev.slice(0, -1), { type: 'agent', content: event.response.message || streamingText }];
                    }
                    if (event.response.message && !streamingText) {
                      return [...prev, { type: 'agent', content: event.response.message }];
                    }
                    return prev;
                  });
                  if (event.response.pattern) setPattern(event.response.pattern);
                  break;
                case 'error':
                  addMessage({ type: 'error', content: event.error });
                  break;
              }
            });
          } catch (err: any) {
            addMessage({ type: 'error', content: `Error: ${err.message}` });
          } finally {
            streamingRef.current = false;
          }
        })();
      } else {
        (async () => {
          try {
            const response = await agent.processUserMessage(cmdName);
            if (response.error) {
              addMessage({ type: 'error', content: response.message });
            } else {
              addMessage({ type: 'agent', content: response.message });
            }
            if (response.pattern && response.pattern !== pattern) setPattern(response.pattern);
            if (response.action === 'play') handlePlay();
            else if (response.action === 'stop') handleStop();
          } catch (err: any) {
            addMessage({ type: 'error', content: `Agent error: ${err.message}` });
          }
        })();
      }
    }
  }, [pattern, addMessage, handlePlay, handleStop, setMessages]);

  useInput((inputKey, key) => {
    // Ctrl+C: quit gracefully
    if (key.ctrl && inputKey === 'c') {
      if (playing) audioRef.current.stop().catch(() => {});
      audioRef.current.shutdown().catch(() => {});
      exit();
      return;
    }

    // Ctrl+P: toggle play/stop
    if (key.ctrl && inputKey === 'p') {
      if (playing) handleStop();
      else handlePlay();
      return;
    }

    // Ctrl+S: save pattern
    if (key.ctrl && inputKey === 's') {
      handleSave();
      return;
    }

    // Ctrl+L: clear message history
    if (key.ctrl && inputKey === 'l') {
      setMessages([]);
      return;
    }

    // Escape: close slash menu
    if (key.escape) {
      if (slashMenuOpen) {
        setSlashMenuOpen(false);
        return;
      }
    }

    // Arrow keys
    if (key.upArrow) {
      if (slashMenuOpen) {
        setSlashSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (inputHistoryRef.current.length > 0) {
        const idx = historyIndexRef.current + 1;
        if (idx < inputHistoryRef.current.length) {
          historyIndexRef.current = idx;
          setInput(inputHistoryRef.current[inputHistoryRef.current.length - 1 - idx]);
        }
      }
      return;
    }

    if (key.downArrow) {
      if (slashMenuOpen) {
        setSlashSelectedIndex(prev => Math.min(slashCommands.length - 1, prev + 1));
      } else if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        setInput(inputHistoryRef.current[inputHistoryRef.current.length - 1 - historyIndexRef.current]);
      } else {
        historyIndexRef.current = -1;
        setInput('');
      }
      return;
    }

    // Enter
    if (key.return) {
      if (slashMenuOpen && slashCommands.length > 0) {
        // Select the highlighted command
        executeSlashCommand(slashCommands[slashSelectedIndex]);
        return;
      }

      if (input.trim().length === 0) return;
      if (streamingRef.current) return;

      const userInput = input.trim();
      addMessage({ type: 'user', content: userInput });
      inputHistoryRef.current.push(userInput);
      historyIndexRef.current = -1;
      setInput('');
      setSlashMenuOpen(false);

      const agent = agentRef.current;
      agent.context.pattern = pattern;

      if (agent.hasLLM) {
        streamingRef.current = true;
        let streamingText = '';

        (async () => {
          try {
            await agent.processUserMessageStreaming(userInput, (event) => {
              switch (event.type) {
                case 'text_delta':
                  streamingText += event.delta;
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'agent' && last.content.endsWith('▌')) {
                      return [...prev.slice(0, -1), { type: 'agent', content: streamingText + '▌' }];
                    }
                    return [...prev, { type: 'agent', content: streamingText + '▌' }];
                  });
                  break;

                case 'tool_call':
                  addMessage({ type: 'tool', content: `Calling ${event.name}(${JSON.stringify(event.args)})` });
                  break;

                case 'tool_result':
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'tool' && last.content.startsWith('Calling')) {
                      return [...prev.slice(0, -1), { type: 'tool', content: `${last.content} → ${event.result}` }];
                    }
                    return [...prev, { type: 'tool', content: `${event.name}: ${event.result}` }];
                  });
                  break;

                case 'pattern_update':
                  setPattern(event.pattern);
                  break;

                case 'done':
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'agent' && last.content.endsWith('▌')) {
                      return [...prev.slice(0, -1), { type: 'agent', content: event.response.message || streamingText }];
                    }
                    if (event.response.message && !streamingText) {
                      return [...prev, { type: 'agent', content: event.response.message }];
                    }
                    return prev;
                  });
                  if (event.response.pattern) {
                    setPattern(event.response.pattern);
                  }
                  break;

                case 'error':
                  addMessage({ type: 'error', content: event.error });
                  break;
              }
            });
          } catch (err: any) {
            addMessage({ type: 'error', content: `Error: ${err.message}` });
          } finally {
            streamingRef.current = false;
          }
        })();
      } else {
        (async () => {
          try {
            const response = await agent.processUserMessage(userInput);
            if (response.error) {
              addMessage({ type: 'error', content: response.message });
            } else {
              addMessage({ type: 'agent', content: response.message });
            }
            if (response.pattern && response.pattern !== pattern) {
              setPattern(response.pattern);
            }
            if (response.action === 'play') handlePlay();
            else if (response.action === 'stop') handleStop();
          } catch (err: any) {
            addMessage({ type: 'error', content: `Agent error: ${err.message}` });
          }
        })();
      }
      return;
    }

    // Backspace
    if (key.backspace) {
      setInput(prev => {
        const next = prev.slice(0, -1);
        // Close slash menu when input no longer starts with /
        if (slashMenuOpen && !next.startsWith('/')) {
          setSlashMenuOpen(false);
        } else if (slashMenuOpen && next.startsWith('/')) {
          const cmds = filterCommands(next);
          setSlashCommands(cmds);
          setSlashSelectedIndex(0);
          if (cmds.length === 0) setSlashMenuOpen(false);
        }
        return next;
      });
      return;
    }

    // Ignore other control sequences
    if (key.ctrl || key.meta || key.tab) return;

    // Append typed character
    if (inputKey.length > 0) {
      setInput(prev => {
        const next = prev + inputKey;
        // Detect slash command start
        if (next === '/') {
          const cmds = filterCommands('/');
          setSlashCommands(cmds);
          setSlashSelectedIndex(0);
          setSlashMenuOpen(true);
        } else if (slashMenuOpen && next.startsWith('/')) {
          const cmds = filterCommands(next);
          setSlashCommands(cmds);
          setSlashSelectedIndex(0);
          if (cmds.length === 0) setSlashMenuOpen(false);
        }
        return next;
      });
    }
  });

  // Layout: status bar (top) + main row (left: editor+input, right: message sidebar)
  const sidebarWidth = Math.max(20, Math.min(50, Math.floor(columns * 0.28)));

  return (
    <Box flexDirection="column" height={rows}>
      <StatusBar playing={playing} bpm={bpm} patternName={patternName} />
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          <PatternEditor code={pattern} />
          <Box flexGrow={1} />
          {slashMenuOpen && slashCommands.length > 0 && (
            <SlashCommandMenu
              commands={slashCommands}
              selectedIndex={slashSelectedIndex}
              maxWidth={columns - sidebarWidth}
            />
          )}
          <InputBox value={input} />
        </Box>
        <MessageHistory messages={messages} height={rows - 2} width={sidebarWidth} />
      </Box>
    </Box>
  );
};

export default App;
