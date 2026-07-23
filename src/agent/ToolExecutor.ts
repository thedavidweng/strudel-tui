import { PatternSyntax } from '../engine/PatternSyntax.js';
import { Engine } from '../engine/Engine.js';
import { PatternLoader } from '../engine/PatternLoader.js';
import { PatternOwner } from '../pattern/PatternOwner.js';
import { join } from 'node:path';

function sanitizePatternName(name: string): string {
  const cleaned = String(name ?? '').replace(/[^a-zA-Z0-9_-]/g, '').trim();
  return cleaned;
}

export interface AudioControl {
  play(code: string): Promise<void>;
  stop(): Promise<void>;
}

export class ToolExecutor {
  private _patterns: PatternOwner;
  private _syntax: PatternSyntax;
  private _engine: Engine;
  private _loader: PatternLoader;
  private _audio: AudioControl | null;

  constructor(patterns: PatternOwner, audio?: AudioControl) {
    this._patterns = patterns;
    this._syntax = new PatternSyntax();
    this._engine = new Engine();
    this._loader = new PatternLoader();
    this._audio = audio ?? null;
  }

  async executeTool(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'play_pattern': {
        if (args.code) {
          const validation = await this._syntax.validate(args.code);
          if (!validation.valid) {
            return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
          }
          this._patterns.set(args.code);
          if (this._audio) {
            try { await this._audio.play(args.code); } catch (err: unknown) {
              console.warn('[ToolExecutor] audio.play failed:', err instanceof Error ? err.message : err);
            }
          }
          return `Pattern set. Ready to play: ${args.code}`;
        }
        if (this._audio && this._patterns.currentPattern.trim()) {
          try { await this._audio.play(this._patterns.currentPattern); } catch (err: unknown) {
            console.warn('[ToolExecutor] audio.play failed:', err instanceof Error ? err.message : err);
          }
        }
        return `Playing current pattern: ${this._patterns.currentPattern}`;
      }

      case 'stop_playback':
        if (this._audio) {
          try { await this._audio.stop(); } catch (err: unknown) {
            console.warn('[ToolExecutor] audio.stop failed:', err instanceof Error ? err.message : err);
          }
        }
        return 'Playback stopped.';

      case 'validate_pattern': {
        const result = await this._syntax.validate(args.code);
        if (result.valid) {
          const info = await this._engine.getPatternInfo(args.code);
          const infoStr = info ? ` (${info.eventCount} events, ${info.voices} voice${info.voices !== 1 ? 's' : ''})` : '';
          return `Valid pattern${infoStr}.`;
        }
        return `Invalid: ${result.errors?.map(e => e.message).join('; ')}`;
      }

      case 'generate_pattern': {
        const pattern = this._syntax.generateFromSeed(args.description);
        this._patterns.set(pattern);
        return `Generated: ${pattern}`;
      }

      case 'edit_pattern': {
        if (args.code) {
          const validation = await this._syntax.validate(args.code);
          if (!validation.valid) {
            return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
          }
          this._patterns.set(args.code);
          return `Pattern edited: ${args.code}`;
        }
        const edited = this._patterns.applyEdit(args.instruction ?? '');
        if (edited === this._patterns.currentPattern) {
          return 'Could not apply that edit. Try being more specific or edit the pattern directly.';
        }
        const validation = await this._syntax.validate(edited);
        if (!validation.valid) {
          return `Edit produced invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
        }
        this._patterns.set(edited);
        return `Pattern edited: ${edited}`;
      }

      case 'set_pattern': {
        const validation = await this._syntax.validate(args.code);
        if (!validation.valid) {
          return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
        }
        this._patterns.set(args.code);
        return `Pattern set: ${args.code}`;
      }

      case 'get_pattern_info': {
        if (!this._patterns.currentPattern.trim()) return 'No pattern loaded.';
        const info = await this._engine.getPatternInfo(this._patterns.currentPattern);
        if (!info) return 'Could not analyze pattern.';
        return `Pattern info: ${info.eventCount} events, ${info.voices} voice(s): ${info.voiceNames.join(', ')}`;
      }

      case 'list_patterns': {
        const patterns = await this._loader.listPatterns();
        if (patterns.length === 0) return 'No pattern files found.';
        return `Available patterns:\n${patterns.map(p => `  - ${p.name}`).join('\n')}`;
      }

      case 'load_pattern': {
        try {
          const safeName = sanitizePatternName(args.name);
          if (!safeName) return 'Invalid pattern name. Use only letters, numbers, hyphens, and underscores.';
          const dir = this._loader.getDefaultPatternDir();
          const filePath = join(dir, `${safeName}.strudel`);
          const code = await this._loader.loadPattern(filePath);
          this._patterns.set(code);
          return `Loaded "${safeName}": ${code}`;
        } catch (err: unknown) {
          return `Could not load pattern: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      case 'save_pattern': {
        if (!this._patterns.currentPattern.trim()) return 'No pattern to save.';
        try {
          const safeName = sanitizePatternName(args.name);
          if (!safeName) return 'Invalid pattern name. Use only letters, numbers, hyphens, and underscores.';
          const dir = this._loader.getDefaultPatternDir();
          const filePath = join(dir, `${safeName}.strudel`);
          await this._loader.savePattern(filePath, this._patterns.currentPattern);
          return `Pattern saved as "${safeName}".`;
        } catch (err: unknown) {
          return `Could not save pattern: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  }
}
