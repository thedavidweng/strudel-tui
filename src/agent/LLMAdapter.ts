import { OpenAIClient, type ChatMessage } from '../llm/OpenAIClient.js';
import { ChatHistory } from '../llm/ChatHistory.js';
import { STRUDEL_TOOLS } from '../llm/tools.js';
import { ToolExecutor } from './ToolExecutor.js';
import { PatternOwner } from '../pattern/PatternOwner.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import type { AgentEventHandler, AgentResponse } from './Agent.js';

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

  get hasLLM(): boolean {
    return true;
  }

  get chatHistory(): readonly ChatMessage[] {
    return this._chat.messages;
  }

  clearHistory(): void {
    this._chat.clear();
  }

  async processMessageStreaming(
    message: string,
    currentPattern: string,
    onEvent: AgentEventHandler,
    signal?: AbortSignal,
  ): Promise<void> {
    this._chat.addUser(message);

    // Add current pattern context to the request's last user message
    const contextSuffix = currentPattern
      ? `\n\nCurrent pattern:\n\`\`\`\n${currentPattern}\n\`\`\``
      : '\n\nNo pattern loaded.';

    let fullText = '';
    const pendingToolCalls: Map<string, { name: string; arguments: string }> = new Map();

    try {
      const stream = this._llm.streamChat(this._chat.forRequest(contextSuffix), STRUDEL_TOOLS, signal);

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

            const args = parseToolArgs(tc.name, tc.arguments);
            onEvent({ type: 'tool_call', name: tc.name, args });

            const result = await this._executor.executeTool(tc.name, args);
            onEvent({ type: 'tool_result', name: tc.name, result });

            this._chat.addToolCall(event.id, tc.name, tc.arguments, result);
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

      // Process any remaining tool calls (stream ended without tool_call_end)
      if (pendingToolCalls.size > 0) {
        for (const [id, tc] of pendingToolCalls) {
          const args = parseToolArgs(tc.name, tc.arguments);
          onEvent({ type: 'tool_call', name: tc.name, args });
          const result = await this._executor.executeTool(tc.name, args);
          onEvent({ type: 'tool_result', name: tc.name, result });
          this._chat.addToolCall(id, tc.name, tc.arguments, result);
        }

        // Get final response after tool execution
        const followUp = this._llm.streamChat(this._chat.forRequest(''), STRUDEL_TOOLS, signal);
        let followUpText = '';
        for await (const ev of followUp) {
          if (ev.type === 'text_delta') {
            followUpText += ev.delta;
            onEvent({ type: 'text_delta', delta: ev.delta });
          }
        }
        if (followUpText) {
          this._chat.addAssistant(followUpText);
        }
      } else if (fullText) {
        this._chat.addAssistant(fullText);
      }

      const response: AgentResponse = {
        action: 'llm',
        message: fullText || 'Done.',
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
}

function parseToolArgs(name: string, raw: string): Record<string, any> {
  try {
    return JSON.parse(raw);
  } catch (err: unknown) {
    console.warn('[LLMAdapter] malformed tool arguments for', name, ':', err instanceof Error ? err.message : err);
    return {};
  }
}
