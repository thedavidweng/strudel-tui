import type { ChatMessage } from './OpenAIClient.js';
import { SYSTEM_PROMPT } from './tools.js';

/**
 * ChatHistory — owns the OpenAI wire-format message list for one
 * conversation.
 *
 * Encapsulates the message-shape invariants the OpenAI chat completions
 * API requires: a system prompt first, tool-call assistant messages
 * paired with their tool-result messages, and the context-suffix
 * injection that appends the current pattern to the last user message
 * when building a request.  Callers never push raw ChatMessage objects
 * — they call `addUser`, `addToolCall`, `addToolResult`, `addAssistant`.
 */
export class ChatHistory {
  private _messages: ChatMessage[] = [];

  constructor() {
    this._messages.push({ role: 'system', content: SYSTEM_PROMPT });
  }

  /** All stored messages (read-only). */
  get messages(): readonly ChatMessage[] {
    return this._messages;
  }

  /** Reset to just the system prompt. */
  clear(): void {
    this._messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  /** Append a user message. */
  addUser(content: string): void {
    this._messages.push({ role: 'user', content });
  }

  /**
   * Append the assistant message that records a tool call, immediately
   * followed by the tool-result message that answers it.  The two are
   * always paired — the API requires a tool result for every tool call id.
   */
  addToolCall(id: string, name: string, args: string, result: string): void {
    this._messages.push({
      role: 'assistant',
      content: '',
      tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
    });
    this._messages.push({
      role: 'tool',
      content: result,
      tool_call_id: id,
    });
  }

  /** Append a final assistant text response. */
  addAssistant(content: string): void {
    this._messages.push({ role: 'assistant', content });
  }

  /**
   * Return the message list to send to the API.  If the last stored
   * message is a user message, `contextSuffix` is appended to its
   * content (used to inject the current pattern).  The stored history
   * is not mutated — a fresh array is returned.
   */
  forRequest(contextSuffix: string): ChatMessage[] {
    if (this._messages.length === 0) return [];
    const last = this._messages[this._messages.length - 1]!;
    if (last.role === 'user' && contextSuffix) {
      return [
        ...this._messages.slice(0, -1),
        { role: 'user', content: last.content + contextSuffix },
      ];
    }
    return [...this._messages];
  }
}
