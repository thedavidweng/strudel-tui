import { transpiler } from '@strudel/transpiler';
import { mini, m } from '@strudel/mini';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

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

export interface FormattedError {
  title: string;
  message: string;
  line?: number;
  column?: number;
  excerpt?: string;
}

// ---------------------------------------------------------------------------
// Preset patterns for generatePattern()
// ---------------------------------------------------------------------------

const PRESETS = [
  { name: 'kick', code: 's(`bd*4`)' },
  { name: 'hihat', code: 's(`hh*8`)' },
  { name: 'snare', code: 's(`[- sd]*2`)' },
  { name: 'bass', code: 'note(`<[c2 c3] [e2 e3] [g2 g3] [b2 b3]>`).s(`sawtooth`)' },
  { name: 'melody', code: 'note(`c d e f g a b c5`).sound(`triangle`)' },
  { name: 'drums', code: 's(`bd sn hh cp`)' },
  { name: 'ambient', code: 'note(`<c e g>`).s(`sine`).slow(2)' },
  { name: 'funk', code: 's(`[bd*2, hh*4], sn, [hh bd]`)' },
  { name: 'techno', code: 's(`bd*4, [- sd]*2, hh*8`)' },
  { name: 'arp', code: 'note(`[c e g c5]*4`).sound(`sawtooth`).fast(2)' },
];

// ---------------------------------------------------------------------------
// StrudelEngineWrapper
// ---------------------------------------------------------------------------

/**
 * StrudelEngineWrapper wraps Strudel's compiler and analysis functions.  It
 * validates patterns, returns error information and can query upcoming events.
 * It deliberately excludes any audio playback; audio is handled by the
 * AudioController.
 *
 * All heavy imports (@strudel/core, @strudel/transpiler, @strudel/mini) are
 * loaded lazily on first use so that module-level side-effects (like the
 * "cannot use window" warning) are deferred until the wrapper is actually
 * instantiated.
 */
