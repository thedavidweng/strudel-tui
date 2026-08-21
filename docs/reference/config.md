# Reference: Configuration

Where strudel-tui keeps its settings, what they mean, and which source wins
when several are set.

> The config-file sample is captured from a real run of `config set` (with a
> throwaway example key); permissions shown are as created by the app.

## File location and permissions

`~/.strudel-tui/config.json`, created on first `config set` or `config init`:

```json
{
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "sk-example-1234567890",
  "temperature": 0.8
}
```

The file is written with `0600` permissions, the directory with `0700` — only
your user can read them.

## Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiKey` | string | `""` (empty = keyword mode) | API key for the LLM provider |
| `baseUrl` | string | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `model` | string | `gpt-4o` | Model name |
| `temperature` | number | `0.7` | Sampling temperature |
| `maxTokens` | number | `4096` | Maximum response tokens |

An empty `apiKey` is what puts the TUI in keyword mode; setting any non-empty
key switches it to LLM mode. See
[How to: Connect an AI agent](../how-to/configure-ai-agent.md) for provider
settings per vendor.

## Priority

When the same value comes from several places, highest wins:

1. **CLI flags** — `--api-key`, `--base-url`, `--model`
2. **Environment variables** — `OPENAI_API_KEY`, `OPENAI_BASE_URL`
3. **Config file** — `~/.strudel-tui/config.json`
4. **Built-in defaults** — the table above

`config show` reports the config file plus defaults — it does not know about
flags or environment variables you might pass at launch.
