export class SSEParser {
  private _reader: ReadableStreamDefaultReader<Uint8Array>;
  private _decoder = new TextDecoder();
  private _buffer = '';
  private _dataLines: string[] = [];
  private _done = false;

  constructor(stream: ReadableStream<Uint8Array>) {
    this._reader = stream.getReader();
  }

  /**
   * Returns the data payload of the next SSE event, or null at end of
   * stream. Per the SSE spec an event may carry several `data:` lines,
   * which are joined with "\n" and dispatched at the blank-line delimiter —
   * a server is allowed to split one JSON payload across data lines.
   */
  async next(): Promise<string | null> {
    if (this._done) return null;

    while (true) {
      const nlIdx = this._buffer.indexOf('\n');
      if (nlIdx >= 0) {
        const line = stripCr(this._buffer.slice(0, nlIdx));
        this._buffer = this._buffer.slice(nlIdx + 1);

        if (line.trim() === '') {
          const event = this._flushEvent();
          if (event !== null) return event;
          continue;
        }

        const data = extractData(line);
        if (data !== null) this._dataLines.push(data);
        continue;
      }

      const { done, value } = await this._reader.read();
      if (done) {
        this._done = true;
        const rest = stripCr(this._buffer);
        this._buffer = '';
        if (rest.trim() !== '') {
          const data = extractData(rest);
          if (data !== null) this._dataLines.push(data);
        }
        return this._flushEvent();
      }
      this._buffer += this._decoder.decode(value, { stream: true });
    }
  }

  release(): void {
    try {
      this._reader.releaseLock();
    } catch {
    }
  }

  private _flushEvent(): string | null {
    if (this._dataLines.length === 0) return null;
    const payload = this._dataLines.join('\n');
    this._dataLines = [];
    return payload;
  }
}

function stripCr(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function extractData(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const rest = trimmed.slice(5);
  return rest.startsWith(' ') ? rest.slice(1) : rest;
}
