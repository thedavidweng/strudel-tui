import type { ChatMessage } from './OpenAIClient.js';
import { SYSTEM_PROMPT } from './tools.js';

export class ChatHistory {
  private _messages: ChatMessage[] = [];

  constructor() {
    this._messages.push({ role: 'system', content: SYSTEM_PROMPT });
  }

  get messages(): readonly ChatMessage[] {
    return this._messages;
  }

  clear(): void {
    this._messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  addUser(content: string): void {
    this._messages.push({ role: 'user', content });
  }

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

  addAssistant(content: string): void {
    this._messages.push({ role: 'assistant', content });
  }

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
