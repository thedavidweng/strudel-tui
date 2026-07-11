/**
 * InlineConfig — pi-tui Component for inline AI configuration.
 *
 * Two modes:
 *   'config'   — full wizard: provider -> api-key -> base-url -> model -> confirm
 *   'provider' — quick switch: provider -> save (no API key needed)
 *
 * Renders as a bordered panel with chalk styling.
 * Uses arrow keys for list navigation, Enter to select, Escape to cancel.
 * API key input is masked with '*'.
 * Fetches models from API when available, falls back to manual entry.
 * Shows a braille spinner during model fetch.
 */

import chalk from 'chalk';
import { Component, matchesKey, CURSOR_MARKER } from '@earendil-works/pi-tui';
import { ConfigManager } from '../config/ConfigManager.js';
import { fetchModels, type ModelInfo } from '../llm/OpenAIClient.js';
import { colors, BRAILLE_DOTS } from './theme.js';

// ---------------------------------------------------------------------------
// Provider presets
// ---------------------------------------------------------------------------

interface ProviderPreset {
  label: string;
  value: string;
  baseUrl: string;
  model: string;
}

const PROVIDERS: ProviderPreset[] = [
  { label: 'OpenAI', value: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'DeepSeek', value: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Moonshot (Kimi)', value: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-auto' },
  { label: 'Zhipu (GLM)', value: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: 'Qwen (Tongyi)', value: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
  { label: 'OpenRouter', value: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o' },
  { label: 'Custom (OpenAI Compatible)', value: 'custom', baseUrl: '', model: '' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfigStep = 'provider' | 'api-key' | 'base-url' | 'fetching-models' | 'select-model' | 'confirm';
type Mode = 'config' | 'provider';

// ---------------------------------------------------------------------------
// ANSI strip helper (for visible-width calculation)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class InlineConfig implements Component {
  private _invalidate: (() => void) | null = null;
  private _mode: Mode;
  private _onClose: (saved: boolean) => void;

  // Wizard state
  private _step: ConfigStep = 'provider';
  private _provider: ProviderPreset | null = null;
  private _apiKey = '';
  private _baseUrl = '';
  private _model = '';
  private _models: ModelInfo[] = [];
  private _fetchError: string | null = null;

  // Navigation / input state
  private _selectedIndex = 0;
  private _cursorPos = 0;

  // Spinner tick
  private _spinTick = 0;

  constructor(mode: Mode, onClose: (saved: boolean) => void) {
    this._mode = mode;
    this._onClose = onClose;
  }

  // -- Component interface --------------------------------------------------

  setInvalidate(fn: () => void): void {
    this._invalidate = fn;
  }

  /**
   * Handle a single key event. Returns true when the input was consumed.
   */
  handleInput(data: string): boolean {
    // Escape always cancels the entire panel
    if (matchesKey(data, 'escape')) {
      this._onClose(false);
      return true;
    }

    // Block input while the model-fetch spinner is active
    if (this._step === 'fetching-models') return true;

    switch (this._step) {
      case 'provider':
        return this._handleListInput(data, PROVIDERS.length, (idx) => {
          this._selectProvider(PROVIDERS[idx]!);
        });

      case 'api-key':
        return this._handleTextInput(data, (value) => {
          this._apiKey = value;
          if (this._provider?.value === 'custom') {
            this._step = 'base-url';
            this._cursorPos = this._baseUrl.length;
          } else {
            this._startModelFetch();
          }
          this._selectedIndex = 0;
          this.invalidate();
        });

      case 'base-url':
        return this._handleTextInput(data, (value) => {
          this._baseUrl = value;
          this._startModelFetch();
          this._selectedIndex = 0;
          this.invalidate();
        });

      case 'select-model':
        if (this._models.length > 0) {
          return this._handleListInput(data, this._models.length, (idx) => {
            this._model = this._models[idx]!.id;
            this._step = 'confirm';
            this._selectedIndex = 0;
            this.invalidate();
          });
        }
        return this._handleTextInput(data, (value) => {
          this._model = value;
          this._step = 'confirm';
          this._selectedIndex = 0;
          this.invalidate();
        });

      case 'confirm':
        return this._handleListInput(data, 2, (idx) => {
          if (idx === 0) {
            const config = new ConfigManager();
            config.set('apiKey', this._apiKey);
            config.set('baseUrl', this._baseUrl);
            config.set('model', this._model);
            this._onClose(true);
          } else {
            this._onClose(false);
          }
        });
    }
  }

  /**
   * Render the config panel as an array of lines.
   */
  render(width: number, _height?: number): string[] {
    this._spinTick++;

    const lines: string[] = [];
    // panelWidth = horizontal fill between corners; total = panelWidth + 2
    const panelWidth = Math.min(width - 2, 60);
    const contentWidth = panelWidth; // content between vertical borders

    // ── Top border ──
    lines.push(chalk.hex(colors.border)('╭' + '─'.repeat(panelWidth) + '╮'));

    // ── Header ──
    const title = this._mode === 'provider' ? 'Switch Provider' : 'AI Configuration';
    const escHint = '(esc to cancel)';
    const headerContent = chalk.hex(colors.primary).bold(` ${title} `) + chalk.hex(colors.textDim)(escHint);
    lines.push(this._borderLine(headerContent, contentWidth));

    // ── Separator ──
    lines.push(chalk.hex(colors.border)('├' + '─'.repeat(panelWidth) + '┤'));

    // ── Fetch error (shown above model list / manual entry) ──
    if (this._step === 'select-model' && this._fetchError) {
      lines.push(this._borderLine(chalk.hex(colors.warning)(` ${this._fetchError}`), contentWidth));
      lines.push(this._borderLine('', contentWidth));
    }

    // ── Step content ──
    switch (this._step) {
      case 'provider':
        this._renderProviderList(lines, contentWidth);
        break;
      case 'api-key':
        this._renderTextInput(lines, contentWidth, 'API key', this._apiKey, true);
        break;
      case 'base-url':
        this._renderTextInput(lines, contentWidth, 'Base URL', this._baseUrl, false);
        break;
      case 'fetching-models':
        this._renderFetching(lines, contentWidth);
        break;
      case 'select-model':
        if (this._models.length > 0) {
          this._renderModelList(lines, contentWidth);
        } else {
          this._renderTextInput(lines, contentWidth, 'Model', this._model, false);
        }
        break;
      case 'confirm':
        this._renderConfirm(lines, contentWidth);
        break;
    }

    // ── Bottom border ──
    lines.push(chalk.hex(colors.border)('╰' + '─'.repeat(panelWidth) + '╯'));

    return lines;
  }

  // -- Private: list navigation handler -------------------------------------

  private _handleListInput(data: string, itemCount: number, onConfirm: (index: number) => void): boolean {
    if (matchesKey(data, 'up')) {
      this._selectedIndex = (this._selectedIndex - 1 + itemCount) % itemCount;
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'down')) {
      this._selectedIndex = (this._selectedIndex + 1) % itemCount;
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'return')) {
      onConfirm(this._selectedIndex);
      return true;
    }
    return false;
  }

  // -- Private: text input handler ------------------------------------------

  private _handleTextInput(data: string, onSubmit: (value: string) => void): boolean {
    if (matchesKey(data, 'return')) {
      onSubmit(this._getInputValue());
      return true;
    }
    if (matchesKey(data, 'left')) {
      this._cursorPos = Math.max(0, this._cursorPos - 1);
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'right')) {
      this._cursorPos = Math.min(this._getInputValue().length, this._cursorPos + 1);
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'home')) {
      this._cursorPos = 0;
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'end')) {
      this._cursorPos = this._getInputValue().length;
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'backspace')) {
      const val = this._getInputValue();
      if (this._cursorPos > 0) {
        this._setInputValue(val.slice(0, this._cursorPos - 1) + val.slice(this._cursorPos));
        this._cursorPos--;
      }
      this.invalidate();
      return true;
    }
    if (matchesKey(data, 'delete')) {
      const val = this._getInputValue();
      if (this._cursorPos < val.length) {
        this._setInputValue(val.slice(0, this._cursorPos) + val.slice(this._cursorPos + 1));
      }
      this.invalidate();
      return true;
    }

    // Printable character insertion (skip control / meta chords)
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      const val = this._getInputValue();
      this._setInputValue(val.slice(0, this._cursorPos) + data + val.slice(this._cursorPos));
      this._cursorPos += data.length;
      this.invalidate();
      return true;
    }

    return false;
  }

  // -- Private: input value routing -----------------------------------------

  private _getInputValue(): string {
    switch (this._step) {
      case 'api-key':     return this._apiKey;
      case 'base-url':    return this._baseUrl;
      case 'select-model': return this._model;
      default:            return '';
    }
  }

  private _setInputValue(value: string): void {
    switch (this._step) {
      case 'api-key':      this._apiKey = value;  break;
      case 'base-url':     this._baseUrl = value; break;
      case 'select-model': this._model = value;   break;
    }
  }

  // -- Private: provider selection ------------------------------------------

  private _selectProvider(preset: ProviderPreset): void {
    this._provider = preset;
    this._baseUrl = preset.baseUrl;
    this._model = preset.model;

    if (this._mode === 'provider') {
      // Quick-switch mode: save provider defaults and close immediately
      const config = new ConfigManager();
      config.set('baseUrl', preset.baseUrl);
      config.set('model', preset.model);
      this._onClose(true);
      return;
    }

    // Full config mode: advance to API key entry
    this._step = 'api-key';
    this._cursorPos = 0;
    this._selectedIndex = 0;
    this.invalidate();
  }

  // -- Private: async model fetch -------------------------------------------

  private _startModelFetch(): void {
    this._step = 'fetching-models';
    this._spinTick = 0;
    this.invalidate();

    fetchModels(this._apiKey, this._baseUrl)
      .then((models) => {
        if (models.length === 0) {
          this._fetchError = 'No models found. You can enter the model name manually.';
          this._models = [];
        } else {
          this._models = models;
          this._fetchError = null;
        }
        this._step = 'select-model';
        this._cursorPos = this._model.length;
        this.invalidate();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this._fetchError = `Could not fetch models: ${msg}. You can enter the model name manually.`;
        this._models = [];
        this._step = 'select-model';
        this._cursorPos = this._model.length;
        this.invalidate();
      });
  }

  // -- Private: rendering ---------------------------------------------------

  private _renderProviderList(lines: string[], cw: number): void {
    lines.push(this._borderLine(chalk.hex(colors.text)(' Select an AI provider:'), cw));
    lines.push(this._borderLine('', cw));

    const maxVisible = Math.min(PROVIDERS.length, 10);
    const scrollOffset = Math.max(0, this._selectedIndex - maxVisible + 1);

    for (let i = scrollOffset; i < Math.min(PROVIDERS.length, scrollOffset + maxVisible); i++) {
      const preset = PROVIDERS[i]!;
      const sel = i === this._selectedIndex;
      const indicator = chalk.hex(sel ? colors.primary : colors.textMuted)(sel ? '▸' : ' ');
      const label = sel
        ? chalk.hex(colors.primary).bold(` ${preset.label}`)
        : chalk.hex(colors.text)(` ${preset.label}`);
      lines.push(this._borderLine(indicator + label, cw));
    }

    lines.push(this._borderLine('', cw));
    lines.push(this._borderLine(chalk.hex(colors.textMuted)(' Arrow keys to navigate, Enter to select'), cw));
  }

  private _renderTextInput(lines: string[], cw: number, label: string, value: string, masked: boolean): void {
    const providerLabel = this._provider?.label ?? '';
    lines.push(this._borderLine(chalk.hex(colors.text)(` Enter ${label} for ${providerLabel}:`), cw));
    lines.push(this._borderLine('', cw));

    // Build input line with CURSOR_MARKER for IME support
    const display = masked ? '*'.repeat(value.length) : value;
    const before = display.slice(0, this._cursorPos);
    const after = display.slice(this._cursorPos);
    const inputLine = chalk.hex(colors.textDim)(` ${label}: `) + chalk.hex(colors.text)(before) + CURSOR_MARKER + chalk.hex(colors.text)(after);
    lines.push(this._borderLine(inputLine, cw));

    lines.push(this._borderLine('', cw));
    const hint = this._step === 'api-key'
      ? ' Press Enter to continue'
      : ` Example: ${this._provider?.model || 'gpt-4o'}`;
    lines.push(this._borderLine(chalk.hex(colors.textMuted)(hint), cw));
  }

  private _renderFetching(lines: string[], cw: number): void {
    const frame = BRAILLE_DOTS[this._spinTick % BRAILLE_DOTS.length]!;
    const spinnerLine = chalk.hex(colors.primary)(` ${frame} `) + chalk.hex(colors.text)(` Fetching models from ${this._baseUrl}`);
    lines.push(this._borderLine(spinnerLine, cw));
  }

  private _renderModelList(lines: string[], cw: number): void {
    lines.push(this._borderLine(chalk.hex(colors.text)(` Select a model (${this._models.length} available):`), cw));
    lines.push(this._borderLine('', cw));

    const maxVisible = Math.min(this._models.length, 10);
    const scrollOffset = Math.max(0, this._selectedIndex - maxVisible + 1);

    for (let i = scrollOffset; i < Math.min(this._models.length, scrollOffset + maxVisible); i++) {
      const m = this._models[i]!;
      const sel = i === this._selectedIndex;
      const indicator = chalk.hex(sel ? colors.primary : colors.textMuted)(sel ? '▸' : ' ');
      const text = m.owned_by ? `${m.id}  (${m.owned_by})` : m.id;
      const label = sel
        ? chalk.hex(colors.primary).bold(` ${text}`)
        : chalk.hex(colors.text)(` ${text}`);
      lines.push(this._borderLine(indicator + label, cw));
    }

    lines.push(this._borderLine('', cw));
    lines.push(this._borderLine(chalk.hex(colors.textMuted)(' Arrow keys to browse, Enter to select'), cw));
  }

  private _renderConfirm(lines: string[], cw: number): void {
    const maskedKey = this._apiKey.length > 8
      ? this._apiKey.slice(0, 4) + '****' + this._apiKey.slice(-4)
      : '****';

    lines.push(this._borderLine(chalk.hex(colors.text).bold(' Configuration summary:'), cw));
    lines.push(this._borderLine('', cw));
    lines.push(this._borderLine(chalk.hex(colors.text)('  Provider:  ') + chalk.hex(colors.primary)(this._provider?.label ?? ''), cw));
    lines.push(this._borderLine(chalk.hex(colors.text)('  API Key:   ') + chalk.hex(colors.warning)(maskedKey), cw));
    lines.push(this._borderLine(chalk.hex(colors.text)('  Base URL:  ') + chalk.hex(colors.success)(this._baseUrl), cw));
    lines.push(this._borderLine(chalk.hex(colors.text)('  Model:     ') + chalk.hex(colors.success)(this._model), cw));
    lines.push(this._borderLine('', cw));
    lines.push(this._borderLine(chalk.hex(colors.text)(' Save this configuration?'), cw));
    lines.push(this._borderLine('', cw));

    const options = ['Yes, save', 'No, cancel'];
    for (let i = 0; i < options.length; i++) {
      const sel = i === this._selectedIndex;
      const indicator = chalk.hex(sel ? colors.primary : colors.textMuted)(sel ? '▸' : ' ');
      const label = sel
        ? chalk.hex(colors.primary).bold(` ${options[i]}`)
        : chalk.hex(colors.text)(` ${options[i]}`);
      lines.push(this._borderLine(indicator + label, cw));
    }
  }

  // -- Private: line helpers ------------------------------------------------

  /**
   * Render a single content line between vertical borders.
   * Pads with spaces so the right border aligns.
   */
  private _borderLine(content: string, contentWidth: number): string {
    const vis = stripAnsi(content).length;
    const pad = Math.max(0, contentWidth - vis);
    return chalk.hex(colors.border)('│') + content + ' '.repeat(pad) + chalk.hex(colors.border)('│');
  }

  invalidate(): void {
    this._invalidate?.();
  }
}

export default InlineConfig;
