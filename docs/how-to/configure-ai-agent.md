# How to: Connect an AI agent

Without an API key, strudel-tui runs in **keyword mode**: fixed commands and edit
instructions only. With an API key, you can type plain English — `make a jazzy
drum loop at 120 bpm` — and the agent generates and edits patterns for you.

Any OpenAI-compatible API works: OpenAI, DeepSeek, Moonshot (Kimi), Zhipu (GLM),
Qwen (Tongyi), OpenRouter, or a local server such as Ollama.

> All terminal output below is captured from real runs of
> `bun run src/index.ts` (strudel-tui v0.1.0), with colors removed.

---

## Scenario: set up with the interactive wizard

You have an API key and want guided setup.

```bash
strudel-tui config init
```

A full-screen wizard walks you through picking a provider and entering your key.
Finish with save (`Configuration saved.`) or cancel (`Configuration cancelled.`).

**Next step:** launch `strudel-tui` and check the status bar — the mode slot
now reads `◆ AI` with your model's name instead of `◇ keyword`.

## Scenario: set values directly

You know the provider settings and prefer one-liners.

```bash
$ strudel-tui config set apiKey sk-...
Set apiKey = ***
```

```bash
$ strudel-tui config set baseUrl https://api.deepseek.com/v1
Set baseUrl = https://api.deepseek.com/v1
```

```bash
$ strudel-tui config set model deepseek-chat
Set model = deepseek-chat
```

```bash
$ strudel-tui config set temperature 0.8
Set temperature = 0.8
```

Note that `apiKey` is masked in the confirmation; `temperature` and `maxTokens`
are parsed as numbers. Setting an unknown key fails loudly rather than silently
writing junk:

```bash
$ strudel-tui config set foo bar
Invalid key "foo". Valid keys: apiKey, baseUrl, model, temperature, maxTokens
```
*(exit code 1)*

**Next step:** verify with [`config show`](#scenario-check-whats-configured).

## Scenario: check what's configured

You want to confirm what strudel-tui will use on next launch.

```bash
$ strudel-tui config show
Strudel-TUI Configuration:
  apiKey:      (not set)
  baseUrl:     https://api.openai.com/v1
  model:       gpt-4o
  temperature: 0.7
  maxTokens:   4096

Config file: ~/.strudel-tui/config.json
```

This is a fresh install: defaults everywhere and no key. After running the four
`config set` commands from the previous scenario, the same command reports:

```bash
$ strudel-tui config show
Strudel-TUI Configuration:
  apiKey:      (set)
  baseUrl:     https://api.deepseek.com/v1
  model:       deepseek-chat
  temperature: 0.8
  maxTokens:   4096

Config file: ~/.strudel-tui/config.json
```

**Next step:** if anything looks wrong, re-run `config set` for that key — see
[Reference: configuration](../reference/config.md) for every key, default, and
the override order between flags, environment variables, and this file.

## Scenario: don't store the key on disk

You'd rather keep the key out of `~/.strudel-tui/config.json`.

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.deepseek.com/v1
strudel-tui
```

Or for a single session only:

```bash
strudel-tui --api-key sk-... --base-url https://api.deepseek.com/v1 --model deepseek-chat
```

Flags beat environment variables, and both beat the config file — the full
priority order is in [Reference: configuration](../reference/config.md).

## Provider settings

| Provider | `baseUrl` | Example `model` |
|----------|-----------|-----------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Moonshot (Kimi) | `https://api.moonshot.cn/v1` | `moonshot-v1-auto` |
| Zhipu (GLM) | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| Qwen (Tongyi) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o` |
| Local (Ollama, etc.) | `http://localhost:11434/v1` | `llama3` |

---

## Next steps

- [Play audio through your browser](play-audio.md) — hear what the agent makes
- [Edit patterns](edit-patterns.md) — keyword edits still work alongside the agent
