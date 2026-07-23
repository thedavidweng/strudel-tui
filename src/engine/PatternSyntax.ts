import { transpiler } from '@strudel/transpiler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationError {
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
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
// PatternSyntax — pure pattern validation and generation
// ---------------------------------------------------------------------------

/**
 * PatternSyntax provides pure, side-effect-free pattern operations that
 * do NOT require the Strudel runtime to be initialised.  No dynamic
 * imports, no globalThis mutation — safe to call at any time.
 */
export class PatternSyntax {
  /**
   * Validate the given Strudel code.  If transpilation succeeds, returns
   * `{ valid: true }`.  Otherwise returns `{ valid: false, errors: [...] }`
   * with as much positional information as the parser provides.
   */
  validate(code: string): ValidationResult {
    try {
      transpiler(code);
      return { valid: true };
    } catch (err: unknown) {
      const errors: ValidationError[] = [];

      if (err instanceof Error) {
        // Acorn attaches `.loc` (line/column) and `.pos` (character offset)
        const loc = (err as { loc?: { line?: number; column?: number } }).loc;
        errors.push({
          message: err.message,
          line: loc?.line,
          column: loc?.column,
        });
      } else {
        errors.push({
          message: String(err),
        });
      }

      return { valid: false, errors };
    }
  }

  /**
   * Return a random preset pattern string from the built-in library.
   */
  generatePattern(): string {
    const idx = Math.floor(Math.random() * PRESETS.length);
    return PRESETS[idx]!.code;
  }

  /**
   * Create a pattern string from a human-readable text seed.  The seed is
   * used to deterministically pick note / rhythm values so the same seed
   * always produces the same pattern.
   */
  generateFromSeed(seed: string): string {
    const hash = hashString(seed);

    // Scales (intervals from root)
    const scales: number[][] = [
      [0, 2, 4, 5, 7, 9, 11], // major
      [0, 2, 3, 5, 7, 8, 10], // minor
      [0, 2, 3, 5, 7, 9, 10], // dorian
      [0, 3, 5, 6, 7, 10], // blues
      [0, 2, 4, 7, 9], // pentatonic major
      [0, 3, 5, 7, 10], // pentatonic minor
    ];
    const scale = scales[hash % scales.length]!;

    // Generate 4-8 note events
    const noteCount = 4 + ((hash >> 4) & 0x03); // 4-7
    const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    const notes: string[] = [];
    for (let i = 0; i < noteCount; i++) {
      const seedI = hashString(`${seed}_${i}`);
      const degree = seedI % scale.length;
      const octaveShift = (seedI >> 4) & 1; // 0 or 1 octave up
      const midiNote = scale[degree]! + octaveShift * 12;
      const noteName = noteNames[midiNote % 12]!;
      const octave = 3 + Math.floor(midiNote / 12);
      notes.push(`${noteName}${octave}`);
    }

    // Pick a sound
    const sounds = ['sawtooth', 'triangle', 'sine', 'square', 'pulse'];
    const sound = sounds[(hash >> 12) % sounds.length]!;

    // Assemble the pattern string
    const noteStr = notes.join(' ');
    return `note(\`${noteStr}\`).sound(\`${sound}\`)`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple string hash (djb2 variant) returning a positive 32-bit integer.
 * Used by generateFromSeed for deterministic randomness.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}
