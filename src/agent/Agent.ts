import { StrudelEngineWrapper } from '../engine/StrudelEngineWrapper.js';
import { PatternLoader } from '../engine/PatternLoader.js';
import { SessionHistory } from './SessionHistory.js';
import { DiffGenerator } from './DiffGenerator.js';
import { formatHelp } from './HelpText.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { OpenAIClient, type ChatMessage, type StreamEvent } from '../llm/OpenAIClient.js';
import { STRUDEL_TOOLS, SYSTEM_PROMPT } from '../llm/tools.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentResponse {
  action: string;
  message: string;
  pattern?: string;
  error?: string;
}

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; name: string; args: Record<string, any> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'pattern_update'; pattern: string }
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: string };

export type AgentEventHandler = (event: AgentEvent) => void;

// Legacy interface kept for backward compat
export interface AgentContext {
  pattern: string;
  history: string[];
}

// ---------------------------------------------------------------------------
// Intent detection (fallback when no LLM)
// ---------------------------------------------------------------------------

type Intent =
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'generate'; description: string }
  | { type: 'edit'; instruction: string }
  | { type: 'validate' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'help' }
  | { type: 'pattern'; code: string };

const PLAY_RE = /^\s*(play|start|go)\b/i;
const STOP_RE = /^\s*(stop|pause|hush)\b/i;
const GENERATE_RE = /^\s*(make|create|generate)\s+(.+)/i;
const EDIT_RE = /^\s*(edit|change|modify)\s+(.+)/i;
const VALIDATE_RE = /^\s*(validate|check)\b/i;
const UNDO_RE = /^\s*undo\b/i;
const REDO_RE = /^\s*redo\b/i;
const HELP_RE = /^\s*help\b/i;

