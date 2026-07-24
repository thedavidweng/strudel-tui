import { OpenAIClient } from '../llm/OpenAIClient.js';
import { ChatHistory } from '../llm/ChatHistory.js';
import { STRUDEL_TOOLS } from '../llm/tools.js';
import { ToolExecutor } from './ToolExecutor.js';
import { PatternOwner } from '../pattern/PatternOwner.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import type { AgentEventHandler, AgentResponse } from './Agent.js';

/**
 * Upper bound on model→tools→model round trips for one user message. On the
 * last round the model gets no tools, forcing a text answer.
 */
const MAX_TOOL_ROUNDS = 5;

interface RoundOutcome {
  text: string;
  ranTools: boolean;
  errored: boolean;
}

export class LLMAdapter {
  private _llm: OpenAIClient;
  private _executor: ToolExecutor;
  private _patterns: PatternOwner;
  private _chat: ChatHistory;

  constructor(executor: ToolExecutor, patterns: PatternOwner, config: StrudelConfig & { apiKey: string }) {
    this._executor = executor;
    this._patterns = patterns;
    this._llm = new OpenAIClient(config);
    this._chat = new ChatHistory();
  }

  async processMessageStreaming(
    message: string,
    currentPattern: string,
    onEvent: AgentEventHandler,
    signal?: AbortSignal,
  ): Promise<void> {
    this._chat.addUser(message);

    const contextSuffix = currentPattern
      ? `\n\nCurrent pattern:\n\`\`\`\n${currentPattern}\n\`\`\``
      : '\n\nNo pattern loaded.';

    let combinedText = '';

    try {
      let suffix = contextSuffix;
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const outcome = await this._streamRound(suffix, onEvent, signal, round === MAX_TOOL_ROUNDS);
        suffix = '';

        if (outcome.text) {
          combinedText += (combinedText ? '\n' : '') + outcome.text;
          this._chat.addAssistant(outcome.text);
        }
        if (outcome.errored) return;
        if (!outcome.ranTools) break;
      }

      const response: AgentResponse = {
        action: 'llm',
        message: combinedText || 'Done.',
        pattern: this._patterns.currentPattern,
      };
      onEvent({ type: 'done', response });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorMsg = `LLM error: ${msg}`;
      onEvent({ type: 'error', error: errorMsg });
      onEvent({ type: 'done', response: { action: 'error', message: errorMsg, error: msg } });
    }
  }

  private async _streamRound(
    contextSuffix: string,
    onEvent: AgentEventHandler,
    signal: AbortSignal | undefined,
    finalRound: boolean,
  ): Promise<RoundOutcome> {
    const pendingToolCalls: Map<string, { name: string; arguments: string }> = new Map();
    let text = '';
    let ranTools = false;

    const stream = this._llm.streamChat(
      this._chat.forRequest(contextSuffix),
      finalRound ? undefined : STRUDEL_TOOLS,
      signal,
    );

    for await (const event of stream) {
      switch (event.type) {
        case 'text_delta':
          text += event.delta;
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
          await this._runTool(event.id, tc.name, tc.arguments, onEvent);
          pendingToolCalls.delete(event.id);
          ranTools = true;
          break;
        }

        case 'done':
          break;

        case 'error':
          onEvent({ type: 'error', error: event.error });
          return { text, ranTools, errored: true };
      }
    }

    // The client flushes tool_call_end on finish, but guard against a stream
    // that ended without doing so.
    for (const [id, tc] of pendingToolCalls) {
      await this._runTool(id, tc.name, tc.arguments, onEvent);
      ranTools = true;
    }

    return { text, ranTools, errored: false };
  }

  private async _runTool(
    id: string,
    name: string,
    rawArgs: string,
    onEvent: AgentEventHandler,
  ): Promise<void> {
    const args = parseToolArgs(name, rawArgs);
    onEvent({ type: 'tool_call', name, args });
    const result = await this._executor.executeTool(name, args);
    onEvent({ type: 'tool_result', name, result });
    this._chat.addToolCall(id, name, rawArgs, result);
  }
}

function parseToolArgs(name: string, raw: string): Record<string, any> {
  try {
    return JSON.parse(raw);
  } catch (err: unknown) {
    console.warn('[LLMAdapter] malformed tool arguments for', name, ':', err instanceof Error ? err.message : err);
    return {};
  }
}
