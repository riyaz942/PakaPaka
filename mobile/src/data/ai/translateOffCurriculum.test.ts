import { translateOffCurriculumWord } from '@/data/ai/translateOffCurriculum';

const mockResolve = jest.fn();
jest.mock('@/data/ai/aiConfig', () => ({
  resolveAiConfigForSession: (...args: unknown[]) => mockResolve(...args),
}));

const mockStream = jest.fn();
jest.mock('@/data/ai/streamingClient', () => ({
  streamAssistantTurn: (...args: unknown[]) => mockStream(...args),
}));

const SESSION = { provider: 'openai' as const, model: 'gpt-4o-mini' };

function configured() {
  return {
    ok: true,
    value: {
      provider: 'openai',
      adapter: {},
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
    },
  };
}

describe('translateOffCurriculumWord', () => {
  beforeEach(() => {
    mockResolve.mockReset();
    mockStream.mockReset();
  });

  it('parses a JSON gloss from the provider reply', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({
      ok: true,
      value: { text: 'Here you go: {"reading":"らーめん","meaning":"ramen"}', complete: true },
    });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン', SESSION);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        text: 'ラーメン',
        reading: 'らーめん',
        meaning: 'ramen',
      });
    }
  });

  it('resolves the provider from the session, not from live preferences', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({ ok: true, value: { text: '{"meaning":"x"}', complete: true } });

    await translateOffCurriculumWord({} as never, 'ラーメン', {
      provider: 'anthropic',
      model: 'claude-x',
    });

    // The word belongs to that session's transcript, so a Settings change must
    // not redirect it to the other provider's endpoint.
    expect(mockResolve).toHaveBeenCalledWith({}, { provider: 'anthropic', model: 'claude-x' });
  });

  it('passes the abort signal through to the stream', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({ ok: true, value: { text: '{"meaning":"x"}', complete: true } });
    const controller = new AbortController();

    await translateOffCurriculumWord({} as never, 'ラーメン', SESSION, controller.signal);

    expect(mockStream.mock.calls[0][3]).toBe(controller.signal);
  });

  it('refuses an empty surface form without calling the provider', async () => {
    const result = await translateOffCurriculumWord({} as never, '   ', SESSION);
    expect(result.ok).toBe(false);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('reports a parse failure when the reply carries no JSON', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({
      ok: true,
      value: { text: 'I think it means ramen, probably.', complete: true },
    });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン', SESSION);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ai_translate_parse');
    }
  });

  it('rejects JSON that carries neither a reading nor a meaning', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({
      ok: true,
      value: { text: '{"reading":"  ","meaning":""}', complete: true },
    });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン', SESSION);

    expect(result.ok).toBe(false);
  });

  it('passes a stream failure straight through', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({
      ok: false,
      error: { code: 'ai_network_error', message: 'down', userMessage: 'No connection.' },
    });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン', SESSION);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ai_network_error');
      expect(result.error.userMessage).toBe('No connection.');
    }
  });

  it('fails without calling the provider when no key is configured', async () => {
    mockResolve.mockResolvedValue({ ok: true, value: null });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン', SESSION);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ai_not_configured');
    }
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('clamps a model that ignores the compact-JSON instruction', async () => {
    mockResolve.mockResolvedValue(configured());
    mockStream.mockResolvedValue({
      ok: true,
      value: { text: `{"reading":"ら","meaning":"${'x'.repeat(500)}"}`, complete: true },
    });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン', SESSION);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.meaning.length).toBeLessThanOrEqual(201);
    }
  });
});
