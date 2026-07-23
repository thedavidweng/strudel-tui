import { transpiler } from '@strudel/transpiler';

interface ValidationError {
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export class PatternSyntax {
  validate(code: string): ValidationResult {
    try {
      transpiler(code);
      return { valid: true };
    } catch (err: unknown) {
      const errors: ValidationError[] = [];

      if (err instanceof Error) {
        const loc = (err as { loc?: { line?: number; column?: number } }).loc;
        errors.push({
          message: err.message,
          line: loc?.line,
          column: loc?.column,
        });
      } else {
        errors.push({ message: String(err) });
      }

      return { valid: false, errors };
    }
  }

  generateFromSeed(seed: string): string {
    const hash = hashString(seed);

    const scales: number[][] = [
      [0, 2, 4, 5, 7, 9, 11],
      [0, 2, 3, 5, 7, 8, 10],
      [0, 2, 3, 5, 7, 9, 10],
      [0, 3, 5, 6, 7, 10],
      [0, 2, 4, 7, 9],
      [0, 3, 5, 7, 10],
    ];
    const scale = scales[hash % scales.length]!;

    const noteCount = 4 + ((hash >> 4) & 0x03);
    const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    const notes: string[] = [];
    for (let i = 0; i < noteCount; i++) {
      const seedI = hashString(`${seed}_${i}`);
      const degree = seedI % scale.length;
      const octaveShift = (seedI >> 4) & 1;
      const midiNote = scale[degree]! + octaveShift * 12;
      const noteName = noteNames[midiNote % 12]!;
      const octave = 3 + Math.floor(midiNote / 12);
      notes.push(`${noteName}${octave}`);
    }

    const sounds = ['sawtooth', 'triangle', 'sine', 'square', 'pulse'];
    const sound = sounds[(hash >> 12) % sounds.length]!;

    const noteStr = notes.join(' ');
    return `note(\`${noteStr}\`).sound(\`${sound}\`)`;
  }
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}
