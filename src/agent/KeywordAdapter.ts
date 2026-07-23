import { ToolExecutor } from './ToolExecutor.js';
import { PatternOwner } from '../pattern/PatternOwner.js';
import type { AgentResponse } from './Agent.js';
import { formatHelp } from './HelpText.js';

type Intent =
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'generate'; description: string }
  | { type: 'edit'; instruction: string }
  | { type: 'validate' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'help' }
  | { type: 'pattern'; code: string };

const PLAY_RE = /^\s*(play|start|go)\b/i;
const STOP_RE = /^\s*(stop|pause|hush)\b/i;
const GENERATE_RE = /^\s*(make|create|generate)\s+(.+)/i;
const EDIT_RE = /^\s*(edit|change|modify)\s+(.+)/i;
const VALIDATE_RE = /^\s*(validate|check)\b/i;
const UNDO_RE = /^\s*undo\b/i;
const REDO_RE = /^\s*redo\b/i;
const HELP_RE = /^\s*help\b/i;

function detectIntent(message: string): Intent {
  let m: RegExpMatchArray | null;
  if (HELP_RE.test(message)) return { type: 'help' };
  if (PLAY_RE.test(message)) return { type: 'play' };
  if (STOP_RE.test(message)) return { type: 'stop' };
  if (UNDO_RE.test(message)) return { type: 'undo' };
  if (REDO_RE.test(message)) return { type: 'redo' };
  if (VALIDATE_RE.test(message)) return { type: 'validate' };
  m = message.match(GENERATE_RE);
  if (m) return { type: 'generate', description: m[2].trim() };
  m = message.match(EDIT_RE);
  if (m) return { type: 'edit', instruction: m[2].trim() };
  return { type: 'pattern', code: message };
}

export class KeywordAdapter {
  private _executor: ToolExecutor;
  private _patterns: PatternOwner;

  constructor(executor: ToolExecutor, patterns: PatternOwner) {
    this._executor = executor;
    this._patterns = patterns;
  }

  async processMessage(message: string): Promise<AgentResponse> {
    const intent = detectIntent(message);
    let response: AgentResponse;

    try {
      switch (intent.type) {
        case 'play':
          response = { action: 'play', message: 'Starting playback...', pattern: this._patterns.currentPattern };
          break;

        case 'stop':
          await this._executor.executeTool('stop_playback', {});
          response = { action: 'stop', message: 'Stopping playback.' };
          break;

        case 'generate': {
          const result = await this._executor.executeTool('generate_pattern', { description: intent.description });
          response = { action: 'generate', message: result, pattern: this._patterns.currentPattern };
          break;
        }

        case 'edit': {
          if (!this._patterns.currentPattern.trim()) {
            response = { action: 'edit', message: 'No pattern to edit.', error: 'No current pattern' };
            break;
          }
          const result = await this._executor.executeTool('edit_pattern', { instruction: intent.instruction });
          response = { action: 'edit', message: result, pattern: this._patterns.currentPattern };
          break;
        }

        case 'validate': {
          if (!this._patterns.currentPattern.trim()) {
            response = { action: 'validate', message: 'No pattern to validate.' };
            break;
          }
          const result = await this._executor.executeTool('validate_pattern', { code: this._patterns.currentPattern });
          if (!result.startsWith('Valid')) {
            response = { action: 'validate', message: result, error: result, pattern: this._patterns.currentPattern };
          } else {
            response = { action: 'validate', message: result, pattern: this._patterns.currentPattern };
          }
          break;
        }

        case 'undo': {
          const restored = this._patterns.undo();
          if (restored === undefined) {
            response = { action: 'undo', message: 'Nothing to undo.' };
          } else {
            response = { action: 'undo', message: 'Reverted to previous pattern.', pattern: restored };
          }
          break;
        }

        case 'redo': {
          const restored = this._patterns.redo();
          if (restored === undefined) {
            response = { action: 'redo', message: 'Nothing to redo.' };
          } else {
            response = { action: 'redo', message: 'Re-applied pattern.', pattern: restored };
          }
          break;
        }

        case 'help':
          response = { action: 'help', message: formatHelp() };
          break;

        case 'pattern': {
          const result = await this._executor.executeTool('set_pattern', { code: intent.code });
          if (result.startsWith('Invalid')) {
            response = { action: 'pattern', message: result, error: result };
          } else {
            response = { action: 'pattern', message: 'Pattern set.', pattern: intent.code };
          }
          break;
        }

        default:
          response = { action: 'unknown', message: 'Could not understand input.', error: 'Unknown intent' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      response = { action: 'error', message: `Error: ${msg}`, error: msg };
    }

    return response;
  }
}
