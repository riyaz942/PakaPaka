import {
  containsControlMarker,
  stripControlMarkers,
  WRAP_UP_MARKER,
} from '@/core/ai/markers';
import { parseFurigana } from '@/core/furigana/parseFurigana';

describe('stripControlMarkers', () => {
  it('returns the reply untouched when no marker is present', () => {
    const result = stripControlMarkers('元気[げんき]ですか。');

    expect(result.text).toBe('元気[げんき]ですか。');
    expect(result.markers).toEqual([]);
    expect(result.wrapUp).toBe(false);
  });

  it('removes the wrap-up marker and reports it', () => {
    const result = stripControlMarkers(`またね！\n${WRAP_UP_MARKER}`);

    expect(result.text).toBe('またね！');
    expect(result.markers).toEqual([WRAP_UP_MARKER]);
    expect(result.wrapUp).toBe(true);
  });

  it('strips a marker embedded mid-reply without eating surrounding text', () => {
    const result = stripControlMarkers(`はい。${WRAP_UP_MARKER}お疲[つか]れさま。`);

    expect(result.text).toBe('はい。お疲[つか]れさま。');
    expect(result.wrapUp).toBe(true);
  });

  it('collapses the blank line a marker on its own line would leave behind', () => {
    const result = stripControlMarkers(`一行目\n\n${WRAP_UP_MARKER}\n\n`);

    expect(result.text).toBe('一行目');
  });

  it('leaves furigana brackets parseable after stripping — the marker must not look like a reading', () => {
    const reply = `私[わたし]は学生[がくせい]です。${WRAP_UP_MARKER}`;

    const stripped = stripControlMarkers(reply);
    const segments = parseFurigana(stripped.text);

    // If the marker survived (or used square brackets), parseFurigana would
    // treat the whole reply as malformed and collapse it to one plain segment.
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.some((segment) => segment.reading === 'わたし')).toBe(true);
    expect(segments.some((segment) => segment.reading === 'がくせい')).toBe(true);
    expect(segments.map((segment) => segment.text).join('')).not.toContain('<');
  });

  it('never throws on bracket-shaped text it does not own', () => {
    expect(() => stripControlMarkers('壊[こわ れた')).not.toThrow();
    expect(stripControlMarkers('壊[こわ れた').text).toBe('壊[こわ れた');
  });
});

describe('containsControlMarker', () => {
  it('detects a complete marker in a partial chunk', () => {
    expect(containsControlMarker(`まだ ${WRAP_UP_MARKER}`)).toBe(true);
  });

  it('does not fire on a half-streamed marker', () => {
    expect(containsControlMarker('まだ <<<END_SES')).toBe(false);
  });
});
