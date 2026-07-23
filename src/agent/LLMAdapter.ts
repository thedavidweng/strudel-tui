import { OpenAIClient, type ChatMessage } from '../llm/OpenAIClient.js';
import { STRUDEL_TOOLS, SYSTEM_PROMPT } from '../llm/tools.js';
import { ToolExecutor } from './ToolExecutor.js';
import { PatternOwner } from '../pattern/PatternOwner.js';
import type { StrudelConfig } from '../config/ConfigManager.js';
import type { AgentEventHandler, AgentResponse } from './Agent.js';

export class LLMAdapter {
  private _llm: OpenAIClient;
  private _executor: ToolExecutor;
  private _patterns: PatternOwner;
  private _chatHistory: ChatMessage[] = [];

  constructor(executor: ToolExecutor, patterns: PatternOwner, config: StrudelConfig & { apiKey: string }) {
    this._executor = executor;
    this._patterns = patterns;
    this._llm = new OpenAIClient(config);
    this._chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
  }

  get hasLLM(): boolean {
    return true;
  }

  get chatHistory(): readonly ChatMessage[] {
    return this._chatHistory;
  }

  clearHistory(): void {
    this._chatHistory = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  async processMessageStreaming(
    message: string,
    currentPattern: string,
    onEvent: AgentEventHandler,
    signal?: AbortSignal,
  ): Promise<void> {
    this._chatHistory.push({ role: 'user', content: message });

    // Add current pattern context
    const contextMsg = currentPattern
      ? `\n\nCurrent pattern:\n\`\`\`\n${currentPattern}\n\`\`\``
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
            } catch (err: unknown) {
              console.warn('[LLMAdapter] malformed tool arguments for', tc.name, ':', err instanceof Error ? err.message : err);
            }

            onEvent({ type: 'tool_call', name: tc.name, args });

            const result = await this._executor.executeTool(tc.name, args);
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

      // Process any remaining tool calls
      if (pendingToolCalls.size > 0) {
        for (const [id, tc] of pendingToolCalls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.arguments); } catch (err: unknown) {
            console.warn('[LLMAdapter] malformed tool arguments for', tc.name, ':', err instanceof Error ? err.message : err);
          }
          onEvent({ type: 'tool_call', name: tc.name, args });
          const result = await this._executor.executeTool(tc.name, args);
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