export class StrudelEngineWrapper {
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  // Cached modules -- populated by _ensureInit()
  private _core: typeof import('@strudel/core') | null = null;

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  /**
   * Lazily initialise the Strudel evaluation environment.  This is called
   * automatically before any operation that needs the full runtime.  It:
   *
   * 1. Dynamically imports @strudel/core (which re-exports everything we need
   *    except `transpiler` and `mini`, which we import statically above).
   * 2. Registers all exported symbols on `globalThis` via `evalScope` so that
   *    `Function()`-based evaluation (used by Strudel's `evaluate`) can see
   *    them.
   * 3. Sets the mini notation string parser.
   */
  private async _ensureInit(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      // Dynamic import -- avoids the "cannot use window" warning at module
      // load time and lets Bun resolve the full package.
      const core = await import('@strudel/core');

      // evalScope puts every export onto globalThis so that the
      // Function()-based safeEval inside Strudel can find them.
      // `m` is the mini notation parser function that the transpiler emits
      // calls to (e.g. m('bd sn', 2)), so it must be in globalThis.
      await core.evalScope(Promise.resolve(core), Promise.resolve({ mini, m }));

      // Register mini as the default string parser so that backtick strings
      // and double-quoted strings are interpreted as mini notation.
      core.setStringParser(mini);

      this._core = core;
      this._initialized = true;
    })();

    return this._initPromise;
  }

  // -----------------------------------------------------------------------
  // 1. validate
  // -----------------------------------------------------------------------

  /**
   * Validate the given Strudel code.  If transpilation succeeds, returns
   * `{ valid: true }`.  Otherwise returns `{ valid: false, errors: [...] }`
   * with as much positional information as the parser provides.
   */
  async validate(code: string): Promise<ValidationResult> {
    try {
      transpiler(code);
      return { valid: true };
    } catch (err: any) {
      const errors: ValidationError[] = [];

      if (err instanceof SyntaxError || err?.name === 'SyntaxError') {
        // Acorn attaches `.loc` (line/column) and `.pos` (character offset)
        const line = err.loc?.line;
        const column = err.loc?.column;
        errors.push({
          message: err.message,
          line,
          column,
        });
      } else {
        errors.push({
          message: err?.message ?? String(err),
        });
      }

      return { valid: false, errors };
    }
  }

  // -----------------------------------------------------------------------
  // 2. queryEvents
  // -----------------------------------------------------------------------

  /**
   * Evaluate the given Strudel code, query the resulting pattern for the
   * specified number of cycles, and return a simplified event list.
   *
   * Returns an empty array if evaluation fails; check the `error` property
   * on the returned object (added when there was an error) for details.
   */
  async queryEvents(code: string, cycles = 1): Promise<PatternEvent[]> {
    await this._ensureInit();
    const core = this._core!;

    try {
      // Transpile + evaluate
      const { pattern } = await core.evaluate(code, transpiler);

      if (!core.isPattern(pattern)) {
        return [];
      }

      // Query events over [0, cycles)
      const haps = pattern.queryArc(0, cycles);

      return haps
        .filter((hap: any) => hap.hasOnset()) // only keep events that start within the window
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
    } catch (err: any) {
      // Return empty array -- caller can use formatError() if needed
      console.warn('[StrudelEngineWrapper] queryEvents error:', err?.message);
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // 3. generatePattern / generateFromSeed
  // -----------------------------------------------------------------------

  /**
   * Return a random preset pattern string from the built-in library.
   */
  generatePattern(): string {
    const idx = Math.floor(Math.random() * PRESETS.length);
    return PRESETS[idx].code;
  }

  /**
   * Create a pattern string from a human-readable text seed.  The seed is
   * used to deterministically pick note / rhythm values so the same seed
   * always produces the same pattern.
   *
   * Strategy: hash the seed to derive a scale, a rhythm density, and note
   * sequence, then assemble a Strudel mini-notation string.
   */
  generateFromSeed(seed: string): string {
    const hash = this._hashString(seed);

    // Scales (intervals from root)
    const scales: number[][] = [
      [0, 2, 4, 5, 7, 9, 11], // major
      [0, 2, 3, 5, 7, 8, 10], // minor
      [0, 2, 3, 5, 7, 9, 10], // dorian
      [0, 3, 5, 6, 7, 10], // blues
      [0, 2, 4, 7, 9], // pentatonic major
      [0, 3, 5, 7, 10], // pentatonic minor
    ];
    const scale = scales[hash % scales.length];

    // Root note (2 octaves range)
    const roots = ['c', 'd', 'e', 'f', 'g', 'a'];
    const root = roots[(hash >> 8) % roots.length];

    // Generate 4-8 note events
    const noteCount = 4 + ((hash >> 4) & 0x03); // 4-7
    const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    const notes: string[] = [];
    for (let i = 0; i < noteCount; i++) {
      const seedI = this._hashString(`${seed}_${i}`);
      const degree = seedI % scale.length;
      const octaveShift = (seedI >> 4) & 1; // 0 or 1 octave up
      const midiNote = scale[degree] + octaveShift * 12;
      const noteName = noteNames[midiNote % 12];
      const octave = 3 + Math.floor(midiNote / 12);
      notes.push(`${noteName}${octave}`);
    }

    // Pick a sound
    const sounds = ['sawtooth', 'triangle', 'sine', 'square', 'pulse'];
    const sound = sounds[(hash >> 12) % sounds.length];

    // Assemble the pattern string
    const noteStr = notes.join(' ');
    return `note(\`${noteStr}\`).sound(\`${sound}\`)`;
  }

  // -----------------------------------------------------------------------
  // 4. formatError
  // -----------------------------------------------------------------------

  /**
   * Format an error (typically caught during evaluate / transpile) into a
   * structured object suitable for TUI display.
   */
  formatError(err: any): FormattedError {
    if (!err) {
      return { title: 'Unknown error', message: 'An unknown error occurred.' };
    }

    const title = err.name || 'Error';
    const message = err.message || String(err);
    const line = err.loc?.line;
    const column = err.loc?.column;

    let excerpt: string | undefined;
    if (err.loc?.line != null) {
      // Attempt to build a caret excerpt from source context if available
      excerpt = `line ${err.loc.line}, column ${err.loc.column}`;
    }

    return { title, message, line, column, excerpt };
  }

  // -----------------------------------------------------------------------
  // 5. getPatternInfo
  // -----------------------------------------------------------------------

  /**
   * Evaluate the code and return metadata about the resulting pattern:
   * number of events, distinct voices, cycle duration, etc.
   */
  async getPatternInfo(code: string): Promise<PatternInfo | null> {
    await this._ensureInit();
    const core = this._core!;

    try {
      // Strip setcps(...) calls — they affect tempo, not pattern structure.
      // setcps is a global that may not be in the eval scope for analysis.
      const cleaned = code.replace(/setcps\s*\([^)]*\)\s*;?\s*/g, '').trim();
      const { pattern } = await core.evaluate(cleaned || code, transpiler);

      if (!core.isPattern(pattern)) {
        return null;
      }

      // Query one full cycle
      const haps = pattern.queryArc(0, 1);
      const onsetHaps = haps.filter((h: any) => h.hasOnset());

      // Collect unique voice names (values of the `s` / `sound` control)
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
        cycleDuration: 1, // At 1 cps, one cycle = 1 second
        totalSpan: 1,
      };
    } catch (err: any) {
      console.warn('[StrudelEngineWrapper] getPatternInfo error:', err?.message);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Simple string hash (djb2 variant) returning a positive 32-bit integer.
   * Used by generateFromSeed for deterministic randomness.
   */
  private _hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }
}
