export class SSEParser {
  private _reader: ReadableStreamDefaultReader<Uint8Array>;
  private _decoder = new TextDecoder();
  private _buffer = '';
  private _done = false;

  constructor(stream: ReadableStream<Uint8Array>) {
    this._reader = stream.getReader();
  }

  async next(): Promise<string | null> {
    if (this._done) return null;

    while (true) {
      const nlIdx = this._buffer.indexOf('\n');
      if (nlIdx >= 0) {
        const line = this._buffer.slice(0, nlIdx);
        this._buffer = this._buffer.slice(nlIdx + 1);
        const payload = extractData(line);
        if (payload !== null) return payload;
        continue;
      }

      const { done, value } = await this._reader.read();
      if (done) {
        this._done = true;
        if (this._buffer) {
          const payload = extractData(this._buffer);
          this._buffer = '';
          if (payload !== null) return payload;
        }
        return null;
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
}

function extractData(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return null;
  const rest = trimmed.slice(5);
  return rest.startsWith(' ') ? rest.slice(1) : rest;
}
