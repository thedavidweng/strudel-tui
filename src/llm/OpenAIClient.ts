import type { StrudelConfig } from '../config/ConfigManager.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
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

export interface ChatCompletionChunk {
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

export interface ChatCompletionResponse {
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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

/**
 * Fetch available models from an OpenAI-compatible API.
 * GET /models with Bearer auth.
 */
export async function fetchModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const url = baseUrl.replace(/\/+$/, '') + '/models';
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as { data: Array<{ id: string; name?: string; owned_by?: string }> };
  const models = (data.data || [])
    .map(m => ({ id: m.id, name: m.name || m.id, owned_by: m.owned_by }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: StrudelConfig & { apiKey: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = config.model || 'gpt-4o';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
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

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    // Accumulate tool calls across chunks
    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            // Emit accumulated tool calls
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
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
