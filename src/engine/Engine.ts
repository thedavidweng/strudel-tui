import { transpiler } from '@strudel/transpiler';
import { mini, m } from '@strudel/mini';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatternEvent {
  /** Human-readable summary of the hap value */
  hap: string;
  /** Onset time in cycles (fractional) */
  onset: number;
  /** Duration in cycles (fractional) */
  duration: number;
  /** The raw value object from the Hap */
  value: any;
}

export interface PatternInfo {
  /** Number of discrete events in one cycle */
  eventCount: number;
  /** Number of unique "voices" / control channels (e.g. different `s` values) */
  voices: number;
  /** List of unique voice names */
  voiceNames: string[];
  /** Default cycle duration at 1 cps (always 1 second) */
  cycleDuration: number;
  /** Total span of events queried */
  totalSpan: number;
}

// ---------------------------------------------------------------------------
// Engine — Strudel runtime wrapper (requires lazy initialisation)
// ---------------------------------------------------------------------------

/**
 * Engine wraps the Strudel runtime for pattern evaluation and analysis.
 *
 * Unlike PatternSyntax (which is pure and side-effect-free), Engine
 * requires initialisation: it dynamically imports @strudel/core, registers
 * all pattern functions on globalThis via evalScope, and sets the mini
 * notation parser.  Call `init()` once before `queryEvents()` or
 * `getPatternInfo()`.  `init()` is idempotent — calling it multiple times
 * is safe.
 */
export class Engine {
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;
  private _core: typeof import('@strudel/core') | null = null;

  /**
   * Lazily initialise the Strudel evaluation environment.  Idempotent.
   *
   * 1. Dynamically imports @strudel/core.
   * 2. Registers all exported symbols on globalThis via evalScope so that
   *    Function()-based evaluation can see them.
   * 3. Sets the mini notation string parser.
   */
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

  /** True after init() has completed. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Evaluate the given Strudel code, query the resulting pattern for the
   * specified number of cycles, and return a simplified event list.
   *
   * Returns an empty array if evaluation fails.
   */
  async queryEvents(code: string, cycles = 1): Promise<PatternEvent[]> {
    await this.init();
    const core = this._core!;

    try {
      const { pattern } = await core.evaluate(code, transpiler);
      if (!core.isPattern(pattern)) return [];

      const haps = pattern.queryArc(0, cycles);
      return haps
        .filter((hap: any) => hap.hasOnset())
        .map((hap: any) => {
          const value = hap.value;
          const hapStr =
            typeof value === 'object'
              ? Object.entries(value)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(' ')
              : String(value);
          return {
            hap: hapStr,
            onset: Number(hap.part.begin),
            duration: Number(hap.duration),
            value,
          };
        });
    } catch (err: unknown) {
      console.warn('[Engine] queryEvents error:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * Evaluate the code and return metadata about the resulting pattern:
   * number of events, distinct voices, cycle duration, etc.
   */
  async getPatternInfo(code: string): Promise<PatternInfo | null> {
    await this.init();
    const core = this._core!;

    try {
      // Strip setcps(...) calls — they affect tempo, not pattern structure.
      const cleaned = code.replace(/setcps\s*\([^)]*\)\s*;?\s*/g, '').trim();
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
        cycleDuration: 1,
        totalSpan: 1,
      };
    } catch (err: unknown) {
      console.warn('[Engine] getPatternInfo error:', err instanceof Error ? err.message : err);
      return null;
    }
  }
}
