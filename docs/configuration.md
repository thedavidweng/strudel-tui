# Configuration

strudel-tui stores its configuration in `~/.strudel-tui/config.json`. The file is created automatically when you run `strudel-tui config init` or `strudel-tui config set`.

## Configuration File

Location: `~/.strudel-tui/config.json`

```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

The file has `0600` permissions (owner read/write only). The directory has `0700` permissions.

## Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiKey` | string | `""` | API key for the LLM provider |
| `baseUrl` | string | `https://api.openai.com/v1` | OpenAI-compatible API endpoint |
| `model` | string | `gpt-4o` | Model name |
| `temperature` | number | `0.7` | Sampling temperature (0.0–2.0) |
| `maxTokens` | number | `4096` | Maximum tokens in the response |

## Configuration Priority

Values are resolved in this order (highest priority first):

1. **CLI flags** — `--api-key`, `--base-url`, `--model`
2. **Environment variables** — `OPENAI_API_KEY`, `OPENAI_BASE_URL`
3. **Config file** — `~/.strudel-tui/config.json`
4. **Defaults** — Built-in defaults

## Setting Configuration

### Interactive Wizard

```bash
strudel-tui config init
```

Walks you through selecting a provider and entering your API key step by step.

### Command Line

```bash
strudel-tui config set apiKey sk-...
strudel-tui config set baseUrl https://api.deepseek.com/v1
strudel-tui config set model deepseek-chat
```

### Environment Variables

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.deepseek.com/v1
strudel-tui
```

### CLI Flags (one-time override)

```bash
strudel-tui --api-key sk-... --model gpt-4o-mini
```

## Supported Providers

Any OpenAI-compatible API works. Common providers:

| Provider | baseUrl | Example Model |
|----------|---------|---------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Moonshot (Kimi) | `https://api.moonshot.cn/v1` | `moonshot-v1-auto` |
| Zhipu (GLM) | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| Qwen (Tongyi) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o` |
| Local (Ollama, etc.) | `http://localhost:11434/v1` | `llama3` |

## Without an API Key

strudel-tui works without an API key. In this mode, the agent uses keyword-based routing:

- `play`, `stop`, `make`, `edit`, `validate`, `undo`, `redo`, `help`
- Direct pattern code input
- Simple edit instructions (`faster`, `add reverb`, etc.)

The AI agent is strictly more capable — it understands natural language and can generate complex patterns.
