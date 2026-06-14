import type { BunproGrammarItem, BunproGrammarProgress } from '@/core/import/import.types';
import type { AppError, Result } from '@/types/result.types';

const BUNPRO_API_BASE = 'https://api.bunpro.jp/api/frontend';
const REQUEST_DELAY_MS = 250;
const MAX_NETWORK_RETRIES = 3;
const MAX_PAGES_PER_LEVEL = 50;

type FetchLike = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

export type BunproClientDeps = {
  fetchImpl?: FetchLike;
  sleep?: SleepFn;
};

type BunproSrsLevelConfig = {
  level: string;
  stage: number;
  stageName: string;
};

const GRAMMAR_SRS_LEVELS: BunproSrsLevelConfig[] = [
  { level: 'apprentice_1', stage: 1, stageName: 'apprentice' },
  { level: 'apprentice_2', stage: 2, stageName: 'apprentice' },
  { level: 'apprentice_3', stage: 3, stageName: 'apprentice' },
  { level: 'apprentice_4', stage: 4, stageName: 'apprentice' },
  { level: 'guru_1', stage: 5, stageName: 'guru' },
  { level: 'guru_2', stage: 6, stageName: 'guru' },
  { level: 'master', stage: 7, stageName: 'master' },
  { level: 'enlightened', stage: 8, stageName: 'enlightened' },
  { level: 'burned', stage: 9, stageName: 'burned' },
];

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function networkError(message: string, userMessage: string, cause?: unknown): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'bunpro_network_error',
      message,
      userMessage,
      cause,
    },
  };
}

function authError(status: number): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'bunpro_invalid_token',
      message: `Bunpro API returned ${status}`,
      userMessage:
        'Invalid token. Make sure you copied the frontend_api_token cookie value from bunpro.jp.',
    },
  };
}

function endpointUnavailable(status: number): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'bunpro_endpoint_unavailable',
      message: `Bunpro API returned ${status}`,
      userMessage:
        'This Bunpro API endpoint is currently unavailable. You can skip import and mark grammar items manually.',
    },
  };
}

function noGrammarDataError(): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'bunpro_no_grammar_data',
      message: 'Bunpro API returned no grammar progress',
      userMessage:
        'No Bunpro grammar progress was found. Your account may have no grammar in SRS, or the API returned no data. You can skip import and mark grammar manually.',
    },
  };
}

function extractGrammarPointId(record: Record<string, unknown>): string | null {
  const candidates = [
    record.grammar_point_id,
    record.grammarPointId,
    record.reviewable_id,
    record.reviewableId,
    record.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function extractItemsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.reviewables, record.items, record.results];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function extractNextPage(payload: unknown, currentPage: number): number | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const meta = record.meta;
  if (meta && typeof meta === 'object') {
    const metaRecord = meta as Record<string, unknown>;
    if (typeof metaRecord.next_page === 'number' && metaRecord.next_page > currentPage) {
      return metaRecord.next_page;
    }
    if (metaRecord.next_page === null) {
      return null;
    }
  }

  if (typeof record.next_page === 'number' && record.next_page > currentPage) {
    return record.next_page;
  }

  return null;
}

function parseGrammarItemsFromPayload(
  payload: unknown,
  levelConfig: BunproSrsLevelConfig,
): BunproGrammarItem[] {
  const rawItems = extractItemsFromPayload(payload);
  const parsed: BunproGrammarItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') {
      continue;
    }

    const record = rawItem as Record<string, unknown>;
    const grammarPointId = extractGrammarPointId(record);
    if (!grammarPointId) {
      continue;
    }

    let srsStage = levelConfig.stage;
    const stageCandidate = record.srs_stage ?? record.srsStage ?? record.level;
    if (typeof stageCandidate === 'number' && stageCandidate > 0) {
      srsStage = stageCandidate;
    }

    let srsStageName = levelConfig.stageName;
    const stageNameCandidate = record.srs_stage_name ?? record.srsStageName;
    if (typeof stageNameCandidate === 'string' && stageNameCandidate.length > 0) {
      srsStageName = stageNameCandidate;
    }

    parsed.push({
      grammarPointId,
      srsStage,
      srsStageName,
    });
  }

  return parsed;
}

export class BunproClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepFn;

  constructor(
    private readonly token: string,
    deps: BunproClientDeps = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  async fetchGrammarProgress(): Promise<Result<BunproGrammarProgress, AppError>> {
    const items: BunproGrammarItem[] = [];
    let unavailableLevelCount = 0;

    for (const levelConfig of GRAMMAR_SRS_LEVELS) {
      const levelResult = await this.fetchGrammarItemsForLevel(levelConfig);
      if (!levelResult.ok) {
        if (levelResult.error.code === 'bunpro_endpoint_unavailable') {
          unavailableLevelCount += 1;
          continue;
        }
        return levelResult;
      }

      items.push(...levelResult.value);
      await this.sleep(REQUEST_DELAY_MS);
    }

    if (items.length > 0) {
      return { ok: true, value: { items, unavailableLevelCount } };
    }

    if (unavailableLevelCount > 0) {
      return endpointUnavailable(500);
    }

    return noGrammarDataError();
  }

  private async fetchGrammarItemsForLevel(
    levelConfig: BunproSrsLevelConfig,
  ): Promise<Result<BunproGrammarItem[], AppError>> {
    const items: BunproGrammarItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES_PER_LEVEL) {
      const pageResult = await this.fetchGrammarLevelPage(levelConfig, page);
      if (!pageResult.ok) {
        return pageResult;
      }

      items.push(...pageResult.value.items);

      if (pageResult.value.nextPage === null || pageResult.value.nextPage > MAX_PAGES_PER_LEVEL) {
        hasMore = false;
      } else {
        page = pageResult.value.nextPage;
        await this.sleep(REQUEST_DELAY_MS);
      }
    }

    return { ok: true, value: items };
  }

  private async fetchGrammarLevelPage(
    levelConfig: BunproSrsLevelConfig,
    page: number,
    attempt = 0,
  ): Promise<Result<{ items: BunproGrammarItem[]; nextPage: number | null }, AppError>> {
    const url =
      `${BUNPRO_API_BASE}/user_stats/srs_level_details` +
      `?level=${encodeURIComponent(levelConfig.level)}` +
      `&reviewable_type=${encodeURIComponent('Grammar')}` +
      `&page=${page}`;

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Token token=${this.token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        return authError(response.status);
      }

      if (response.status >= 500) {
        return endpointUnavailable(response.status);
      }

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: 'bunpro_request_failed',
            message: `Bunpro API returned ${response.status}`,
            userMessage: 'Could not import from Bunpro. Please try again.',
          },
        };
      }

      const payload = await response.json();
      const items = parseGrammarItemsFromPayload(payload, levelConfig);
      const nextPage = extractNextPage(payload, page);

      return { ok: true, value: { items, nextPage } };
    } catch (cause) {
      if (attempt >= MAX_NETWORK_RETRIES) {
        return networkError(
          'Bunpro network request failed',
          'Could not reach Bunpro. Check your connection and try again.',
          cause,
        );
      }

      await this.sleep(500 * (attempt + 1));
      return this.fetchGrammarLevelPage(levelConfig, page, attempt + 1);
    }
  }
}

export async function fetchBunproGrammarProgress(
  token: string,
  deps: BunproClientDeps = {},
): Promise<Result<BunproGrammarProgress, AppError>> {
  const client = new BunproClient(token, deps);
  return client.fetchGrammarProgress();
}
