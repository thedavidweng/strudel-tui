import type { StrudelConfig } from '../config/ConfigManager.js';
import { SSEParser } from './SSEParser.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface ChatCompletionChunk {
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; arguments_delta: string }
  | { type: 'tool_call_end'; id: string; name: string; arguments: string }
  | { type: 'done'; finish_reason: string }
  | { type: 'error'; error: string };

export interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
}

export async function fetchModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const url = baseUrl.replace(/\/+$/, '') + '/models';
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as { data: Array<{ id: string; name?: string; owned_by?: string }> };
  return (data.data || [])
    .map(m => ({ id: m.id, name: m.name || m.id, owned_by: m.owned_by }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: StrudelConfig & { apiKey: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl!.replace(/\/+$/, '');
    this.model = config.model!;
    this.temperature = config.temperature!;
    this.maxTokens = config.maxTokens!;
  }

  async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const body: Record<string, any> = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `API error ${response.status}: ${errorText}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const parser = new SSEParser(response.body);

    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      let data: string | null;
      while ((data = await parser.next()) !== null) {
        if (data === '[DONE]') {
          for (const [_index, tc] of toolCalls) {
            yield {
              type: 'tool_call_end',
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            };
          }
          yield { type: 'done', finish_reason: 'stop' };
          return;
        }

        try {
          const chunk: ChatCompletionChunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            yield { type: 'text_delta', delta: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index;
              if (!toolCalls.has(index)) {
                toolCalls.set(index, {
                  id: tc.id || `call_${index}`,
                  name: tc.function?.name || '',
                  arguments: '',
                });
                if (tc.id && tc.function?.name) {
                  yield {
                    type: 'tool_call_start',
                    id: tc.id,
                    name: tc.function.name,
                  };
                }
              }

              const existing = toolCalls.get(index)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) {
                existing.arguments += tc.function.arguments;
                yield {
                  type: 'tool_call_delta',
                  id: existing.id,
                  arguments_delta: tc.function.arguments,
                };
              }
            }
          }

          if (chunk.choices[0]?.finish_reason) {
            for (const [_index, tc] of toolCalls) {
              yield {
                type: 'tool_call_end',
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              };
            }
            yield { type: 'done', finish_reason: chunk.choices[0].finish_reason };
            return;
          }
        } catch (err: unknown) {
          if (data !== '[DONE]') {
            console.warn('[OpenAIClient] skipping malformed SSE chunk:', err instanceof Error ? err.message : err);
          }
        }
      }
    } finally {
      parser.release();
    }
  }
}
