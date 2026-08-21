# Reference: CLI

Every way to start and configure strudel-tui from the command line.

> All output blocks on this page are captured from real runs of
> `bun run src/index.ts` (strudel-tui v0.1.0) with `NO_COLOR=1`.

## `strudel-tui [OPTIONS]`

Launches the interactive TUI.

```bash
$ strudel-tui --help
Terminal-based live coding interface for Strudel with AI agent (strudel-tui v0.1.0)

USAGE strudel-tui [OPTIONS] config

OPTIONS

  -p, --pattern=<pattern>    Load a .strudel pattern file on startup
                  --debug    Enable debug logging (Default: false)
              --bpm=<bpm>    Set initial BPM (default 130) (Default: 130)
      --api-key=<api_key>    OpenAI-compatible API key (overrides config)
    --base-url=<base_url>    API base URL (overrides config)
          --model=<model>    Model name (overrides config)

COMMANDS

  config    Manage Strudel-TUI configuration

Use strudel-tui <command> --help for more information about a command.
```

| Option | Description | Default |
|--------|-------------|---------|
| `-p`, `--pattern=<file>` | Load a `.strudel` file on startup; a missing file aborts startup | none |
| `--bpm=<number>` | Initial BPM; must be a positive number | `130` |
| `--debug` | Debug logging to stderr | off |
| `--api-key=<key>` | LLM API key (overrides config file and env) | from config |
| `--base-url=<url>` | API base URL (overrides config file and env) | from config |
| `--model=<name>` | Model name (overrides config file and env) | from config |
| `--help`, `-h` | Show help | |
| `--version`, `-v` | Show version | |

```bash
$ strudel-tui --version
0.1.0
```

### Startup errors

Both abort before the TUI starts, with exit code 1:

```bash
$ strudel-tui --bpm abc
Invalid BPM value: "abc"
```

```bash
$ strudel-tui --pattern /tmp/definitely-missing.strudel
Failed to read pattern file "/tmp/definitely-missing.strudel": ENOENT: no such file or directory, open '/tmp/definitely-missing.strudel'
```

## `strudel-tui config`

Manage configuration stored in `~/.strudel-tui/config.json`
([all keys and defaults](config.md)).

### `config init`

Interactive setup wizard: pick a provider, enter your API key. Ends with
`Configuration saved.` or `Configuration cancelled.`

### `config set <key> <value>`

Set one value and write the config file immediately.

```bash
$ strudel-tui config set model deepseek-chat
Set model = deepseek-chat
$ strudel-tui config set apiKey sk-example-1234567890
Set apiKey = ***
```

`apiKey` values are masked in output but stored in full. Unknown keys are
rejected with exit code 1:

```bash
$ strudel-tui config set foo bar
Invalid key "foo". Valid keys: apiKey, baseUrl, model, temperature, maxTokens
```

Valid keys: `apiKey`, `baseUrl`, `model`, `temperature`, `maxTokens`.
`temperature` and `maxTokens` are parsed as numbers.

### `config show`

Print the effective configuration (what the next launch would use, ignoring
per-launch flags/env):

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

On a fresh install (`(not set)` for the key), the same command shows defaults:
`https://api.openai.com/v1`, `gpt-4o`, temperature `0.7`, maxTokens `4096`.
