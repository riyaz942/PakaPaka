import type { ByokProvider } from '@/data/ai/byokCredential.types';

/** How a session was started (FR89). Chat is the default mode (FR90). */
export type ConversationMode =
  | 'practise_recent_grammar'
  | 'choose_grammar'
  | 'role_play'
  | 'random';

export const CONVERSATION_MODES: readonly ConversationMode[] = [
  'practise_recent_grammar',
  'choose_grammar',
  'role_play',
  'random',
];

export function isConversationMode(value: string): value is ConversationMode {
  return (CONVERSATION_MODES as readonly string[]).includes(value);
}

/** Why a session ended (FR94) — the three-way end. */
export type SessionEndReason = 'ai_wrap_up' | 'user_end' | 'abandoned';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: ChatRole;
  /** Raw turn text as persisted — markers already stripped before this is written. */
  content: string;
  createdAt: string;
};

/** A turn as handed to an adapter: no ids, no persistence concerns. */
export type AdapterMessage = {
  role: ChatRole;
  content: string;
};

/** Everything an adapter needs to build one request. */
export type AdapterRequest = {
  apiKey: string;
  model: string;
  /** Only meaningful for the OpenAI-compatible adapter. */
  baseUrl?: string;
  systemPrompt: string;
  messages: AdapterMessage[];
  maxTokens: number;
};

/** The transport-neutral shape every adapter normalizes its provider into. */
export type AdapterHttpRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

/**
 * One decoded SSE payload. Adapters return `null` for frames that carry no
 * text and no terminal signal (keep-alives, role preambles, provider-specific
 * bookkeeping) so the streaming client can ignore them uniformly.
 */
export type AdapterStreamEvent =
  /** `done: true` when the provider ends the turn in the same frame as text. */
  | { type: 'delta'; text: string; done?: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type AiAdapter = {
  provider: ByokProvider;
  /** Builds the streaming chat request. */
  buildStreamRequest: (request: AdapterRequest) => AdapterHttpRequest;
  /**
   * Decodes one `data:` payload from the SSE body. `eventName` is the SSE
   * `event:` field when the provider sends one (Anthropic does, OpenAI does not).
   */
  parseStreamData: (data: string, eventName?: string) => AdapterStreamEvent | null;
  /** Maps a non-2xx response to a stable, lowercase snake_case error code. */
  mapHttpError: (status: number, body: string) => { code: string; userMessage: string };
};

/** The cached, generate-once session summary (FR95, FR96). */
export type SessionSummary = {
  /** At most five mistakes worth fixing (FR95). */
  mistakes: { quote: string; correction: string; note: string }[];
  /** Words met during the session, split by curriculum membership (FR92). */
  wordsMet: { text: string; itemId: string | null }[];
  /** Free-text notes on the grammar the learner practised. */
  grammarNotes: string[];
};

export type AiSessionRecord = {
  id: string;
  provider: ByokProvider;
  model: string;
  mode: ConversationMode;
  topicItemId: string | null;
  /**
   * Every grammar item this session was grounded in, pinned when it started.
   * Resuming replays these rather than re-deriving "recent", which drifts as
   * the learner studies. Empty for modes that are not grammar-grounded.
   */
  topicItemIds: string[];
  startedAt: string;
  endedAt: string | null;
  endedReason: SessionEndReason | null;
  turnCount: number;
  summary: SessionSummary | null;
  summaryGeneratedAt: string | null;
};

/** FR95 caps the mistake list; enforced where the summary is parsed. */
export const MAX_SUMMARY_MISTAKES = 5;
