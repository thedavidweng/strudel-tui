# Commands Reference

Complete reference for all strudel-tui CLI commands and TUI interactions.

## CLI Commands

### `strudel-tui`

Launch the interactive TUI.

```
strudel-tui [OPTIONS]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--pattern=<file>` | `-p` | Load a `.strudel` pattern file on startup | — |
| `--bpm=<number>` | — | Set initial BPM | `130` |
| `--debug` | — | Enable debug logging | `false` |
| `--api-key=<key>` | — | OpenAI-compatible API key (overrides config) | — |
| `--base-url=<url>` | — | API base URL (overrides config) | — |
| `--model=<name>` | — | Model name (overrides config) | — |
| `--help` | `-h` | Show help | — |
| `--version` | `-v` | Show version | — |

### `strudel-tui config`

Manage configuration stored in `~/.strudel-tui/config.json`.

#### `strudel-tui config init`

Launch the interactive configuration wizard. Walks you through selecting a provider and entering your API key.

```bash
strudel-tui config init
```

#### `strudel-tui config set <key> <value>`

Set a configuration value.

```bash
strudel-tui config set apiKey sk-...
strudel-tui config set baseUrl https://api.deepseek.com/v1
strudel-tui config set model deepseek-chat
strudel-tui config set temperature 0.8
strudel-tui config set maxTokens 8192
```

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `apiKey` | string | API key for the LLM provider | — |
| `baseUrl` | string | API endpoint URL | `https://api.openai.com/v1` |
| `model` | string | Model name | `gpt-4o` |
| `temperature` | number | Sampling temperature | `0.7` |
| `maxTokens` | number | Maximum response tokens | `4096` |

#### `strudel-tui config show`

Display the current configuration.

```bash
strudel-tui config show
```

Output:
```
Strudel-TUI Configuration:
  apiKey:      ****abcd
  baseUrl:     https://api.openai.com/v1
  model:       gpt-4o
  temperature: 0.7
  maxTokens:   4096

Config file: ~/.strudel-tui/config.json
```

## TUI Commands

Type these in the input box while the TUI is running.

### Playback

| Command | Aliases | Description |
|---------|---------|-------------|
| `play` | `start`, `go` | Start audio playback of the current pattern |
| `stop` | `pause`, `hush` | Stop all playing patterns |

### Pattern Management

| Command | Description |
|---------|-------------|
| `make <description>` | Generate a new pattern from a text description |
| `create <description>` | Same as `make` |
| `generate <description>` | Same as `make` |
| `edit <instruction>` | Modify the current pattern |
| `change <instruction>` | Same as `edit` |
| `modify <instruction>` | Same as `edit` |
| `validate` | Check the current pattern for syntax errors |
| `check` | Same as `validate` |
| `undo` | Revert to the previous pattern |
| `redo` | Re-apply the last undone pattern change |

### Other

| Command | Description |
|---------|-------------|
| `help` | Show available commands and keyboard shortcuts |

### Direct Pattern Input

Type any Strudel code directly to set it as the current pattern:

```
> s("bd sn hh cp")
> note("c d e f g").sound("triangle").slow(2)
> s("bd*4, [- sd]*2, hh*8")
```

### AI Agent Chat (when configured)

With an API key configured, chat naturally:

```
> make a chill lo-fi beat at 90 bpm
> add some reverb and make it slower
> play it
> change the melody to something more jazzy
> save it as lofi-v1
```

## Edit Instructions

These keyword-based edits work in both keyword mode and as quick edits in AI mode:

| Instruction | Effect | Strudel Transform |
|-------------|--------|-------------------|
| `faster` / `speed up` | Double speed | `.fast(2)` |
| `slower` / `slow down` | Half speed | `.slow(2)` |
| `louder` / `volume up` | Increase gain | `.gain(1.5)` |
| `quieter` / `softer` / `volume down` | Decrease gain | `.gain(0.5)` |
| `reverse` / `backwards` | Reverse pattern | `.rev()` |
| `reverb` | Add reverb | `.room(0.5)` |
| `delay` | Add delay | `.delay(0.5)` |
| `distort` / `overdrive` | Add distortion | `.distort(0.5)` |
| `filter` / `low pass` | Low-pass filter | `.lpf(800)` |
| `high pass` | High-pass filter | `.hpf(800)` |
| `remove last` / `undo last` | Remove last transform | — |

## Keyboard Shortcuts

| Keys | Description |
|------|-------------|
| `Ctrl+P` | Toggle play/stop |
| `Ctrl+S` | Save current pattern to file |
| `Ctrl+L` | Clear message history |
| `Ctrl+C` | Quit strudel-tui |
| `Up` | Previous input from history |
| `Down` | Next input from history |
| `Enter` | Send input |
| `Backspace` | Delete last character |
