import { translateOffCurriculumWord } from '@/data/ai/translateOffCurriculum';

const mockResolve = jest.fn();
jest.mock('@/data/ai/aiConfig', () => ({
  resolveAiConfig: (...args: unknown[]) => mockResolve(...args),
}));

const mockStream = jest.fn();
jest.mock('@/data/ai/streamingClient', () => ({
  streamAssistantTurn: (...args: unknown[]) => mockStream(...args),
}));

describe('translateOffCurriculumWord', () => {
  beforeEach(() => {
    mockResolve.mockReset();
    mockStream.mockReset();
  });

  it('parses a JSON gloss from the provider reply', async () => {
    mockResolve.mockResolvedValue({
      ok: true,
      value: {
        provider: 'openai',
        adapter: {},
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
      },
    });
    mockStream.mockResolvedValue({
      ok: true,
      value: { text: 'Here you go: {"reading":"らーめん","meaning":"ramen"}', complete: true },
    });

    const result = await translateOffCurriculumWord({} as never, 'ラーメン');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        text: 'ラーメン',
        reading: 'らーめん',
        meaning: 'ramen',
      });
    }
  });

  it('refuses an empty surface form without calling the provider', async () => {
    const result = await translateOffCurriculumWord({} as never, '   ');
    expect(result.ok).toBe(false);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
