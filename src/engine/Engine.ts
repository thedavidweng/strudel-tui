import { transpiler } from '@strudel/transpiler';
import { mini, m } from '@strudel/mini';

const SETCPS_RE = /setcps\s*\([^)]*\)\s*;?\s*/g;

export interface PatternInfo {
  eventCount: number;
  voices: number;
  voiceNames: string[];
}

export class Engine {
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;
  private _core: typeof import('@strudel/core') | null = null;

  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const core = await import('@strudel/core');
      await core.evalScope(Promise.resolve(core), Promise.resolve({ mini, m }));
      core.setStringParser(mini);
      this._core = core;
      this._initialized = true;
    })();

    return this._initPromise;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  async getPatternInfo(code: string): Promise<PatternInfo | null> {
    await this.init();
    const core = this._core!;

    try {
      const cleaned = code.replace(SETCPS_RE, '').trim();
      const { pattern } = await core.evaluate(cleaned || code, transpiler);
      if (!core.isPattern(pattern)) return null;

      const haps = pattern.queryArc(0, 1);
      const onsetHaps = haps.filter((h: any) => h.hasOnset());

      const voiceSet = new Set<string>();
      for (const hap of onsetHaps) {
        const v = hap.value;
        if (typeof v === 'object' && v !== null) {
          const name = v.s || v.n || v.note || v.sound || '?';
          voiceSet.add(String(name));
        } else {
          voiceSet.add(String(v));
        }
      }

      return {
        eventCount: onsetHaps.length,
        voices: voiceSet.size,
        voiceNames: [...voiceSet],
      };
    } catch (err: unknown) {
      console.warn('[Engine] getPatternInfo error:', err instanceof Error ? err.message : err);
      return null;
    }
  }
}
