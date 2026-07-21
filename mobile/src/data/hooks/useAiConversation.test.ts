import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { AiSessionRecord, ChatMessage } from '@/core/ai/aiSession.types';
import { useAiConversation } from '@/data/hooks/useAiConversation';

const mockResolveConfig = jest.fn();
jest.mock('@/data/ai/aiConfig', () => ({
  resolveAiConfigForSession: (...args: unknown[]) => mockResolveConfig(...args),
}));

const mockStream = jest.fn();
jest.mock('@/data/ai/streamingClient', () => ({
  streamAssistantTurn: (...args: unknown[]) => mockStream(...args),
}));

// One stable handle, as `DatabaseProvider` supplies in the app — a fresh object
// per render would re-fire the load effect and wipe state mid-test.
const userDb = {};
jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb }),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => 'N5',
}));

let mockSession: AiSessionRecord | null = null;
let mockMessages: ChatMessage[] = [];
const mockAppend = jest.fn();
const mockEnd = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/data/user/aiSessionRepository', () => ({
  getAiSession: (...args: unknown[]) => mockGetSession(...args),
  listAiMessages: () => mockMessages,
  appendAiMessage: (...args: unknown[]) => mockAppend(...args),
  endAiSession: (...args: unknown[]) => mockEnd(...args),
}));

function session(overrides: Partial<AiSessionRecord> = {}): AiSessionRecord {
  return {
    id: 's1',
    provider: 'openai',
    model: 'gpt-4o-mini',
    mode: 'random',
    topicItemId: null,
    topicItemIds: [],
    startedAt: '2026-07-20T00:00:00.000Z',
    endedAt: null,
    endedReason: null,
    turnCount: 0,
    summary: null,
    summaryGeneratedAt: null,
    ...overrides,
  };
}

function message(id: string, role: 'user' | 'assistant', content: string): ChatMessage {
  return { id, sessionId: 's1', role, content, createdAt: '2026-07-20T00:00:00.000Z' };
}

beforeEach(() => {
  mockSession = session();
  mockMessages = [];
  mockGetSession.mockReset();
  mockGetSession.mockImplementation(() => mockSession);
  mockAppend.mockReset();
  mockAppend.mockImplementation((_db, _id, role: 'user' | 'assistant', content: string) =>
    message(`m-${role}-${content.slice(0, 4)}`, role, content),
  );
  mockEnd.mockReset();
  mockResolveConfig.mockReset();
  mockResolveConfig.mockResolvedValue({
    ok: true,
    value: { adapter: {}, apiKey: 'sk', model: 'gpt-4o-mini', baseUrl: 'https://api.test/v1' },
  });
  mockStream.mockReset();
  mockStream.mockResolvedValue({ ok: true, value: { text: 'はい。', complete: true } });
});

