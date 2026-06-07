import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, useWindowSize } from 'ink';
import MessageHistory from './MessageHistory.js';
import type { Message } from './MessageHistory.js';
import PatternEditor from './PatternEditor.js';
import StatusBar from './StatusBar.js';
import { SLASH_COMMANDS, filterCommands } from './SlashCommandMenu.js';
import { colors } from './theme.js';
import { AudioController } from '../audio/AudioController.js';
import { Agent } from '../agent/Agent.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { writeFile } from 'node:fs/promises';
import InlineConfig from './InlineConfig.js';
import { formatHelp } from '../agent/HelpText.js';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [pattern, setPattern] = useState(initialPattern ?? DEFAULT_PATTERN);
  const [playing, setPlaying] = useState(false);
  const [patternName, _setPatternName] = useState('untitled');
  const [isStreaming, setIsStreaming] = useState(false);

  // Autocomplete state — suggestions appear above input when typing "/"
  const [suggestions, setSuggestions] = useState<typeof SLASH_COMMANDS>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1); // -1 = none highlighted

  // Inline config panel state
  const [configPanel, setConfigPanel] = useState<'config' | 'provider' | null>(null);
  const [modelName, setModelName] = useState<string | undefined>(() => {
    const cfg = new ConfigManager();
    return cfg.isConfigured() ? cfg.get('model') : undefined;
  });

  const agentRef = useRef(new Agent(initialPattern ?? '', undefined, configOverrides));
  const audioRef = useRef(new AudioController());
  const historyIndexRef = useRef(-1);
  const inputHistoryRef = useRef<string[]>([]);
  const streamingRef = useRef(false);
  const exitArmRef = useRef(0);

  // Update suggestions whenever input changes
  const updateSuggestions = useCallback((value: string) => {
    if (value.startsWith('/')) {
      const filtered = filterCommands(value);
      setSuggestions(filtered);
      setSuggestionIndex(filtered.length > 0 ? 0 : -1);
    } else {
      setSuggestions([]);
      setSuggestionIndex(-1);
    }
  }, []);

  const setInputAndSuggestions = useCallback((value: string) => {
    setInput(value);
    updateSuggestions(value);
  }, [updateSuggestions]);

  // Welcome messages
  React.useEffect(() => {
    const agent = agentRef.current;
    if (agent.hasLLM) {
      setMessages([
        { type: 'system', content: '◆ AI agent ready' },
        { type: 'system', content: '  Type a message or send /help for commands' },
      ]);
    } else {
      setMessages([
        { type: 'system', content: '◇ Keyword mode — no AI provider configured' },
        { type: 'system', content: '  Send /config to set up AI, or /help for commands' },
      ]);
    }
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const handlePlay = useCallback(async () => {
    try {
      await audioRef.current.play(pattern);
      setPlaying(true);
    } catch (err: any) {
      addMessage({ type: 'error', content: `Playback error: ${err.message}` });
    }
  }, [pattern, addMessage]);

  const handleStop = useCallback(async () => {
    try {
      await audioRef.current.stop();
      setPlaying(false);
    } catch (err: any) {
      addMessage({ type: 'error', content: `Stop error: ${err.message}` });
    }
  }, [addMessage]);

  const handleSave = useCallback(async () => {
    const filename = `${patternName}.strudel`;
    try {
      await writeFile(filename, pattern, 'utf-8');
      addMessage({ type: 'system', content: `Saved to ${filename}` });
    } catch (err: any) {
      addMessage({ type: 'error', content: `Save error: ${err.message}` });
    }
  }, [pattern, patternName, addMessage]);

  const handleConfigClose = useCallback((saved: boolean) => {
    setConfigPanel(null);
    if (saved) {
      // Reload agent with new config
      const newAgent = new Agent(pattern, undefined);
      agentRef.current = newAgent;
      setModelName(new ConfigManager().get('model'));
      addMessage({ type: 'system', content: '◆ Configuration saved · AI agent reloaded' });
    } else {
      addMessage({ type: 'system', content: 'Configuration cancelled' });
    }
  }, [pattern, addMessage]);

  const executeCommand = useCallback((cmdName: string) => {
    const needsArg = ['/make', '/edit', '/load'].includes(cmdName);

    if (needsArg) {
      setInputAndSuggestions(cmdName + ' ');
      return;
    }

    if (cmdName === '/config') {
      setConfigPanel('config');
      return;
    }

    if (cmdName === '/provider') {
      setConfigPanel('provider');
      return;
    }

    // ── Direct commands: execute immediately, bypass LLM ──
    const directCommands: Record<string, () => void> = {
      '/play': () => { handlePlay(); addMessage({ type: 'system', content: 'Playing' }); },
      '/stop': () => { handleStop(); addMessage({ type: 'system', content: 'Stopped' }); },
      '/save': () => { handleSave(); },
      '/clear': () => { setMessages([]); },
      '/help': () => { addMessage({ type: 'system', content: formatHelp() }); },
      '/quit': () => { exit(); },
      '/undo': () => {
        const agent = agentRef.current;
        const restored = agent.undo();
        if (restored !== undefined) {
          setPattern(restored);
          addMessage({ type: 'system', content: 'Reverted to previous pattern' });
        } else {
          addMessage({ type: 'system', content: 'Nothing to undo' });
        }
      },
      '/redo': () => {
        const agent = agentRef.current;
        const restored = agent.redo();
        if (restored !== undefined) {
          setPattern(restored);
          addMessage({ type: 'system', content: 'Re-applied pattern' });
        } else {
          addMessage({ type: 'system', content: 'Nothing to redo' });
        }
      },
    };

    if (directCommands[cmdName]) {
      directCommands[cmdName]();
      return;
    }

    // ── Agent commands (make, edit, validate) ──
    const agent = agentRef.current;
    agent.context.pattern = pattern;

    if (agent.hasLLM) {
      streamingRef.current = true;
      setIsStreaming(true);
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
                addMessage({ type: 'tool', content: `▸ ${event.name}` });
                break;
              case 'tool_result':
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.type === 'tool') {
                    return [...prev.slice(0, -1), { type: 'tool', content: `▸ ${event.name} → ${event.result}` }];
                  }
                  return [...prev, { type: 'tool', content: `▸ ${event.name} → ${event.result}` }];
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
          addMessage({ type: 'error', content: err.message });
        } finally {
          streamingRef.current = false;
          setIsStreaming(false);
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
          addMessage({ type: 'error', content: err.message });
        }
      })();
    }
  }, [pattern, addMessage, handlePlay, handleStop, handleSave, exit, setMessages, setInputAndSuggestions]);

  useInput((inputKey, key) => {
    // Block all input while config panel is open (InlineConfig handles its own)
    if (configPanel) return;

    // Ctrl+C: double-tap to quit
    if (key.ctrl && inputKey === 'c') {
      if (streamingRef.current) {
        streamingRef.current = false;
        setIsStreaming(false);
        addMessage({ type: 'system', content: 'Interrupted' });
        return;
      }
      const now = Date.now();
      if (now - exitArmRef.current < 1500) {
        if (playing) audioRef.current.stop().catch(() => {});
        audioRef.current.shutdown().catch(() => {});
        exit();
      } else {
        exitArmRef.current = now;
        if (input.length > 0) {
          setInputAndSuggestions('');
        } else {
          addMessage({ type: 'system', content: 'Press ctrl+c again to exit' });
        }
      }
      return;
    }

    if (key.ctrl && inputKey === 'p') {
      if (playing) handleStop();
      else handlePlay();
      return;
    }

    if (key.ctrl && inputKey === 's') {
      handleSave();
      return;
    }

    if (key.ctrl && inputKey === 'l') {
      setMessages([]);
      return;
    }

    // Tab: accept highlighted suggestion
    if (key.tab && suggestions.length > 0 && suggestionIndex >= 0) {
      const selected = suggestions[suggestionIndex]!;
      const needsArg = ['/make', '/edit', '/load'].includes(selected.name);
      setInputAndSuggestions(needsArg ? selected.name + ' ' : selected.name);
      return;
    }

    // Escape: clear suggestions or clear input
    if (key.escape) {
      if (suggestions.length > 0) {
        setSuggestions([]);
        setSuggestionIndex(-1);
      } else if (input.length > 0) {
        setInputAndSuggestions('');
      }
      return;
    }

    // Arrow up: navigate suggestions or input history
    if (key.upArrow) {
      if (suggestions.length > 0) {
        setSuggestionIndex(prev => Math.max(0, prev - 1));
      } else if (inputHistoryRef.current.length > 0) {
        const idx = historyIndexRef.current + 1;
        if (idx < inputHistoryRef.current.length) {
          historyIndexRef.current = idx;
          const val = inputHistoryRef.current[inputHistoryRef.current.length - 1 - idx];
          setInputAndSuggestions(val);
        }
      }
      return;
    }

    // Arrow down: navigate suggestions or input history
    if (key.downArrow) {
      if (suggestions.length > 0) {
        setSuggestionIndex(prev => Math.min(suggestions.length - 1, prev + 1));
      } else if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        const val = inputHistoryRef.current[inputHistoryRef.current.length - 1 - historyIndexRef.current];
        setInputAndSuggestions(val);
      } else {
        historyIndexRef.current = -1;
        setInputAndSuggestions('');
      }
      return;
    }

    // Enter: execute highlighted suggestion, or submit input
    if (key.return) {
      // Resolve what to execute: suggestion or typed input
      let cmdToExecute: string | null = null;

      if (suggestions.length > 0 && suggestionIndex >= 0) {
        const selected = suggestions[suggestionIndex]!;
        const needsArg = ['/make', '/edit', '/load'].includes(selected.name);
        if (needsArg) {
          // Commands that need arguments: fill input so user can type the arg
          setInputAndSuggestions(selected.name + ' ');
          return;
        }
        cmdToExecute = selected.name;
      }

      if (!cmdToExecute) {
        if (input.trim().length === 0) return;
        if (streamingRef.current) return;
        const userInput = input.trim();
        if (userInput.startsWith('/')) {
          const cmd = SLASH_COMMANDS.find(c => c.name === userInput || c.alias?.includes(userInput));
          if (cmd) cmdToExecute = cmd.name;
        }
      }

      if (cmdToExecute) {
        addMessage({ type: 'user', content: cmdToExecute });
        inputHistoryRef.current.push(cmdToExecute);
        historyIndexRef.current = -1;
        setInputAndSuggestions('');
        executeCommand(cmdToExecute);
        return;
      }

      // Regular message → send to agent
      const userInput = input.trim();
      addMessage({ type: 'user', content: userInput });
      inputHistoryRef.current.push(userInput);
      historyIndexRef.current = -1;
      setInputAndSuggestions('');
      const agent = agentRef.current;
      agent.context.pattern = pattern;

      if (agent.hasLLM) {
        streamingRef.current = true;
        setIsStreaming(true);
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
                  addMessage({ type: 'tool', content: `▸ ${event.name}` });
                  break;
                case 'tool_result':
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.type === 'tool') {
                      return [...prev.slice(0, -1), { type: 'tool', content: `▸ ${event.name} → ${event.result}` }];
                    }
                    return [...prev, { type: 'tool', content: `▸ ${event.name} → ${event.result}` }];
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
            addMessage({ type: 'error', content: err.message });
          } finally {
            streamingRef.current = false;
            setIsStreaming(false);
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
            if (response.pattern && response.pattern !== pattern) setPattern(response.pattern);
            if (response.action === 'play') handlePlay();
            else if (response.action === 'stop') handleStop();
          } catch (err: any) {
            addMessage({ type: 'error', content: err.message });
          }
        })();
      }
      return;
    }

    // Backspace
    if (key.backspace) {
      setInput(prev => {
        const next = prev.slice(0, -1);
        updateSuggestions(next);
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
        updateSuggestions(next);
        return next;
      });
    }
  });

  // ── Layout ──
  const sidebarWidth = Math.max(28, Math.min(50, Math.floor(columns * 0.32)));
  const mainWidth = columns - sidebarWidth;

  const headerHeight = 3;
  const inputHeight = 1;
  const footerHeight = 1;
  const bottomPad = 1; // breathing room below footer (like Claude Code)
  // Suggestions take 1 line per visible command (max 5) + 1 separator
  const suggestionHeight = suggestions.length > 0 ? Math.min(suggestions.length, 5) + 1 : 0;
  const chromeHeight = headerHeight + inputHeight + footerHeight + bottomPad + suggestionHeight;
  const contentHeight = rows - chromeHeight;

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {/* ── Header ── */}
      <StatusBar
        playing={playing}
        bpm={bpm}
        patternName={patternName}
        mode={agentRef.current.hasLLM ? 'llm' : 'keyword'}
        streaming={isStreaming}
        model={modelName}
        width={columns}
      />

      {/* ── Content: pattern + chat (or config panel overlay) ── */}
      {configPanel ? (
        <Box flexDirection="column" height={contentHeight} paddingX={1} paddingTop={1}>
          <InlineConfig
            mode={configPanel}
            onClose={handleConfigClose}
            width={columns}
            height={contentHeight}
          />
        </Box>
      ) : (
        <Box flexDirection="row" height={contentHeight}>
          <PatternEditor code={pattern} maxWidth={mainWidth} />
          <MessageHistory messages={messages} height={contentHeight} width={sidebarWidth} />
        </Box>
      )}

      {/* ── Autocomplete suggestions (above input) ── */}
      {suggestions.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.border}>{'─'.repeat(columns - 2)}</Text>
          {suggestions.slice(0, 5).map((cmd, idx) => {
            const isSelected = idx === suggestionIndex;
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
                <Text color={colors.textDim}>{cmd.description}</Text>
              </Text>
            );
          })}
        </Box>
      )}

      {/* ── Input (always at bottom) ── */}
      <Box paddingX={1}>
        <Text color={colors.primary} bold>{'>'} </Text>
        <Text>{input}</Text>
        <Text color={colors.textDim}>▌</Text>
      </Box>

      {/* ── Footer ── */}
      <Box paddingX={1}>
        <Text color={colors.textMuted}>
          {agentRef.current.hasLLM ? '◆ AI' : '◇ keyword'}
          {'  ·  '}ctrl+p play{'  ·  '}ctrl+s save{'  ·  '}/help
          {suggestions.length > 0 ? '  ·  tab select' : ''}
        </Text>
      </Box>

      {/* ── Bottom padding (breathing room) ── */}
      <Box height={bottomPad} />
    </Box>
  );
};

export default App;
