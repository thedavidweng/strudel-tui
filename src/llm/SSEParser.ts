/**
 * SSEParser — Server-Sent Events framing.
 *
 * Takes a ReadableStream of bytes and yields the data payload of each
 * `data:` line, handling partial chunks split across reads.  Pure SSE
 * framing — knows nothing about OpenAI, JSON, or [DONE] sentinels.
 * Those are the caller's concern.
 *
 * Lines that don't start with `data:` (comments, event/id/retry fields,
 * blank lines) are silently skipped, per the SSE spec.
 */

export class SSEParser {
  private _reader: ReadableStreamDefaultReader<Uint8Array>;
  private _decoder = new TextDecoder();
  private _buffer = '';
  private _done = false;

  constructor(stream: ReadableStream<Uint8Array>) {
    this._reader = stream.getReader();
  }

  /**
   * Yield the next `data:` payload, or `null` when the stream ends.
   * Returns null once the stream is exhausted; subsequent calls also
   * return null.
   */
  async next(): Promise<string | null> {
    if (this._done) return null;

    while (true) {
      // Try to pull a complete line from the buffer
      const nlIdx = this._buffer.indexOf('\n');
      if (nlIdx >= 0) {
        const line = this._buffer.slice(0, nlIdx);
        this._buffer = this._buffer.slice(nlIdx + 1);
        const payload = extractData(line);
        if (payload !== null) return payload;
        continue;
      }

      // Need more bytes
      const { done, value } = await this._reader.read();
      if (done) {
        this._done = true;
        // Flush any trailing line without a newline
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

  /** Release the reader lock. Safe to call after iteration. */
  release(): void {
    try {
      this._reader.releaseLock();
    } catch {
      // Already released or locked — ignore
    }
  }
}

/**
 * If the line is a `data:` field, return its payload (with the
 * single space after the colon stripped, per the SSE spec).  Otherwise
 * return null (comment, blank line, or other field).
 */
function extractData(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return null;
  // `data:value` or `data: value`
  const rest = trimmed.slice(5);
  return rest.startsWith(' ') ? rest.slice(1) : rest;
}