describe('useAiConversation', () => {
  it('commits the learner turn and the reply', async () => {
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });

    expect(result.current.messages.map((m) => m.content)).toEqual(['こんにちは', 'はい。']);
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('refuses to send into a session that already ended', async () => {
    mockSession = session({ endedAt: '2026-07-20T01:00:00.000Z', endedReason: 'user_end' });
    const { result } = renderHook(() => useAiConversation('s1'));

    let accepted = true;
    await act(async () => {
      accepted = await result.current.send('まだ話したい');
    });

    expect(accepted).toBe(false);
    expect(mockAppend).not.toHaveBeenCalled();
    expect(result.current.error?.code).toBe('ai_session_ended');
  });

  it('returns false instead of throwing when the database write fails', async () => {
    mockAppend.mockImplementation(() => {
      throw new Error('SQLITE_BUSY');
    });
    const { result } = renderHook(() => useAiConversation('s1'));

    let accepted = true;
    await act(async () => {
      // A rejected promise here would surface as an unhandled rejection at the
      // floating `onSend={(text) => send(text)}` call site.
      accepted = await result.current.send('こんにちは');
    });

    expect(accepted).toBe(false);
    expect(result.current.error?.code).toBe('ai_turn_failed');
    expect(result.current.isStreaming).toBe(false);
  });

  it('keeps salvaged text and reports a real stream failure', async () => {
    mockStream.mockResolvedValue({
      ok: false,
      error: {
        code: 'ai_network_error',
        message: 'dropped',
        userMessage: 'Could not reach your provider.',
        partialText: 'はい、',
      },
    });
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });

    expect(result.current.messages.map((m) => m.content)).toEqual(['こんにちは', 'はい、']);
    expect(result.current.error?.userMessage).toBe('Could not reach your provider.');
  });

  it('does not report an error for a stream the learner deliberately stopped', async () => {
    mockStream.mockResolvedValue({
      ok: false,
      error: {
        code: 'ai_stream_aborted',
        message: 'Stream aborted',
        userMessage: 'The reply was stopped.',
        partialText: '',
      },
    });
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });

    expect(result.current.error).toBeNull();
  });

  it('flags a reply that ended without a completion signal', async () => {
    mockStream.mockResolvedValue({ ok: true, value: { text: 'はい、そう', complete: false } });
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });

    // The turn is kept — it is real text — but it must not read as finished.
    expect(result.current.messages.map((m) => m.content)).toContain('はい、そう');
    expect(result.current.error?.code).toBe('ai_stream_truncated');
  });

  it('says so when the provider returns nothing usable', async () => {
    mockStream.mockResolvedValue({ ok: true, value: { text: '   ', complete: true } });
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });

    expect(result.current.error?.code).toBe('ai_empty_reply');
  });

  it('offers resend after a failure and re-asks without stacking a turn', async () => {
    mockStream.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ai_network_error',
        message: 'dropped',
        userMessage: 'Could not reach your provider.',
        partialText: '',
      },
    });
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    await act(async () => {
      await result.current.retry();
    });

    // One learner turn on the record, two attempts at a reply.
    expect(mockAppend.mock.calls.filter((call) => call[2] === 'user')).toHaveLength(1);
    expect(result.current.messages.map((m) => m.content)).toEqual(['こんにちは', 'はい。']);
  });

  it('will not retry when the last turn is already answered', async () => {
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('こんにちは');
    });

    expect(result.current.canRetry).toBe(false);
  });

  it('aborts an in-flight stream when the session is ended', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockStream.mockImplementation(
      (_adapter, _request, _callbacks, signal: AbortSignal) =>
        new Promise((resolve) => {
          capturedSignal = signal;
          signal.addEventListener('abort', () =>
            resolve({
              ok: false,
              error: {
                code: 'ai_stream_aborted',
                message: 'Stream aborted',
                userMessage: 'The reply was stopped.',
                partialText: '',
              },
            }),
          );
        }),
    );

    const { result } = renderHook(() => useAiConversation('s1'));

    let sending: Promise<boolean>;
    act(() => {
      sending = result.current.send('こんにちは');
    });
    await waitFor(() => expect(capturedSignal).toBeDefined());

    await act(async () => {
      await result.current.end('user_end');
      await sending;
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(mockEnd).toHaveBeenCalledWith({}, 's1', 'user_end');
    expect(result.current.error).toBeNull();
  });

  it('raises the wrap-up signal from a marker in the reply', async () => {
    mockStream.mockResolvedValue({
      ok: true,
      value: { text: 'またね。<<<END_SESSION>>>', complete: true },
    });
    const { result } = renderHook(() => useAiConversation('s1'));

    await act(async () => {
      await result.current.send('さようなら');
    });

    expect(result.current.wrapUpSignalled).toBe(true);
    // The sentinel is stripped before the turn is persisted.
    expect(result.current.messages.map((m) => m.content)).toContain('またね。');
  });

  it('hides a sentinel that arrives split across two deltas', async () => {
    const seen: string[] = [];
    mockStream.mockImplementation(async (_adapter, _request, callbacks) => {
      callbacks.onDelta('またね。<<<END_SESS');
      seen.push('after-partial');
      callbacks.onDelta('ION>>>');
      return { ok: true, value: { text: 'またね。<<<END_SESSION>>>', complete: true } };
    });

    const { result } = renderHook(() => useAiConversation('s1'));
    const pending: string[] = [];

    await act(async () => {
      await result.current.send('さようなら');
    });

    // Nothing that ever reached `pendingReply` may contain a partial sentinel.
    pending.push(result.current.pendingReply);
    expect(pending.every((text) => !text.includes('<<<END'))).toBe(true);
    expect(seen).toContain('after-partial');
  });
});
