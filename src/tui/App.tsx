import React, { useState, useCallback, useRef } from 'react';
import { Box, useInput, useApp, useWindowSize } from 'ink';
import MessageHistory from './MessageHistory.js';
import type { Message } from './MessageHistory.js';
import PatternEditor from './PatternEditor.js';
import StatusBar from './StatusBar.js';
import InputBox from './InputBox.js';
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

const App: React.FC<AppProps> = ({ initialPattern, bpm = 130, debug = false, configOverrides }) => {
  const { exit } = useApp();
  const { rows } = useWindowSize();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { type: 'system', content: 'Welcome to Strudel-TUI. Type a pattern or command and press Enter.' },
  ]);
  const [pattern, setPattern] = useState(initialPattern ?? DEFAULT_PATTERN);
  const [playing, setPlaying] = useState(false);
  const [patternName, setPatternName] = useState('untitled');

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

    // Up arrow: scroll through input history
    if (key.upArrow) {
      if (inputHistoryRef.current.length > 0) {
        const idx = historyIndexRef.current + 1;
        if (idx < inputHistoryRef.current.length) {
          historyIndexRef.current = idx;
          setInput(inputHistoryRef.current[inputHistoryRef.current.length - 1 - idx]);
        }
      }
      return;
    }

    // Down arrow: scroll forward through input history
    if (key.downArrow) {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        setInput(inputHistoryRef.current[inputHistoryRef.current.length - 1 - historyIndexRef.current]);
      } else {
        historyIndexRef.current = -1;
        setInput('');
      }
      return;
    }

    // Enter: send input to agent
    if (key.return) {
      if (input.trim().length === 0) return;
      if (streamingRef.current) return; // Don't process while streaming

      const userInput = input.trim();
      addMessage({ type: 'user', content: userInput });
      inputHistoryRef.current.push(userInput);
      historyIndexRef.current = -1;
      setInput('');

      const agent = agentRef.current;
      agent.context.pattern = pattern;

      if (agent.hasLLM) {
        // Streaming mode
        streamingRef.current = true;
        let streamingText = '';
        const streamingMsgIdx = -1; // Will be set when first delta arrives

        (async () => {
          try {
            await agent.processUserMessageStreaming(userInput, (event) => {
              switch (event.type) {
                case 'text_delta':
                  streamingText += event.delta;
                  // Update the last agent message in place
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
                    // Update the last tool message with the result
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
                  // Finalize the streaming message
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
        // Keyword mode (non-streaming)
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

    // Backspace: delete last character
    if (key.backspace) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    // Ignore other control sequences
    if (key.ctrl || key.meta || key.tab || key.escape) return;

    // Append typed character
    if (inputKey.length > 0) {
      setInput(prev => prev + inputKey);
    }
  });

  // Layout: status bar (1) + message history (flex) + pattern editor (flex) + input (1)
  const reservedRows = 6;
  const availableRows = Math.max(10, rows - reservedRows);
  const historyHeight = Math.floor(availableRows / 2);
  const editorHeight = availableRows - historyHeight;

  return (
    <Box flexDirection="column" height={rows}>
      <StatusBar playing={playing} bpm={bpm} patternName={patternName} />
      <MessageHistory messages={messages} height={historyHeight} />
      <PatternEditor code={pattern} />
      <InputBox value={input} />
    </Box>
  );
};

export default App;