function detectIntent(message: string): Intent {
  let m: RegExpMatchArray | null;
  if (HELP_RE.test(message)) return { type: 'help' };
  if (PLAY_RE.test(message)) return { type: 'play' };
  if (STOP_RE.test(message)) return { type: 'stop' };
  if (UNDO_RE.test(message)) return { type: 'undo' };
  if (REDO_RE.test(message)) return { type: 'redo' };
  if (VALIDATE_RE.test(message)) return { type: 'validate' };
  m = message.match(GENERATE_RE);
  if (m) return { type: 'generate', description: m[2].trim() };
  m = message.match(EDIT_RE);
  if (m) return { type: 'edit', instruction: m[2].trim() };
  return { type: 'pattern', code: message };
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class Agent {
  context: AgentContext;
  private _engine: StrudelEngineWrapper;
  private _history: SessionHistory;
  private _diffGen: DiffGenerator;
  private _loader: PatternLoader;
  private _llm: OpenAIClient | null;
  private _chatHistory: ChatMessage[] = [];

  constructor(initialPattern = '', sessionId?: string, configOverrides?: Partial<StrudelConfig>) {
    this.context = { pattern: initialPattern, history: [] };
    this._engine = new StrudelEngineWrapper();
    this._history = new SessionHistory(sessionId);
    this._diffGen = new DiffGenerator();
    this._loader = new PatternLoader();

    if (initialPattern) {
      this._history.pushPattern(initialPattern);
    }

    // Initialize LLM if config is available
    const config = new ConfigManager(configOverrides);
    if (config.isConfigured()) {
      this._llm = new OpenAIClient(config.getAll() as StrudelConfig & { apiKey: string });
      this._chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    } else {
      this._llm = null;
    }
  }

  get hasLLM(): boolean {
    return this._llm !== null;
  }

  get sessionHistory(): SessionHistory {
    return this._history;
  }

  // -------------------------------------------------------------------------
  // Main entry: streaming mode (LLM)
  // -------------------------------------------------------------------------

  async processUserMessageStreaming(
    message: string,
    onEvent: AgentEventHandler,
    signal?: AbortSignal,
  ): Promise<void> {
    this._history.addMessage('user', message);
    this.context.history.push(message);

    if (!this._llm) {
      // Fallback to keyword-based routing
      const response = await this._processKeyword(message);
      onEvent({ type: 'done', response });
      return;
    }

    // LLM mode
    this._chatHistory.push({ role: 'user', content: message });

    // Add current pattern context
    const contextMsg = this.context.pattern
      ? `\n\nCurrent pattern:\n\`\`\`\n${this.context.pattern}\n\`\`\``
      : '\n\nNo pattern loaded.';

    const messages: ChatMessage[] = [
      ...this._chatHistory.slice(0, -1),
      { role: 'user', content: message + contextMsg },
    ];

    let fullText = '';
    const pendingToolCalls: Map<string, { name: string; arguments: string }> = new Map();

    try {
      const stream = this._llm.streamChat(messages, STRUDEL_TOOLS, signal);

      for await (const event of stream) {
        switch (event.type) {
          case 'text_delta':
            fullText += event.delta;
            onEvent({ type: 'text_delta', delta: event.delta });
            break;

          case 'tool_call_start':
            pendingToolCalls.set(event.id, { name: event.name, arguments: '' });
            break;

          case 'tool_call_delta': {
            const tc = pendingToolCalls.get(event.id);
            if (tc) tc.arguments += event.arguments_delta;
            break;
          }

          case 'tool_call_end': {
            const tc = pendingToolCalls.get(event.id);
            if (!tc) break;

            let args: Record<string, any> = {};
            try {
              args = JSON.parse(tc.arguments);
            } catch {}

            onEvent({ type: 'tool_call', name: tc.name, args });

            const result = await this._executeTool(tc.name, args);
            onEvent({ type: 'tool_result', name: tc.name, result });

            // Feed tool result back for next turn
            this._chatHistory.push({
              role: 'assistant',
              content: '',
              tool_calls: [{ id: event.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }],
            });
            this._chatHistory.push({
              role: 'tool',
              content: result,
              tool_call_id: event.id,
            });

            pendingToolCalls.delete(event.id);
            break;
          }

          case 'done':
            break;

          case 'error':
            onEvent({ type: 'error', error: event.error });
            return;
        }
      }

      // If there were tool calls, continue the conversation to get the final response
      if (pendingToolCalls.size > 0) {
        // Process any remaining tool calls
        for (const [id, tc] of pendingToolCalls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.arguments); } catch {}
          onEvent({ type: 'tool_call', name: tc.name, args });
          const result = await this._executeTool(tc.name, args);
          onEvent({ type: 'tool_result', name: tc.name, result });
          this._chatHistory.push({
            role: 'assistant', content: '',
            tool_calls: [{ id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }],
          });
          this._chatHistory.push({ role: 'tool', content: result, tool_call_id: id });
        }

        // Get final response after tool execution
        const followUp = this._llm.streamChat(this._chatHistory, STRUDEL_TOOLS, signal);
        let followUpText = '';
        for await (const ev of followUp) {
          if (ev.type === 'text_delta') {
            followUpText += ev.delta;
            onEvent({ type: 'text_delta', delta: ev.delta });
          }
        }
        if (followUpText) {
          this._chatHistory.push({ role: 'assistant', content: followUpText });
        }
      } else if (fullText) {
        this._chatHistory.push({ role: 'assistant', content: fullText });
      }

      const response: AgentResponse = {
        action: 'llm',
        message: fullText || 'Done.',
        pattern: this.context.pattern,
      };
      this._history.addMessage('agent', response.message);
      onEvent({ type: 'done', response });
    } catch (err: any) {
      const errorMsg = `LLM error: ${err.message}`;
      onEvent({ type: 'error', error: errorMsg });
      onEvent({ type: 'done', response: { action: 'error', message: errorMsg, error: err.message } });
    }
  }

  // -------------------------------------------------------------------------
  // Legacy entry: non-streaming (keyword fallback)
  // -------------------------------------------------------------------------

  async processUserMessage(message: string): Promise<AgentResponse> {
    this._history.addMessage('user', message);
    this.context.history.push(message);

    if (this._llm) {
      // LLM mode: collect full response
      let fullText = '';
      let lastResponse: AgentResponse = { action: 'llm', message: '' };

      await this.processUserMessageStreaming(message, (event) => {
        if (event.type === 'text_delta') fullText += event.delta;
        if (event.type === 'done') lastResponse = event.response;
      });

      return { ...lastResponse, message: fullText || lastResponse.message };
    }

    return this._processKeyword(message);
  }

  // -------------------------------------------------------------------------
  // Keyword-based routing (fallback)
  // -------------------------------------------------------------------------

  private async _processKeyword(message: string): Promise<AgentResponse> {
    const intent = detectIntent(message);
    let response: AgentResponse;

    try {
      switch (intent.type) {
        case 'play': response = this._handlePlay(); break;
        case 'stop': response = this._handleStop(); break;
        case 'generate': response = await this._handleGenerate(intent.description); break;
        case 'edit': response = await this._handleEdit(intent.instruction); break;
        case 'validate': response = await this._handleValidate(); break;
        case 'undo': response = this._handleUndo(); break;
        case 'redo': response = this._handleRedo(); break;
        case 'help': response = this._handleHelp(); break;
        case 'pattern': response = await this._handlePattern(intent.code); break;
        default: response = { action: 'unknown', message: 'Could not understand input.', error: 'Unknown intent' };
      }
    } catch (err: any) {
      response = { action: 'error', message: `Error: ${err.message}`, error: err.message };
    }

    this._history.addMessage('agent', response.message);
    this._history.save().catch(() => {});
    return response;
  }

  // -------------------------------------------------------------------------
  // Tool execution (for LLM mode)
  // -------------------------------------------------------------------------

  private async _executeTool(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'play_pattern': {
        if (args.code) {
          const validation = await this._engine.validate(args.code);
          if (!validation.valid) {
            return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
          }
          this._setPattern(args.code);
          return `Pattern set. Ready to play: ${args.code}`;
        }
        return `Playing current pattern: ${this.context.pattern}`;
      }

      case 'stop_playback':
        return 'Playback stopped.';

      case 'validate_pattern': {
        const result = await this._engine.validate(args.code);
        if (result.valid) {
          const info = await this._engine.getPatternInfo(args.code);
          const infoStr = info ? ` (${info.eventCount} events, ${info.voices} voice${info.voices !== 1 ? 's' : ''})` : '';
          return `Valid pattern${infoStr}.`;
        }
        return `Invalid: ${result.errors?.map(e => e.message).join('; ')}`;
      }

      case 'generate_pattern': {
        const pattern = this._engine.generateFromSeed(args.description);
        this._setPattern(pattern);
        return `Generated: ${pattern}`;
      }

      case 'edit_pattern': {
        const edited = this._applyEditHeuristic(this.context.pattern, args.instruction);
        if (edited === this.context.pattern) {
          return 'Could not apply that edit. Try being more specific or edit the pattern directly.';
        }
        const validation = await this._engine.validate(edited);
        if (!validation.valid) {
          return `Edit produced invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
        }
        this._setPattern(edited);
        return `Pattern edited: ${edited}`;
      }

      case 'set_pattern': {
        const validation = await this._engine.validate(args.code);
        if (!validation.valid) {
          return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
        }
        this._setPattern(args.code);
        return `Pattern set: ${args.code}`;
      }

      case 'get_pattern_info': {
        if (!this.context.pattern.trim()) return 'No pattern loaded.';
        const info = await this._engine.getPatternInfo(this.context.pattern);
        if (!info) return 'Could not analyze pattern.';
        return `Pattern info: ${info.eventCount} events, ${info.voices} voice(s): ${info.voiceNames.join(', ')}`;
      }

      case 'list_patterns': {
        const patterns = await this._loader.listPatterns();
        if (patterns.length === 0) return 'No pattern files found.';
        return `Available patterns:\n${patterns.map(p => `  - ${p.name}`).join('\n')}`;
      }

      case 'load_pattern': {
        try {
          const dir = this._loader.getDefaultPatternDir();
          const filePath = `${dir}/${args.name}.strudel`;
          const code = await this._loader.loadPattern(filePath);
          this._setPattern(code);
          return `Loaded "${args.name}": ${code}`;
        } catch (err: any) {
          return `Could not load pattern "${args.name}": ${err.message}`;
        }
      }

      case 'save_pattern': {
        if (!this.context.pattern.trim()) return 'No pattern to save.';
        try {
          const dir = this._loader.getDefaultPatternDir();
          const filePath = `${dir}/${args.name}.strudel`;
          await this._loader.savePattern(filePath, this.context.pattern);
          return `Pattern saved as "${args.name}".`;
        } catch (err: any) {
          return `Could not save pattern: ${err.message}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  }

  // -------------------------------------------------------------------------
  // Generate diff (public, backward compat)
  // -------------------------------------------------------------------------

  async generateDiff(newPattern: string): Promise<{ diff: string; patched: string }> {
    const unified = this._diffGen.computeDiff(this.context.pattern, newPattern);
    return { diff: unified.text, patched: newPattern };
  }

  // -------------------------------------------------------------------------
  // Intent handlers (keyword fallback)
  // -------------------------------------------------------------------------

  private _handlePlay(): AgentResponse {
    return { action: 'play', message: 'Starting playback...', pattern: this.context.pattern };
  }

  private _handleStop(): AgentResponse {
    return { action: 'stop', message: 'Stopping playback.' };
  }

  private async _handleGenerate(description: string): Promise<AgentResponse> {
    const newPattern = this._engine.generateFromSeed(description);
    const validation = await this._engine.validate(newPattern);
    if (!validation.valid) {
      const preset = this._engine.generatePattern();
      this._setPattern(preset);
      return { action: 'generate', message: `Generated preset pattern: ${preset}`, pattern: preset };
    }
    this._setPattern(newPattern);
    return { action: 'generate', message: `Generated: ${newPattern}`, pattern: newPattern };
  }

  private async _handleEdit(instruction: string): Promise<AgentResponse> {
    if (!this.context.pattern.trim()) {
      return { action: 'edit', message: 'No pattern to edit.', error: 'No current pattern' };
    }
    const edited = this._applyEditHeuristic(this.context.pattern, instruction);
    if (edited === this.context.pattern) {
      return { action: 'edit', message: `Could not apply edit "${instruction}".`, pattern: this.context.pattern };
    }
    const validation = await this._engine.validate(edited);
    if (!validation.valid) {
      const errMsg = validation.errors?.map(e => e.message).join('; ') ?? 'Unknown error';
      return { action: 'edit', message: `Edit produced invalid pattern: ${errMsg}`, error: errMsg, pattern: this.context.pattern };
    }
    this._setPattern(edited);
    return { action: 'edit', message: `Pattern edited: ${edited}`, pattern: edited };
  }

  private async _handleValidate(): Promise<AgentResponse> {
    if (!this.context.pattern.trim()) return { action: 'validate', message: 'No pattern to validate.' };
    const result = await this._engine.validate(this.context.pattern);
    if (result.valid) {
      const info = await this._engine.getPatternInfo(this.context.pattern);
      const infoStr = info ? ` (${info.eventCount} events, ${info.voices} voice(s))` : '';
      return { action: 'validate', message: `Pattern is valid.${infoStr}`, pattern: this.context.pattern };
    }
    const errorLines = result.errors?.map(e => `  - ${e.message}`) ?? ['  - Unknown error'];
    return { action: 'validate', message: `Pattern has errors:\n${errorLines.join('\n')}`, error: result.errors?.map(e => e.message).join('; '), pattern: this.context.pattern };
  }

  private _handleUndo(): AgentResponse {
    const restored = this._history.undoPattern();
    if (restored === undefined) return { action: 'undo', message: 'Nothing to undo.' };
    this.context.pattern = restored;
    return { action: 'undo', message: 'Reverted to previous pattern.', pattern: restored };
  }

  private _handleRedo(): AgentResponse {
    const restored = this._history.redoPattern();
    if (restored === undefined) return { action: 'redo', message: 'Nothing to redo.' };
    this.context.pattern = restored;
    return { action: 'redo', message: 'Re-applied pattern.', pattern: restored };
  }

  private _handleHelp(): AgentResponse {
    return { action: 'help', message: formatHelp() };
  }

  private async _handlePattern(code: string): Promise<AgentResponse> {
    const result = await this._engine.validate(code);
    if (!result.valid) {
      const errMsg = result.errors?.map(e => e.message).join('; ') ?? 'Unknown error';
      return { action: 'pattern', message: `Invalid pattern: ${errMsg}`, error: errMsg };
    }
    this._setPattern(code);
    return { action: 'pattern', message: 'Pattern set.', pattern: code };
  }

  // -------------------------------------------------------------------------
  // Edit heuristics (shared by both modes)
  // -------------------------------------------------------------------------

  private _applyEditHeuristic(pattern: string, instruction: string): string {
    const lower = instruction.toLowerCase();
    if (lower.includes('faster') || lower.includes('speed up')) {
      if (pattern.includes('.slow(')) return pattern.replace(/\.slow\(([^)]+)\)/, (_, n) => `.fast(${n})`);
      return pattern.trimEnd() + '.fast(2)';
    }
    if (lower.includes('slower') || lower.includes('slow down')) {
      if (pattern.includes('.fast(')) return pattern.replace(/\.fast\(([^)]+)\)/, (_, n) => `.slow(${n})`);
      return pattern.trimEnd() + '.slow(2)';
    }
    if (lower.includes('louder') || lower.includes('volume up')) return pattern.trimEnd() + '.gain(1.5)';
    if (lower.includes('quieter') || lower.includes('softer')) return pattern.trimEnd() + '.gain(0.5)';
    if (lower.includes('reverse') || lower.includes('backwards')) return pattern.trimEnd() + '.rev()';
    if (lower.includes('reverb')) return pattern.trimEnd() + '.room(0.5)';
    if (lower.includes('delay')) return pattern.trimEnd() + '.delay(0.5)';
    if (lower.includes('distort')) return pattern.trimEnd() + '.distort(0.5)';
    if (lower.includes('filter') || lower.includes('low pass')) return pattern.trimEnd() + '.lpf(800)';
    if (lower.includes('high pass')) return pattern.trimEnd() + '.hpf(800)';
    if (lower.includes('remove last') || lower.includes('undo last')) {
      const match = pattern.match(/\.(\w+)\([^)]*\)\s*$/);
      if (match) return pattern.slice(0, match.index);
    }
    return pattern;
  }

  private _setPattern(pattern: string): void {
    this.context.pattern = pattern;
    this._history.pushPattern(pattern);
  }
}
