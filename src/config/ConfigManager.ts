import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface StrudelConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const CONFIG_DIR = join(homedir(), '.strudel-tui');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS: Required<StrudelConfig> = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
};

export class ConfigManager {
  private config: StrudelConfig;

  constructor(overrides?: Partial<StrudelConfig>) {
    this.config = this.load();
    if (overrides) {
      this.config = { ...this.config, ...this._filterUndefined(overrides) };
    }
  }

  get<K extends keyof StrudelConfig>(key: K): StrudelConfig[K] {
    return this.config[key] ?? DEFAULTS[key];
  }

  getAll(): Required<StrudelConfig> {
    return { ...DEFAULTS, ...this._filterUndefined(this.config) };
  }

  set(key: keyof StrudelConfig, value: string | number): void {
    (this.config as any)[key] = value;
    this.save();
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  private load(): StrudelConfig {
    if (!existsSync(CONFIG_FILE)) {
      return {};
    }
    try {
      const raw = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private save(): void {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  private _filterUndefined(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) result[k] = v;
    }
    return result;
  }
}
