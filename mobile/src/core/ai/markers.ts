/**
 * In-band control markers (FR97).
 *
 * Control signals travel inside the reply text as hidden sentinels that the app
 * strips before render — deliberately not a tool-calling layer, which every
 * BYOK-reachable endpoint would have to implement identically and which the
 * OpenAI-compatible and Anthropic wire formats spell differently.
 *
 * Angle brackets, never square: an AI reply is furigana bracket notation
 * (`私[わたし]は`), so a `[...]` sentinel would read as a malformed reading and
 * `parseFurigana` would degrade the whole message to plain text. Callers must
 * strip markers *before* handing text to `parseFurigana` for the same reason.
 */

/** The AI's judgement that the scene has reached a natural end (FR94/FR96). */
export const WRAP_UP_MARKER = '<<<END_SESSION>>>';

export type AiControlMarker = typeof WRAP_UP_MARKER;

export const AI_CONTROL_MARKERS: readonly AiControlMarker[] = [WRAP_UP_MARKER];

export type MarkerScanResult = {
  /** The reply with every known marker removed, ready for `parseFurigana`. */
  text: string;
  /** Markers found, in the order they appeared. */
  markers: AiControlMarker[];
  /** Convenience: the AI signalled the session should wrap up. */
  wrapUp: boolean;
};

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MARKER_PATTERN = new RegExp(
  AI_CONTROL_MARKERS.map(escapeForRegExp).join('|'),
  'g',
);

/**
 * Removes control markers from a reply and reports which were present.
 *
 * Whitespace left behind by a stripped marker is collapsed so a sentinel on its
 * own line does not render as a trailing blank line. Never throws: unknown
 * bracket-shaped text is simply left alone for `parseFurigana` to handle.
 */
export function stripControlMarkers(reply: string): MarkerScanResult {
  const markers: AiControlMarker[] = [];

  const stripped = reply.replace(MARKER_PATTERN, (match) => {
    markers.push(match as AiControlMarker);
    return '';
  });

  return {
    text: stripped.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    markers,
    wrapUp: markers.includes(WRAP_UP_MARKER),
  };
}

/**
 * True once a partial (mid-stream) chunk already contains a complete marker.
 * Streaming callers use this to avoid flashing a half-written sentinel on
 * screen; the authoritative scan still runs on the completed turn.
 */
export function containsControlMarker(partial: string): boolean {
  return AI_CONTROL_MARKERS.some((marker) => partial.includes(marker));
}
