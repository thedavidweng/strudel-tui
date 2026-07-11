import { StrudelEngineWrapper } from '../engine/StrudelEngineWrapper.js';
import { PatternLoader } from '../engine/PatternLoader.js';
import { SessionHistory } from './SessionHistory.js';

export interface AudioControl {
  play(code: string): Promise<void>;
  stop(): Promise<void>;
}

export class ToolExecutor {
  private _pattern: string;
  private _engine: StrudelEngineWrapper;
  private _loader: PatternLoader;
  private _history: SessionHistory;
  private _audio: AudioControl | null;

  constructor(initialPattern: string, history: SessionHistory, audio?: AudioControl) {
    this._pattern = initialPattern;
    this._engine = new StrudelEngineWrapper();
    this._loader = new PatternLoader();
    this._history = history;
    this._audio = audio ?? null;
  }

  get currentPattern(): string {
    return this._pattern;
  }

  setPattern(pattern: string): void {
    this._pattern = pattern;
    this._history.pushPattern(pattern);
  }

  applyEditHeuristic(pattern: string, instruction: string): string {
    const lower = instruction.toLowerCase();
    if (lower.includes('faster') || lower.includes('speed up')) {
      if (pattern.includes('.slow(')) return pattern.replace(/\.slow\(([^)]+)\)/, (_, n) => `.fast(${n})`);
      return pattern.trimEnd() + '.fast(2)';
    }
    if (lower.includes('slower') || lower.includes('slow down')) {
      if (pattern.includes('.fast(')) return pattern.replace(/\.fast\(([^)]+)\)/, (_, n) => `.slow(${n})`);
      return pattern.trimEnd() + '.slow(2)';
    }
    if (lower.includes('louder') || lower.includes('volume up')) return pattern.trimEnd() + '.gain(1.5)';
    if (lower.includes('quieter') || lower.includes('softer')) return pattern.trimEnd() + '.gain(0.5)';
    if (lower.includes('reverse') || lower.includes('backwards')) return pattern.trimEnd() + '.rev()';
    if (lower.includes('reverb')) return pattern.trimEnd() + '.room(0.5)';
    if (lower.includes('delay')) return pattern.trimEnd() + '.delay(0.5)';
    if (lower.includes('distort')) return pattern.trimEnd() + '.distort(0.5)';
    if (lower.includes('filter') || lower.includes('low pass')) return pattern.trimEnd() + '.lpf(800)';
    if (lower.includes('high pass')) return pattern.trimEnd() + '.hpf(800)';
    if (lower.includes('remove last') || lower.includes('undo last')) {
      const match = pattern.match(/\.(\w+)\([^)]*\)\s*$/);
      if (match) return pattern.slice(0, match.index);
    }
    return pattern;
  }

  undoPattern(): string | undefined {
    const restored = this._history.undoPattern();
    if (restored !== undefined) this._pattern = restored;
    return restored;
  }

  redoPattern(): string | undefined {
    const restored = this._history.redoPattern();
    if (restored !== undefined) this._pattern = restored;
    return restored;
  }

  async executeTool(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'play_pattern': {
        if (args.code) {
          const validation = await this._engine.validate(args.code);
          if (!validation.valid) {
            return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
          }
          this.setPattern(args.code);
          if (this._audio) {
            try { await this._audio.play(args.code); } catch (err: unknown) {
              console.warn('[ToolExecutor] audio.play failed:', err instanceof Error ? err.message : err);
            }
          }
          return `Pattern set. Ready to play: ${args.code}`;
        }
        if (this._audio && this._pattern.trim()) {
          try { await this._audio.play(this._pattern); } catch (err: unknown) {
            console.warn('[ToolExecutor] audio.play failed:', err instanceof Error ? err.message : err);
          }
        }
        return `Playing current pattern: ${this._pattern}`;
      }

      case 'stop_playback':
        if (this._audio) {
          try { await this._audio.stop(); } catch (err: unknown) {
            console.warn('[ToolExecutor] audio.stop failed:', err instanceof Error ? err.message : err);
          }
        }
        return 'Playback stopped.';

      case 'validate_pattern': {
        const result = await this._engine.validate(args.code);
        if (result.valid) {
          const info = await this._engine.getPatternInfo(args.code);
          const infoStr = info ? ` (${info.eventCount} events, ${info.voices} voice${info.voices !== 1 ? 's' : ''})` : '';
          return `Valid pattern${infoStr}.`;
        }
        return `Invalid: ${result.errors?.map(e => e.message).join('; ')}`;
      }

      case 'generate_pattern': {
        const pattern = this._engine.generateFromSeed(args.description);
        this.setPattern(pattern);
        return `Generated: ${pattern}`;
      }

      case 'edit_pattern': {
        // LLM mode: accept a code fragment directly
        if (args.code) {
          const validation = await this._engine.validate(args.code);
          if (!validation.valid) {
            return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
          }
          this.setPattern(args.code);
          return `Pattern edited: ${args.code}`;
        }
        // Keyword mode: use heuristic
        const edited = this.applyEditHeuristic(this._pattern, args.instruction ?? '');
        if (edited === this._pattern) {
          return 'Could not apply that edit. Try being more specific or edit the pattern directly.';
        }
        const validation = await this._engine.validate(edited);
        if (!validation.valid) {
          return `Edit produced invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
        }
        this.setPattern(edited);
        return `Pattern edited: ${edited}`;
      }

      case 'set_pattern': {
        const validation = await this._engine.validate(args.code);
        if (!validation.valid) {
          return `Invalid pattern: ${validation.errors?.map(e => e.message).join('; ')}`;
        }
        this.setPattern(args.code);
        return `Pattern set: ${args.code}`;
      }

      case 'get_pattern_info': {
        if (!this._pattern.trim()) return 'No pattern loaded.';
        const info = await this._engine.getPatternInfo(this._pattern);
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
          const dir = this._loader.getDefaultPatternDir();
          const filePath = `${dir}/${args.name}.strudel`;
          const code = await this._loader.loadPattern(filePath);
          this.setPattern(code);
          return `Loaded "${args.name}": ${code}`;
        } catch (err: unknown) {
          return `Could not load pattern "${args.name}": ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      case 'save_pattern': {
        if (!this._pattern.trim()) return 'No pattern to save.';
        try {
          const dir = this._loader.getDefaultPatternDir();
          const filePath = `${dir}/${args.name}.strudel`;
          await this._loader.savePattern(filePath, this._pattern);
          return `Pattern saved as "${args.name}".`;
        } catch (err: unknown) {
          return `Could not save pattern: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  }
}
