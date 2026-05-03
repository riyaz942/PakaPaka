---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-03'
inputDocuments:
  - "planning-artifacts/product-brief-japanese-learning-2026-04-12.md"
  - "planning-artifacts/prd.md"
  - "planning-artifacts/prd-validation-report.md"
  - "planning-artifacts/ux-design-specification.md"
  - "planning-artifacts/research/market-open-source-local-first-japanese-learning-learners-research-2026-03-21.md"
workflowType: 'architecture'
project_name: 'japanese-learning'
user_name: 'Riyaz'
date: '2026-05-02'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

72 FRs spanning 11 domains. Architecturally, they cluster into five subsystems:

1. **Content & Curriculum Engine** (FR1-FR8c): Strict dependency graph (radical→kanji→vocab), JLPT-organized content, structured grammar schemas with conjugation rules, reading passages with JLPT tagging. Requires a precomputed relationship graph stored in SQLite and queried at review time, lesson unlocking, and reinforcement display.

2. **SRS & Review Engine** (FR9-FR14, FR29-FR33): FSRS-based scheduling, input-based testing, unified review mixer interleaving content types, weakness detection with per-item error tracking and pattern tags, priority calculation at queue build time. The review loop is the performance-critical path (<100ms feedback).

3. **Engagement & Intelligence Layer** (FR15-FR20, FR33b-FR33c, FR12/FR12b): Cognitive load ring tracking daily mental strain, visible cross-domain reinforcement, time compression display, streak system with notifications. These features consume data produced by the SRS engine and content graph.

4. **Import & Onboarding** (FR21-FR26, FR33d-FR33h): WaniKani API import, Bunpro import, Anki deck parsing, manual item marking with bulk operations, session intensity configuration. Import must map external items to internal curriculum and convert foreign SRS states to FSRS intervals.

5. **Content Pipeline & Distribution** (FR34-FR37b, FR46-FR51): JSON source → GitHub Actions → SQLite compilation → Git LFS versioning → app downloads on startup. Visual mnemonics on Cloudflare R2. OTA updates via Expo Updates.

Post-MVP features (FR38-FR45, marked -PM) add AI-generated content, community contribution pipeline, and GitHub OAuth — these should not constrain MVP architecture but the data model should not preclude them.

**Non-Functional Requirements:**

Architecture-shaping NFRs:

- **NFR1-NFR2**: <100ms for review interactions and SQLite queries on mid-range devices — drives pre-fetching strategy, index design, and query optimization
- **NFR3**: <3s cold start to interactive screen — constrains initialization logic and database loading
- **NFR5b**: Zero UI animations in the review loop — simplifies review renderer but demands no accidental blocking
- **NFR6-NFR9**: All data local, API keys in secure storage, no user data transmitted — eliminates backend auth entirely
- **NFR10**: User progress survives app updates and database updates — requires schema migration strategy and separation of user data from curriculum data
- **NFR11-NFR12**: Pipeline validates integrity; interrupted downloads are discarded — atomic update model
- **NFR14-NFR17**: WCAG 2.1 AA accessibility, screen readers, 200% text scaling — accessibility baked into component architecture
- **NFR21-NFR22**: Schema supports N5→N1 growth without migration; query performance holds at 10,000+ items — drives indexing and potential sharding strategy

**Scale & Complexity:**

- Primary domain: Cross-platform mobile (React Native / Expo)
- Complexity level: Medium-High
- Estimated architectural components: ~12-15 major modules (content engine, SRS scheduler, weakness engine, review mixer, queue builder, import subsystem, content pipeline, reinforcement resolver, cognitive load tracker, grammar parser, UI component library, notification service, database layer, update manager)

### Technical Constraints & Dependencies

**Platform constraints:**
- React Native (Expo managed workflow) — single codebase for Android & iOS
- SQLite as sole persistent storage (no remote database)
- Must work fully offline after initial content download
- Portrait-locked on phones; tablet landscape is post-MVP

**External dependencies:**
- `ts-fsrs` — FSRS scheduling algorithm (MIT-licensed)
- `wanakana` — romaji-to-hiragana conversion (runs in JS runtime)
- `expo-sqlite` or `react-native-quick-sqlite` — SQLite access (evaluate for <100ms target)
- NativeWind v4+ — Tailwind CSS for React Native styling
- Expo ecosystem: `expo-secure-store`, `expo-file-system`, `expo-haptics`, `expo-notifications`, `expo-updates`
- Cloudflare R2 — static media hosting for visual mnemonics (public URLs, no auth)
- GitHub Actions — CI/CD for JSON→SQLite compilation
- Git LFS — versioned database distribution

**Known risk areas:**
- Bunpro API/export availability is uncertain (FR33e) — fallback to manual marking required
- Grammar parser complexity for conjugation-aware validation — phased approach starting with common verb forms
- SQLite write lock under bulk operations (identified in PRD user journey — batch updates needed)
- WanaKana performance in React Native JS runtime — needs early validation

### Cross-Cutting Concerns Identified

1. **Offline-first data consistency**: Every feature must work without network. All state is local. No feature should assume connectivity except explicit import/update flows.

2. **SRS state lifecycle**: Radicals, kanji, vocabulary, and grammar items all share the same SRS state model (FSRS intervals + weakness stats). The data model must be unified across content types while allowing type-specific fields (onyomi/kunyomi for kanji, conjugation rules for grammar).

3. **Content relationship graph**: The radical→kanji→vocab dependency graph plus grammar→vocab associations are queried by: lesson unlocking, review queue building, cross-domain reinforcement display, and reading passage highlighting. This graph must be precomputed and indexed for fast traversal.

4. **Queue building pipeline**: Review queue construction combines FSRS scheduling, weakness biasing, content type interleaving, and cognitive load weighting. This pipeline runs at session start and must complete within the <100ms budget to enable instant session launch.

5. **Japanese text handling**: WanaKana conversion, Levenshtein typo detection for English, and conjugation-aware grammar validation all operate on user input. These must be composable per content type (reading prompt → WanaKana + Levenshtein kana; meaning prompt → Levenshtein English; grammar prompt → parser + fallback).

6. **Curriculum vs. user data separation**: The curriculum database is replaced on updates (downloaded SQLite). User progress data must never be overwritten. These must be architecturally separate — either separate databases/tables or a clear migration contract.

7. **Import mapping layer**: WaniKani, Bunpro, and Anki imports each require mapping foreign item IDs to internal curriculum IDs and converting foreign SRS states to FSRS intervals. A shared mapping/conversion abstraction prevents three ad-hoc implementations.

## Starter Template Evaluation

### Primary Technology Domain

Cross-platform mobile application using **React Native / Expo** — identified from PRD project classification and UX specification. All technology preferences are pre-established in project documentation.

### Starter Options Considered

**Option A: `create-expo-app` with `default@sdk-55` template (Recommended)**

The official Expo SDK 55 default template. Current as of 2026. Includes:
- Expo Router (file-based routing) — matches the 5-tab navigation model (Home, Learn, Read, Stats, Settings)
- TypeScript configured out of the box
- React Native 0.83 / React 19.2
- Native Tabs API (new in SDK 55) — aligns with bottom tab navigation requirement
- `/src` folder structure (SDK 55 improvement) — cleaner code organization
- Maintained by the Expo team with each SDK release

**Option B: `blank-typescript` template**

Minimal Expo template with TypeScript. No routing, no navigation. Would require manually adding Expo Router, tab navigation, and project structure. More setup work for no architectural advantage — the default template's structure aligns well with this project's needs.

**Option C: Third-party boilerplates (Ignite, Obytes, etc.)**

Community-maintained starters that bundle opinions on state management, API layers, and testing. These add unnecessary abstractions for a local-first app with no backend API. The opinions they encode (Redux/Zustand for remote state, API client layers, authentication scaffolding) don't apply here — this app's state is entirely local SQLite.

### Selected Starter: Expo SDK 55 Default Template

**Rationale for Selection:**

1. **File-based routing via Expo Router** matches the tab navigation model (Home, Learn, Read, Stats, Settings) and the modal context pattern (review sessions).
2. **SDK 55's `/src` structure** provides cleaner organization for the ~12-15 modules identified in the project context.
3. **Official template** guarantees compatibility with Expo's managed workflow, EAS Build, and Expo Updates — all required by the PRD.
4. **Minimal opinions** — doesn't impose state management, styling, or API patterns that conflict with the local-first, NativeWind-based architecture.
5. **Active maintenance** — updated with each SDK release, reducing dependency rot risk.

**Initialization Command:**

```bash
npx create-expo-app@latest japanese-learning --template default@sdk-55
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript (strict mode) with React 19.2 and React Native 0.83
- Expo SDK 55 managed workflow (no native directory management)

**Routing & Navigation:**
- Expo Router v4 (file-based routing)
- Native Tabs API for bottom tab navigation
- Stack navigation for drill-down screens
- Modal presentation for review sessions

**Build Tooling:**
- Metro bundler (configured by Expo)
- EAS Build for production builds (Android AAB, iOS IPA)
- EAS Submit for app store submission
- Expo Updates for OTA JS bundle patches

**Project Structure:**
- `/src/app/` — route files (file-based routing)
- `/src/components/` — shared components
- `/src/constants/` — design tokens, configuration
- Standard Expo asset management

**Development Experience:**
- Expo Go for rapid development (device preview)
- Expo DevTools for debugging
- TypeScript type checking
- Hot reloading

**Additional Configuration Required (Post-Init):**

| Layer | Package | Version | Purpose |
| --- | --- | --- | --- |
| Styling | `nativewind` | ^4.1.23 | Tailwind CSS for React Native |
| Styling | `tailwindcss` | ^3.4.17 | Tailwind engine (NativeWind v4 dependency) |
| Database | `expo-sqlite` | SDK 55 bundled | Local SQLite — default choice; evaluate performance early against <100ms target |
| SRS | `ts-fsrs` | ^5.3.2 | FSRS scheduling algorithm (MIT, zero deps) |
| Japanese Input | `wanakana` | latest | Romaji-to-hiragana conversion |
| Secure Storage | `expo-secure-store` | SDK 55 bundled | API key storage during import |
| File System | `expo-file-system` | SDK 55 bundled | Anki deck import, database updates |
| Haptics | `expo-haptics` | SDK 55 bundled | Tactile feedback on correct/incorrect |
| Notifications | `expo-notifications` | SDK 55 bundled | Streak reminders, daily review nudges |
| Updates | `expo-updates` | SDK 55 bundled | OTA JS bundle updates |
| Screen Lock | `expo-screen-orientation` | SDK 55 bundled | Portrait lock on phones |
| Images | `expo-image` | SDK 55 bundled | CDN image loading + local caching for radical mnemonics |

**SQLite Library Decision:**

`expo-sqlite` (SDK 55) is the default choice. It ships with Expo, requires no native module management, and has been improved in SDK 55 with ArrayBuffer optimizations and concurrency fixes. For this app's data scale (~500 items at MVP seed, growing to ~10,000+ at full N5-N1), typical queries return <100 items — well within `expo-sqlite`'s performance envelope on mid-range devices. If early benchmarking reveals <100ms target violations on the review queue build query (which combines FSRS scoring + weakness calculation), `op-sqlite` is the fallback — it offers ~30% faster raw query performance and 4x lower memory usage, but requires Expo config plugin.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Dual-database architecture (curriculum.db + user.db)
2. State management approach (SQLite-first + React Context)
3. Project code organization (feature-first with shared core)
4. Content pipeline architecture (JSON → SQLite → Git LFS → app)

**Important Decisions (Shape Architecture):**
5. Testing strategy (Jest unit tests for core, RNTL for components)
6. Error handling patterns (Result type, transactional SQLite, graceful degradation)

**Deferred Decisions (Post-MVP):**
- Community contribution pipeline architecture (GitHub OAuth, PR generation)
- AI provider integration patterns (BYO-key, OpenRouter)
- Cross-device sync mechanism
- Desktop (Electron) adaptation layer

### Data Architecture

**Decision: Dual SQLite Database Architecture**

| Aspect | Decision |
| --- | --- |
| Approach | Two separate SQLite databases: `curriculum.db` (read-only content) and `user.db` (read-write user state) |
| Rationale | Curriculum updates are an atomic file swap — no migration logic, no corruption risk, no user data loss. SQLite `ATTACH DATABASE` enables cross-database joins when needed. |
| Affects | All data access, content update flow, review queue building, import subsystem |

**`curriculum.db` (shipped/downloaded, replaced on update):**
- Items table (radicals, kanji, vocabulary, grammar — polymorphic with `item_type` discriminator)
- Item details tables (kanji readings, grammar conjugation rules, accepted answers, example sentences)
- Dependency graph (adjacency list: `parent_id → child_id` with relationship type)
- Grammar→vocabulary associations (for cross-domain reinforcement)
- Reading passages with JLPT tags and comprehension questions
- Visual mnemonic image URLs
- Curriculum metadata (version, build date, content counts)
- Precomputed indexes on `item_type`, `jlpt_level`, dependency relationships

**`user.db` (created on first launch, never replaced):**
- SRS state per item (`item_id`, FSRS fields: stability, difficulty, due date, state, reps, lapses)
- Weakness stats per item (`item_id`, correct/incorrect counts, error type history, pattern tags)
- Personal mnemonics (`item_id`, user text)
- Streak data (current streak, longest streak, last review date)
- Cognitive load history (daily load values, threshold settings)
- User preferences (session intensity, notification settings, theme)
- Import metadata (source, date, mapped item count)
- App state (last curriculum version, onboarding completion)

**Cross-database query pattern:**
```sql
ATTACH DATABASE 'curriculum.db' AS curriculum;
SELECT u.*, c.item_data
FROM user.srs_state u
JOIN curriculum.items c ON u.item_id = c.id
WHERE u.due_date <= datetime('now')
ORDER BY (u.fsrs_score * 0.7 + u.weakness_score * 0.3) DESC;
```

**Schema migration strategy:**
- `curriculum.db`: No migration — replaced atomically on content updates. Schema changes ship with new compiled database.
- `user.db`: Versioned schema with forward-only migrations. Migration runner checks schema version on app launch and applies pending migrations sequentially. Migrations are bundled with the app binary (not downloaded).

### Authentication & Security

**Decision: No Authentication (Local-Only Security Model)**

| Aspect | Decision |
| --- | --- |
| Core app auth | None — no user accounts, no login, no personal data collection |
| API key storage | `expo-secure-store` (iOS Keychain / Android Keystore) for WaniKani and Bunpro API keys during import. Keys can be discarded after import completes. |
| Data security | All user data local to device. No data transmitted except during explicit import (API key sent to WaniKani/Bunpro over HTTPS) and image loading (public R2 URLs). |
| Post-MVP | GitHub OAuth for community contributors only — scoped to contribution flow, not core app usage. |

### State Management & Data Flow

**Decision: SQLite-First with React Context for Session State**

| Aspect | Decision |
| --- | --- |
| Persistent state | SQLite is the single source of truth. All reads/writes go through the data access layer. |
| Session state | React Context for in-memory, transient state: active review queue (pre-fetched), current session progress, cognitive load ring position, current item index. |
| Data access | Custom hooks (`useReviewQueue`, `useItemDetails`, `useWeaknessStats`, `useStreak`) encapsulate SQLite queries. Hooks return typed data and loading states. |
| Review loop optimization | Pre-fetch next 5 items into memory at session start and after each answer. SQLite writes (SRS state update, weakness stat update) are non-blocking — write completes asynchronously after the next item is already displayed. |
| Rationale | No sync layer between a state management library and SQLite. The database is already local and fast. Custom hooks provide a clean API without the overhead of Zustand/Redux store updates triggering re-renders on unrelated components. |

### Frontend Architecture

**Decision: Feature-First Code Organization with Pure Core Layer**

| Aspect | Decision |
| --- | --- |
| Architecture | Three-layer: `core/` (pure TS business logic) → `data/` (SQLite access) → `app/` + `components/` (React Native UI) |
| Core layer | Zero React/RN imports. Pure functions and classes for: FSRS scheduling, weakness calculation, queue building, grammar parsing, import mapping, cognitive load tracking. Unit-testable in isolation. |
| Data layer | Typed repository pattern. One module per database concern (curriculum queries, user state queries). React hooks consume repositories. |
| UI layer | NativeWind-styled components. Custom components per UX spec (ReviewCard, CognitiveLoadRing, WanaKanaInput, ProgressiveHint, etc.). Expo Router handles navigation. |
| Review loop | Dedicated `ReviewSessionProvider` context wraps the review modal. Manages pre-fetched queue, current item, answer evaluation, SRS state writes, cognitive load updates. Designed for zero-blocking between items. |

**Project structure:**
```
src/
├── app/                    # Expo Router routes (file-based)
│   ├── (tabs)/             # Tab navigation group
│   │   ├── index.tsx       # Home
│   │   ├── learn.tsx       # Learn
│   │   ├── read.tsx        # Read
│   │   ├── stats.tsx       # Stats
│   │   └── settings.tsx    # Settings
│   ├── review/             # Review session (modal context)
│   └── onboarding/         # First launch flow
├── components/             # Shared UI components
│   ├── review/             # ReviewCard, WanaKanaInput, ProgressiveHint
│   ├── engagement/         # CognitiveLoadRing, StreakCounter, TimeCompressionSummary
│   ├── common/             # Buttons, badges, indicators
│   └── import/             # ImportSummaryCard
├── core/                   # Business logic (no UI dependencies)
│   ├── srs/                # FSRS scheduler, weakness engine, queue builder
│   ├── content/            # Dependency graph, reinforcement resolver
│   ├── grammar/            # Conjugation parser, validation engine
│   ├── import/             # WaniKani, Bunpro, Anki importers
│   └── cognitive-load/     # Load tracking, threshold calculation
├── data/                   # Data access layer
│   ├── curriculum/         # Curriculum DB queries
│   ├── user/               # User DB queries
│   └── hooks/              # React hooks for data access
├── config/                 # Design tokens, constants, tailwind config
└── utils/                  # Levenshtein, WanaKana helpers, time formatting
```

### Infrastructure & Deployment

**Decision: Serverless Distribution with Expo Build Pipeline**

| Aspect | Decision |
| --- | --- |
| Build | EAS Build (Expo Application Services) for Android AAB and iOS IPA |
| OTA updates | Expo Updates for JS bundle patches without app store resubmission |
| Content pipeline | GitHub Actions: JSON schema validation → SQLite compilation → integrity check → Git LFS commit |
| Content distribution | Compiled `curriculum.db` hosted via Git LFS (or Cloudflare R2 for faster CDN delivery). App checks version on launch. |
| Media | Visual mnemonic images on Cloudflare R2 (public URLs, no auth). `expo-image` with disk caching. |
| Versioning | Integer version in curriculum metadata. App compares local vs. remote on launch (non-blocking check). |
| Update atomicity | Download to temp file → validate SHA-256 checksum → atomic rename to replace `curriculum.db`. Interrupted downloads are discarded. |

### Testing Strategy

| Layer | Framework | Scope |
| --- | --- | --- |
| Core business logic | Jest | FSRS scheduling, weakness calculation, queue building priority, grammar parser conjugation rules, import mapping, cognitive load thresholds, Levenshtein distance |
| Data access | Jest + in-memory SQLite | Repository queries, cross-database joins, migration runner |
| UI components | React Native Testing Library | ReviewCard states, WanaKanaInput conversion, CognitiveLoadRing accessibility, ProgressiveHint state machine |
| E2E | Deferred to post-MVP | Solo developer — core logic unit tests provide higher confidence-per-effort than UI automation |

### Error Handling Patterns

| Pattern | Application |
| --- | --- |
| Result type | Network operations (import, DB update, image fetch) return `Result<T, AppError>` — never throw in data paths |
| Transactional writes | All SQLite state updates use transactions. Failed transactions roll back. No partial state. |
| Non-destructive import | Failed/cancelled imports discard all partial data. User retries from scratch. |
| Graceful image fallback | Cached image → R2 fetch → text mnemonic fallback. No broken image states. |
| Atomic content update | Download → validate checksum → atomic swap. Current curriculum remains active until new one is fully validated. |
| Review loop resilience | If an SRS write fails, the session continues (item re-queued for next session). The review loop never blocks on a write failure. |

### Decision Impact Analysis

**Implementation Sequence:**
1. Project init (Expo SDK 55 + NativeWind + expo-sqlite + ts-fsrs)
2. Dual database schema design and migration infrastructure
3. Core business logic layer (FSRS integration, weakness engine, queue builder)
4. Data access layer with repository pattern and React hooks
5. Review loop UI (ReviewCard, WanaKanaInput, session context)
6. Content pipeline (JSON → SQLite compilation in GitHub Actions)
7. Engagement layer (CognitiveLoadRing, TimeCompressionSummary, streaks)
8. Import subsystem (WaniKani, Bunpro, Anki)
9. Remaining screens (Home, Learn, Read, Stats, Settings)
10. Polish, accessibility, and store submission

**Cross-Component Dependencies:**
- Queue builder depends on: FSRS scheduler + weakness engine + dependency graph + cognitive load tracker
- Review loop depends on: queue builder + answer evaluator (grammar parser, Levenshtein) + SRS state writer + reinforcement resolver
- Reinforcement resolver depends on: dependency graph + user SRS state (cross-database)
- Import subsystem depends on: curriculum item mapping + FSRS state conversion + user database writes

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 28 areas where AI agents could make different choices, organized into 6 categories.

### Naming Patterns

**Database Naming Conventions:**

| Element | Convention | Example |
| --- | --- | --- |
| Tables | `snake_case`, plural | `items`, `srs_states`, `weakness_stats`, `accepted_answers` |
| Columns | `snake_case` | `item_id`, `due_date`, `correct_count`, `jlpt_level` |
| Primary keys | `id` (integer, autoincrement) | `id INTEGER PRIMARY KEY AUTOINCREMENT` |
| Foreign keys | `{referenced_table_singular}_id` | `item_id`, `passage_id` |
| Indexes | `idx_{table}_{columns}` | `idx_items_jlpt_level`, `idx_srs_states_due_date` |
| Boolean columns | `is_` or `has_` prefix | `is_burned`, `has_mnemonic` |
| Timestamp columns | `_at` suffix | `created_at`, `updated_at`, `last_reviewed_at` |
| Enum-like columns | Store as TEXT, not integer codes | `item_type TEXT CHECK(item_type IN ('radical','kanji','vocabulary','grammar'))` |

**Code Naming Conventions:**

| Element | Convention | Example |
| --- | --- | --- |
| Files — components | `PascalCase.tsx` | `ReviewCard.tsx`, `CognitiveLoadRing.tsx` |
| Files — logic/utils | `camelCase.ts` | `queueBuilder.ts`, `levenshtein.ts` |
| Files — types | `camelCase.types.ts` | `srs.types.ts`, `curriculum.types.ts` |
| Files — hooks | `use{Name}.ts` | `useReviewQueue.ts`, `useStreak.ts` |
| Files — tests | `{filename}.test.ts(x)` (co-located) | `queueBuilder.test.ts`, `ReviewCard.test.tsx` |
| Directories | `kebab-case` | `cognitive-load/`, `srs/`, `review/` |
| React components | `PascalCase` | `ReviewCard`, `WanaKanaInput` |
| Functions | `camelCase` | `buildReviewQueue`, `calculateWeaknessScore` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PREFETCH_COUNT`, `WEAKNESS_WEIGHT` |
| Types/Interfaces | `PascalCase`, no `I` prefix | `SRSState`, `CurriculumItem`, `WeaknessStats` |
| Enums | `PascalCase` name, `PascalCase` members | `enum ItemType { Radical, Kanji, Vocabulary, Grammar }` |
| Hook return values | Destructured object, not array | `const { queue, isLoading, refetch } = useReviewQueue()` |

**NativeWind / Tailwind Conventions:**

| Pattern | Rule | Example |
| --- | --- | --- |
| Class ordering | Layout → Sizing → Spacing → Typography → Color → Effects | `className="flex-1 w-full px-4 py-2 text-lg text-primary bg-surface rounded-md"` |
| Design tokens | Always use token names from `tailwind.config.js`, never raw hex | `text-primary` not `text-[#EEEEF0]` |
| Dark mode | Dark-first — base classes are dark theme, `light:` prefix for light theme | `bg-background light:bg-light-background` |
| Responsive | Mobile-first — base is smallest phone, `md:` / `lg:` for larger | `w-[120px] md:w-[160px] lg:w-[180px]` |
| Component variants | Use props + conditional classes, not separate components | `className={cn("px-4 py-2", variant === "primary" && "bg-info")}` |

### Structure Patterns

**Project Organization Rules:**

| Rule | Convention |
| --- | --- |
| Test location | Co-located with source: `queueBuilder.ts` → `queueBuilder.test.ts` in same directory |
| Component structure | One component per file. Named export matching filename. No default exports. |
| Index files | Only in `components/` subdirectories to re-export public components. Never in `core/` or `data/`. |
| Barrel exports | Forbidden in `core/` — import directly from the file. Prevents circular dependencies. |
| Type definitions | Co-located `.types.ts` files per module. Shared types in `src/types/`. |
| Constants | Module-specific constants in the module. App-wide constants in `src/config/constants.ts`. |
| Design tokens | Single source of truth in `tailwind.config.js`. Tokens accessed via NativeWind classes only. |

**Component File Pattern:**

```typescript
// 1. Imports (external, then internal, then types)
import { View, Text, Pressable } from 'react-native';
import { SRSStageIndicator } from '@/components/common/SRSStageIndicator';
import type { CurriculumItem } from '@/types/curriculum.types';

// 2. Props type (always defined, never inline)
type ReviewCardProps = {
  item: CurriculumItem;
  onAnswer: (correct: boolean) => void;
};

// 3. Named export (never default export)
export function ReviewCard({ item, onAnswer }: ReviewCardProps) {
  // 4. Hooks at top
  // 5. Derived state / computed values
  // 6. Event handlers
  // 7. Render
  return (/* ... */);
}
```

**Core Module Pattern:**

```typescript
// core/srs/weaknessEngine.ts
import type { WeaknessStats, ReviewItem } from '@/types/srs.types';

export function calculateWeaknessScore(stats: WeaknessStats): number {
  // Pure computation — no side effects, no database calls
}

export function biasQueueByWeakness(
  items: ReviewItem[],
  weaknessWeight: number
): ReviewItem[] {
  // Pure transformation — input → output
}
```

### Format Patterns

**TypeScript Patterns:**

| Pattern | Rule |
| --- | --- |
| Type vs Interface | Use `type` for all type definitions. Reserve `interface` only for types that need declaration merging (rare). |
| Null handling | Prefer `T | null` over `T | undefined`. SQLite returns `null` for missing values. |
| Union discriminators | Use string literal unions with a `type` or `kind` field for tagged unions: `type: 'radical' | 'kanji' | 'vocabulary' | 'grammar'` |
| Function parameters | >2 params → use an options object: `buildQueue(options: QueueBuildOptions)` |
| Return types | Always explicit on exported functions. Inferred on internal/private functions. |
| Async functions | Return `Promise<Result<T, AppError>>` for operations that can fail. Never throw in data/core layers. |

**Result Type Pattern:**

```typescript
// src/types/result.types.ts
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type AppError = {
  code: string;        // Machine-readable: 'IMPORT_FAILED', 'DB_WRITE_ERROR'
  message: string;     // Human-readable for logging
  userMessage?: string; // Optional user-facing message
  cause?: unknown;     // Original error for debugging
};
```

**Date/Time Conventions:**

| Context | Format |
| --- | --- |
| SQLite storage | ISO 8601 string: `'2026-05-03T14:00:00.000Z'` (UTC) |
| FSRS due dates | ISO 8601 string in UTC |
| Display to user | Relative time ("2 hours ago", "tomorrow") using device locale |
| Streak calculation | Device local date (midnight boundary in user's timezone) |

**Data Layer Query Pattern:**

```typescript
// data/user/srsStateRepository.ts
import type { SRSState } from '@/types/srs.types';
import type { Result } from '@/types/result.types';

export function getDueItems(db: SQLiteDatabase, limit: number): Result<SRSState[]> {
  try {
    const rows = db.getAllSync<SRSState>(
      `SELECT * FROM srs_states WHERE due_date <= datetime('now') ORDER BY due_date ASC LIMIT ?`,
      [limit]
    );
    return { ok: true, value: rows };
  } catch (e) {
    return { ok: false, error: { code: 'DB_READ_ERROR', message: String(e), cause: e } };
  }
}
```

### Communication Patterns

**React Context Pattern:**

One context per bounded domain. Never one giant AppContext:

| Context | Scope | Contents |
| --- | --- | --- |
| `ReviewSessionContext` | Active review session | Current queue, item index, session stats, cognitive load progress |
| `DatabaseContext` | App-wide | Database handles (curriculum.db + user.db), initialization state |
| `PreferencesContext` | App-wide | User settings, session intensity, theme preference |

**Hook Communication Pattern:**

Hooks are the API between the data layer and the UI:

```typescript
// data/hooks/useReviewQueue.ts
export function useReviewQueue() {
  // Returns: { queue, isLoading, error, refetch }
  // Never returns raw database rows — always typed domain objects
  // Handles the cross-database join internally
}
```

**Event/Callback Naming:**

| Pattern | Convention | Example |
| --- | --- | --- |
| Event handler props | `on{Event}` | `onAnswer`, `onSessionEnd`, `onHintReveal` |
| Handler functions | `handle{Event}` | `handleAnswer`, `handleSessionEnd` |
| Boolean props | `is{State}` or `has{Thing}` | `isLoading`, `isCorrect`, `hasHints` |
| Callback data | Always typed, never `any` | `onAnswer: (result: AnswerResult) => void` |

### Process Patterns

**Error Handling:**

| Layer | Pattern |
| --- | --- |
| `core/` | Return `Result<T, AppError>`. Never throw. Pure functions return values or errors. |
| `data/` | Catch SQLite exceptions, wrap in `Result`. Never let raw database errors propagate. |
| `components/` | Use React error boundaries for unexpected crashes. Handle `Result` errors inline for expected failures. |
| Network (import/update) | Timeout after 30s. Retry once. Show user-friendly error with retry action. Never silent failure. |
| Review loop | Never interrupt. If a write fails, queue the write for retry. Show next item immediately. |

**Loading State Pattern:**

| State | Convention |
| --- | --- |
| Initial load | Skeleton matching final layout (per UX spec). Never a generic spinner. |
| Review session | No loading states — all items pre-fetched before session starts. If pre-fetch is slow, show loading before first item, never between items. |
| Background operations | Silent. Curriculum update check, image pre-caching — no user-visible indicator unless action is needed. |
| Import | Full-screen modal with progress: "Fetching items... (42/1200)". Cancel button always available. |

**SQLite Transaction Pattern:**

All multi-statement writes use explicit transactions:

```typescript
db.withTransactionSync(() => {
  db.runSync('UPDATE srs_states SET ...', [/* params */]);
  db.runSync('INSERT INTO weakness_stats ...', [/* params */]);
  db.runSync('UPDATE streaks SET ...', [/* params */]);
});
// If any statement fails, entire transaction rolls back
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Run `npx tsc --noEmit` before considering any implementation complete — zero TypeScript errors allowed.
2. Follow the naming conventions table exactly — database columns in `snake_case`, TypeScript in `camelCase`, components in `PascalCase`.
3. Never import from `core/` into `core/` via index files — direct file imports only to prevent circular dependencies.
4. Never throw exceptions in `core/` or `data/` layers — always return `Result<T, AppError>`.
5. Never add UI animations inside the review loop — the `review/` route has zero animation tolerance.
6. Always use NativeWind design tokens — never raw color values, never inline `style={{}}` objects.
7. Co-locate tests with source files — `foo.ts` and `foo.test.ts` in the same directory.
8. Use named exports exclusively — no default exports anywhere in the project.
9. Keep `core/` free of React/React Native imports — pure TypeScript only.
10. All SQLite writes must be wrapped in transactions when updating multiple tables.

**Anti-Patterns (Agents MUST NOT):**

| Anti-Pattern | Correct Pattern |
| --- | --- |
| `export default function ReviewCard` | `export function ReviewCard` |
| `style={{ backgroundColor: '#0A0A0F' }}` | `className="bg-background"` |
| `throw new Error('DB failed')` in data layer | `return { ok: false, error: { code: 'DB_WRITE_ERROR', ... } }` |
| `import { calculateScore } from '@/core'` | `import { calculateScore } from '@/core/srs/weaknessEngine'` |
| `const [data, setData] = useState(null)` for DB data | `const { data, isLoading } = useItemDetails(itemId)` |
| `setTimeout(() => {}, 300)` between review items | Immediate state transition — zero delay between items |
| `userId` as a database column name | `user_id` (snake_case in database) |
| Test files in `__tests__/` directory | Test files co-located: `src/core/srs/queueBuilder.test.ts` |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
japanese-learning/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.js                # Design tokens — single source of truth for colors, spacing, typography
├── babel.config.js                   # Expo + NativeWind babel presets
├── metro.config.js                   # Metro + withNativeWind configuration
├── app.json                          # Expo app configuration (name, splash, icons, plugins)
├── eas.json                          # EAS Build + Submit configuration
├── global.css                        # Tailwind directives (@tailwind base/components/utilities)
├── .gitignore
├── .eslintrc.js                      # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── jest.config.js                    # Jest configuration for unit + component tests
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, typecheck, test on PR
│       └── compile-curriculum.yml    # JSON → SQLite compilation on curriculum changes
│
├── assets/
│   ├── images/                       # App icons, splash screen, onboarding illustrations
│   ├── fonts/                        # Custom fonts (if any — default is system fonts)
│   └── curriculum-seed/
│       └── curriculum.db             # Seed curriculum database bundled with app binary
│
├── curriculum/                       # JSON source data (compiled to SQLite by CI)
│   ├── schema/
│   │   └── curriculum.schema.json    # JSON Schema for validation
│   ├── radicals/
│   │   └── n5.json                   # N5 radicals with mnemonic image URLs
│   ├── kanji/
│   │   └── n5.json                   # N5 kanji with readings, meanings, mnemonics
│   ├── vocabulary/
│   │   └── n5.json                   # N5 vocabulary with contextual meanings
│   ├── grammar/
│   │   └── n5.json                   # N5 grammar points with conjugation rules, example sentences
│   ├── readings/
│   │   └── n5.json                   # N5 reading passages with comprehension questions
│   ├── dependencies/
│   │   └── graph.json                # radical→kanji→vocab dependency graph
│   └── metadata.json                 # Curriculum version, build metadata
│
├── scripts/
│   ├── compile-curriculum.ts         # JSON → SQLite compilation script (runs in GitHub Actions)
│   └── validate-schema.ts            # JSON schema validation script
│
├── src/
│   ├── app/                          # Expo Router — file-based routing
│   │   ├── _layout.tsx               # Root layout (DatabaseProvider, PreferencesProvider, global.css import)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           # Tab navigator layout (Home, Learn, Read, Stats, Settings)
│   │   │   ├── index.tsx             # Home screen (cognitive load ring, Review/Learn buttons, streak, progress bar)
│   │   │   ├── learn.tsx             # Learn screen (JLPT level browser, lesson lists, item details)
│   │   │   ├── read.tsx              # Read screen (reading passage list, passage reader)
│   │   │   ├── stats.tsx             # Stats screen (SRS stage breakdown, weakness trends, session history)
│   │   │   └── settings.tsx          # Settings screen (preferences, notification config, theme, about)
│   │   ├── review/
│   │   │   ├── _layout.tsx           # Review session layout (ReviewSessionProvider, hides tab bar)
│   │   │   ├── index.tsx             # Review session screen (SessionHeader + ReviewCard + input)
│   │   │   └── summary.tsx           # Post-session summary (TimeCompressionSummary, PostSessionShareCard)
│   │   ├── onboarding/
│   │   │   ├── _layout.tsx           # Onboarding flow layout (linear progression)
│   │   │   ├── welcome.tsx           # Welcome + level selection (N5/existing knowledge)
│   │   │   ├── import.tsx            # Import source selection (WaniKani/Bunpro/Anki/skip)
│   │   │   ├── import-progress.tsx   # Import progress + summary (ImportSummaryCard)
│   │   │   └── intensity.tsx         # Session intensity selection + completion
│   │   ├── learn/
│   │   │   ├── [level].tsx           # JLPT level detail (item grid by type)
│   │   │   └── item/
│   │   │       └── [id].tsx          # Item detail screen (mnemonic, readings, examples, SRS stage)
│   │   └── read/
│   │       └── [id].tsx              # Reading passage detail (passage text, reinforcement highlights, questions)
│   │
│   ├── components/
│   │   ├── review/
│   │   │   ├── ReviewCard.tsx        # Core review interaction (prompt + input + result states)
│   │   │   ├── ReviewCard.test.tsx
│   │   │   ├── WanaKanaInput.tsx     # Romaji-to-hiragana real-time input
│   │   │   ├── WanaKanaInput.test.tsx
│   │   │   ├── ProgressiveHint.tsx   # Layered hint disclosure for grammar items
│   │   │   ├── ProgressiveHint.test.tsx
│   │   │   ├── SessionHeader.tsx     # Fixed header: small ring + progress count + item type badge
│   │   │   ├── ReinforcementHighlight.tsx  # "← you learned this yesterday" annotation
│   │   │   └── index.ts             # Re-exports public components
│   │   ├── engagement/
│   │   │   ├── CognitiveLoadRing.tsx # SVG ring with color gradient (large + small variants)
│   │   │   ├── CognitiveLoadRing.test.tsx
│   │   │   ├── StreakCounter.tsx     # Flame + day count
│   │   │   ├── TimeCompressionSummary.tsx  # Post-session domain breakdown + time comparison
│   │   │   ├── PostSessionShareCard.tsx    # Screenshot-optimized share card
│   │   │   ├── LevelProgressBar.tsx  # JLPT progress bar with domain counts
│   │   │   └── index.ts
│   │   ├── common/
│   │   │   ├── SRSStageIndicator.tsx # Color-coded mastery badge
│   │   │   ├── WeaknessStatCard.tsx  # Pattern accuracy trend display
│   │   │   ├── Button.tsx            # Primary/secondary/tertiary/ghost/pill variants
│   │   │   ├── Banner.tsx            # Success/error/info/warning banners
│   │   │   ├── Skeleton.tsx          # Loading skeleton matching layout patterns
│   │   │   └── index.ts
│   │   └── import/
│   │       ├── ImportSummaryCard.tsx  # Import results display with mapping details
│   │       └── index.ts
│   │
│   ├── core/                         # Pure TypeScript — ZERO React/RN imports
│   │   ├── srs/
│   │   │   ├── fsrsScheduler.ts      # ts-fsrs wrapper — schedule, reschedule, grade
│   │   │   ├── fsrsScheduler.test.ts
│   │   │   ├── weaknessEngine.ts     # Per-item/per-pattern weakness scoring
│   │   │   ├── weaknessEngine.test.ts
│   │   │   ├── queueBuilder.ts       # Builds review queue: FSRS + weakness + interleaving + load weighting
│   │   │   ├── queueBuilder.test.ts
│   │   │   └── srs.types.ts          # SRSState, WeaknessStats, ReviewItem, QueueBuildOptions
│   │   ├── content/
│   │   │   ├── dependencyGraph.ts    # Traverse radical→kanji→vocab graph, check unlock status
│   │   │   ├── dependencyGraph.test.ts
│   │   │   ├── reinforcementResolver.ts  # Find cross-domain connections for a given item/sentence
│   │   │   ├── reinforcementResolver.test.ts
│   │   │   └── content.types.ts      # CurriculumItem, DependencyEdge, ReinforcementLink
│   │   ├── grammar/
│   │   │   ├── conjugationParser.ts  # Rule-based conjugation validation (te-form, ta-form, nai-form, etc.)
│   │   │   ├── conjugationParser.test.ts
│   │   │   ├── answerEvaluator.ts    # Evaluates grammar answers: parser → Levenshtein fallback
│   │   │   ├── answerEvaluator.test.ts
│   │   │   └── grammar.types.ts      # GrammarPoint, ConjugationRule, EvaluationResult
│   │   ├── import/
│   │   │   ├── wanikaniMapper.ts     # Map WaniKani items + SRS states to internal format
│   │   │   ├── wanikaniMapper.test.ts
│   │   │   ├── bunproMapper.ts       # Map Bunpro grammar points to internal format
│   │   │   ├── bunproMapper.test.ts
│   │   │   ├── ankiParser.ts         # Parse .apkg files, extract cards, map to curriculum
│   │   │   ├── ankiParser.test.ts
│   │   │   ├── fsrsConverter.ts      # Convert foreign SRS intervals to FSRS state
│   │   │   ├── fsrsConverter.test.ts
│   │   │   └── import.types.ts       # ImportSource, ImportResult, MappedItem, UnmatchedItem
│   │   ├── cognitive-load/
│   │   │   ├── loadTracker.ts        # Calculate cognitive load from item weights (new vs mature)
│   │   │   ├── loadTracker.test.ts
│   │   │   ├── thresholdCalculator.ts # Adaptive threshold based on user history
│   │   │   ├── thresholdCalculator.test.ts
│   │   │   └── cognitiveLoad.types.ts
│   │   └── answer/
│   │       ├── levenshtein.ts        # Levenshtein distance for typo detection
│   │       ├── levenshtein.test.ts
│   │       ├── meaningEvaluator.ts   # Evaluate meaning answers (English): exact match → synonym → typo
│   │       ├── meaningEvaluator.test.ts
│   │       ├── readingEvaluator.ts   # Evaluate reading answers (kana): exact match → typo
│   │       ├── readingEvaluator.test.ts
│   │       └── answer.types.ts       # AnswerResult ('correct' | 'incorrect' | 'typo'), EvalContext
│   │
│   ├── data/                         # Data access layer — boundary between SQLite and app
│   │   ├── database.ts               # Database initialization, ATTACH, handle open/close
│   │   ├── database.test.ts
│   │   ├── migrations/
│   │   │   ├── migrationRunner.ts    # Check user.db schema version, apply pending migrations
│   │   │   ├── migrationRunner.test.ts
│   │   │   ├── 001_initial.ts        # Initial user.db schema creation
│   │   │   └── migrations.types.ts
│   │   ├── curriculum/
│   │   │   ├── itemRepository.ts     # Query items by type, level, ID; dependency lookups
│   │   │   ├── itemRepository.test.ts
│   │   │   ├── grammarRepository.ts  # Query grammar points, conjugation rules, example sentences
│   │   │   ├── passageRepository.ts  # Query reading passages by level
│   │   │   └── curriculumUpdate.ts   # Download, validate, swap curriculum.db atomically
│   │   ├── user/
│   │   │   ├── srsStateRepository.ts # Read/write SRS state, due items, burned items
│   │   │   ├── srsStateRepository.test.ts
│   │   │   ├── weaknessRepository.ts # Read/write weakness stats, confusion clusters
│   │   │   ├── streakRepository.ts   # Read/write streak data
│   │   │   ├── preferencesRepository.ts # Read/write user preferences
│   │   │   ├── mnemonicRepository.ts # Read/write personal mnemonics
│   │   │   └── importRepository.ts   # Write imported items in bulk, track import metadata
│   │   └── hooks/
│   │       ├── useDatabase.ts        # Provides database handles from DatabaseContext
│   │       ├── useReviewQueue.ts     # Builds and returns typed review queue
│   │       ├── useItemDetails.ts     # Fetches item + SRS state + weakness stats for detail views
│   │       ├── useStreak.ts          # Current streak, milestone checks
│   │       ├── useCognitiveLoad.ts   # Today's load progress, threshold
│   │       ├── useWeaknessStats.ts   # Pattern accuracy trends for Stats tab
│   │       ├── useLevelProgress.ts   # JLPT level progress (items learned/total by type)
│   │       └── useSRSBreakdown.ts    # SRS stage counts for Stats tab
│   │
│   ├── providers/
│   │   ├── DatabaseProvider.tsx       # Initializes DBs, runs migrations, provides DatabaseContext
│   │   ├── PreferencesProvider.tsx    # Loads user preferences, provides PreferencesContext
│   │   └── ReviewSessionProvider.tsx  # Manages active review session state, pre-fetching, write queue
│   │
│   ├── config/
│   │   ├── constants.ts              # App-wide constants (WEAKNESS_WEIGHT, MAX_PREFETCH, QUEUE_SIZE, etc.)
│   │   ├── theme.ts                  # Theme helpers for programmatic token access (if needed outside NativeWind)
│   │   └── notifications.ts          # Notification channel config, scheduling helpers
│   │
│   ├── types/
│   │   ├── result.types.ts           # Result<T, E>, AppError
│   │   ├── curriculum.types.ts       # Shared types: CurriculumItem, ItemType, JLPTLevel
│   │   ├── srs.types.ts              # Re-exported from core for convenience
│   │   └── navigation.types.ts       # Route params for typed navigation
│   │
│   └── utils/
│       ├── wanakana.ts               # WanaKana wrapper: toHiragana, isHiragana, isKatakana
│       ├── timeFormat.ts             # Relative time formatting, time compression calculation
│       ├── cn.ts                     # className merge utility (clsx + tailwind-merge)
│       └── platform.ts              # Platform.select helpers, safe area utilities
│
└── __mocks__/                        # Jest module mocks
    ├── expo-sqlite.ts                # Mock SQLite for unit tests
    └── expo-secure-store.ts          # Mock secure store for import tests
```

### Architectural Boundaries

**Layer Boundary Rules:**

```
┌─────────────────────────────────────────────┐
│  UI Layer (app/, components/, providers/)     │
│  - React Native components                    │
│  - NativeWind styling                         │
│  - Expo Router navigation                     │
│  - May import from: data/, core/, config/     │
├─────────────────────────────────────────────┤
│  Data Layer (data/)                           │
│  - SQLite access (reads + writes)             │
│  - Repository pattern                         │
│  - React hooks for UI consumption             │
│  - May import from: core/, config/            │
│  - NEVER imported by: core/                   │
├─────────────────────────────────────────────┤
│  Core Layer (core/)                           │
│  - Pure TypeScript business logic             │
│  - Zero React/RN imports                      │
│  - Zero database imports                      │
│  - May import from: config/ (constants only)  │
│  - NEVER imports from: data/, components/     │
└─────────────────────────────────────────────┘
```

**Data Boundaries:**

| Boundary | Rule |
| --- | --- |
| `curriculum.db` | Read-only from app. Written only by CI pipeline. Replaced atomically on updates. |
| `user.db` | Read-write. Created on first launch. Never replaced — only migrated forward. |
| Cross-DB queries | Use `ATTACH DATABASE`. Only in `data/` layer — never in `core/` or `components/`. |
| Secure storage | API keys only. Accessed only from `data/user/` during import. Discardable after use. |

**External Integration Points:**

| Integration | Location | Protocol |
| --- | --- | --- |
| WaniKani API v2 | `core/import/wanikaniMapper.ts` + `data/user/importRepository.ts` | HTTPS REST, API key auth, 60 req/min rate limit |
| Bunpro API | `core/import/bunproMapper.ts` + `data/user/importRepository.ts` | HTTPS (TBD — availability uncertain) |
| Anki deck files | `core/import/ankiParser.ts` | Local file parsing (.apkg = SQLite zip) |
| Cloudflare R2 | `expo-image` component config | HTTPS public URLs, disk caching |
| Curriculum update | `data/curriculum/curriculumUpdate.ts` | HTTPS fetch of `.db` file + SHA-256 checksum |

### Requirements to Structure Mapping

**FR Category → Directory Mapping:**

| FR Category | Primary Location | Supporting Locations |
| --- | --- | --- |
| Learning Content (FR1-FR8c) | `curriculum/` (source), `data/curriculum/` (queries), `core/content/` (graph) | `src/app/learn/`, `src/app/read/` |
| SRS Engine (FR9-FR14) | `core/srs/`, `core/answer/` | `data/user/srsStateRepository.ts`, `data/hooks/useReviewQueue.ts` |
| Weakness Detection (FR29-FR33) | `core/srs/weaknessEngine.ts` | `data/user/weaknessRepository.ts`, `data/hooks/useWeaknessStats.ts` |
| Cognitive Load (FR15-FR17) | `core/cognitive-load/` | `components/engagement/CognitiveLoadRing.tsx`, `data/hooks/useCognitiveLoad.ts` |
| Streaks & Notifications (FR18-FR20) | `data/user/streakRepository.ts`, `config/notifications.ts` | `components/engagement/StreakCounter.tsx` |
| Onboarding (FR21-FR26) | `src/app/onboarding/` | `data/user/preferencesRepository.ts` |
| Personal Content (FR26b-FR28) | `data/user/mnemonicRepository.ts` | `src/app/learn/item/[id].tsx` |
| Time Compression (FR33b-FR33c) | `utils/timeFormat.ts` | `components/engagement/TimeCompressionSummary.tsx` |
| Progress Import (FR33d-FR33h) | `core/import/`, `data/user/importRepository.ts` | `src/app/onboarding/import*.tsx`, `components/import/` |
| Content Pipeline (FR34-FR37b) | `curriculum/`, `scripts/`, `.github/workflows/` | `data/curriculum/curriculumUpdate.ts` |
| Data & Offline (FR46-FR51) | `data/database.ts`, `data/curriculum/curriculumUpdate.ts` | `providers/DatabaseProvider.tsx` |
| Accessibility (FR52-FR54) | All `components/` (built into every component) | `tailwind.config.js` (contrast ratios) |
| Cross-Domain Reinforcement (FR12) | `core/content/reinforcementResolver.ts` | `components/review/ReinforcementHighlight.tsx` |
| Grammar Validation (FR6b, FR14) | `core/grammar/conjugationParser.ts`, `core/answer/` | `components/review/ReviewCard.tsx` |

**Data Flow — Review Session:**

```
User taps "Review"
    │
    ▼
useReviewQueue hook
    │ queries user.db (due items + weakness stats)
    │ queries curriculum.db (item content)
    │ calls core/srs/queueBuilder (FSRS + weakness + interleave)
    ▼
ReviewSessionProvider (pre-fetches 5 items into memory)
    │
    ▼
ReviewCard renders current item
    │ WanaKanaInput captures answer
    ▼
core/answer/* evaluates answer (type-specific)
    │
    ├─ correct → core/srs/fsrsScheduler.grade() → async write to user.db
    │             core/srs/weaknessEngine.recordCorrect() → async write
    │             CognitiveLoadRing increments
    │
    ├─ incorrect → show correct answer + mnemonic
    │               core/srs/weaknessEngine.recordIncorrect() → async write
    │               CognitiveLoadRing increments (higher weight)
    │
    └─ typo → re-prompt (no SRS state change)
    │
    ▼
Next item displayed immediately (pre-fetched)
    │ (async: refill pre-fetch buffer from queue)
    ▼
Session ends → summary.tsx
    │ utils/timeFormat.ts calculates compression
    ▼
TimeCompressionSummary + PostSessionShareCard
```

### Development Workflow Integration

**Development:**
- `npx expo start` — launches Expo dev server
- Expo Go on device for rapid iteration
- NativeWind hot reloads with style changes
- `npx tsc --noEmit` — typecheck without build

**Testing:**
- `npx jest` — runs all co-located tests
- `npx jest --testPathPattern=core` — runs only core business logic tests
- Tests use in-memory SQLite via `expo-sqlite` mock for data layer tests

**Build & Deploy:**
- `eas build --platform android` / `eas build --platform ios` — production builds
- `eas submit` — app store submission
- `eas update` — OTA JS bundle update
- `.github/workflows/ci.yml` — lint + typecheck + test on every PR
- `.github/workflows/compile-curriculum.yml` — compile curriculum on JSON changes

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices verified compatible:
- Expo SDK 55 (React Native 0.83, React 19.2) — confirmed current
- NativeWind v4.1.23 requires Tailwind CSS v3.4.17 — compatible
- `expo-sqlite` ships with SDK 55 — no native config needed
- `ts-fsrs` v5.3.2 is pure TypeScript with zero dependencies — no platform conflicts
- `wanakana` is pure JS — runs in React Native's JS runtime without native bridges
- Expo Router v4 file-based routing is the default in SDK 55's template

No version conflicts or contradictory decisions found.

**Pattern Consistency:**
- Database naming (`snake_case`) and TypeScript naming (`camelCase`) cleanly separated with explicit transformation at the data layer boundary
- Named exports rule enforced uniformly — no exceptions
- Result type pattern mandated for `core/` and `data/` layers consistently
- NativeWind token-only rule aligns with the design system in the UX spec

**Structure Alignment:**
- Three-layer architecture (`core/` → `data/` → UI) maps cleanly to the file structure
- Every FR category has at least one primary directory and supporting locations
- Expo Router file-based routing matches the UX spec's 5-tab navigation + review modal pattern
- Co-located tests align with the feature-first directory structure

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| FR Range | Category | Architectural Support | Status |
| --- | --- | --- | --- |
| FR1-FR8c | Learning Content & Progression | `curriculum/`, `data/curriculum/`, `core/content/dependencyGraph.ts` | ✅ |
| FR9-FR14 | SRS Engine & Review | `core/srs/`, `core/answer/`, `data/hooks/useReviewQueue.ts`, `providers/ReviewSessionProvider.tsx` | ✅ |
| FR15-FR20 | Cognitive Load & Engagement | `core/cognitive-load/`, `components/engagement/`, `config/notifications.ts` | ✅ |
| FR21-FR26 | Onboarding & Customization | `src/app/onboarding/`, `data/user/preferencesRepository.ts` | ✅ |
| FR26b-FR28 | Personal Content | `data/user/mnemonicRepository.ts`, `src/app/learn/item/[id].tsx` | ✅ |
| FR29-FR33 | Weakness Detection | `core/srs/weaknessEngine.ts`, `data/user/weaknessRepository.ts` | ✅ |
| FR33b-FR33c | Time Compression | `utils/timeFormat.ts`, `components/engagement/TimeCompressionSummary.tsx` | ✅ |
| FR33d-FR33h | Progress Import | `core/import/`, `data/user/importRepository.ts`, `src/app/onboarding/import*.tsx` | ✅ |
| FR34-FR37b | Content Pipeline | `curriculum/`, `scripts/`, `.github/workflows/`, `data/curriculum/curriculumUpdate.ts` | ✅ |
| FR46-FR51 | Data & Offline | `data/database.ts`, `providers/DatabaseProvider.tsx`, Expo Updates | ✅ |
| FR52-FR54 | Accessibility | Built into all `components/`, validated via `tailwind.config.js` tokens | ✅ |

**Non-Functional Requirements Coverage:**

| NFR | Requirement | Architectural Support | Status |
| --- | --- | --- | --- |
| NFR1-2 | <100ms review + query | Pre-fetching (5 items), async writes, SQLite indexes, queue pre-built at session start | ✅ |
| NFR3 | <3s cold start | `DatabaseProvider` initializes DBs on mount; seed curriculum bundled with binary | ✅ |
| NFR5b | Zero review animations | Enforcement rule #5; immediate state transitions | ✅ |
| NFR6-9 | Local-only security | Dual-DB local architecture, `expo-secure-store` for API keys, no data transmission | ✅ |
| NFR10 | Progress survives updates | Dual-DB: curriculum replaced, user.db never touched; migration runner for schema changes | ✅ |
| NFR11-12 | Integrity & atomic updates | SHA-256 checksum + atomic rename; interrupted downloads discarded | ✅ |
| NFR14-17 | WCAG 2.1 AA accessibility | Contrast ratios in design tokens; accessibility props in every component spec | ✅ |
| NFR18-20 | Integration graceful degradation | Result type pattern; retry logic; fallback to manual marking | ✅ |
| NFR21-22 | Scalability to 10k+ items | Schema supports N5→N1; index strategy on `item_type`, `jlpt_level`, `due_date` | ✅ |

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All technology versions verified via web search (Expo SDK 55, NativeWind v4.1.23, ts-fsrs v5.3.2, Tailwind v3.4.17)
- Initialization command documented
- Post-init configuration steps for NativeWind documented
- All additional dependencies listed with version ranges

**Pattern Completeness:**
- 10 enforcement rules for AI agents
- 8 explicit anti-patterns with correct alternatives
- Concrete code examples for: component files, core modules, data layer queries, Result type, SQLite transactions, React contexts, hooks
- NativeWind class ordering convention specified

### Gap Analysis Results

**No Critical Gaps Found.**

**Minor Gaps (Non-Blocking):**

| Gap | Impact | Recommendation |
| --- | --- | --- |
| Import data fetching location | `core/import/` mappers are pure transformations but need a `data/` layer counterpart for HTTP fetching | Add network fetch logic to `data/user/importRepository.ts` or create `data/import/wanikaniClient.ts`. Mappers in `core/` receive already-fetched data. |
| ESLint/Prettier config details | Standard tooling; agents may configure differently | Set up during project init story. Use `eslint-config-expo` as base. |
| Curriculum JSON schema detail | Schema mentioned but not fully specified | Define during first content pipeline story. JSON Schema file exists at `curriculum/schema/curriculum.schema.json`. |
| Monitoring/logging | No structured logging approach | Acceptable for solo-dev MVP. Add `console.warn`/`console.error` with error codes. Structured logging is post-MVP. |

**Gap Resolution — Import Data Flow Clarification:**

The `core/import/` mappers (wanikaniMapper, bunproMapper, ankiParser) are pure transformation functions — they receive raw data and output mapped items. Network fetching (WaniKani API calls, Bunpro API calls) and file reading (Anki .apkg) happen in the `data/` layer:

```
data/user/importRepository.ts (or data/import/wanikaniClient.ts)
    │ fetches raw data from API / reads file
    ▼
core/import/wanikaniMapper.ts
    │ transforms raw data → internal format (pure function)
    ▼
data/user/importRepository.ts
    │ writes mapped items to user.db in transaction
```

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (72 FRs, 23 NFRs, 5 subsystem clusters)
- [x] Scale and complexity assessed (Medium-High, ~12-15 modules)
- [x] Technical constraints identified (offline-first, <100ms, no backend)
- [x] Cross-cutting concerns mapped (7 concerns)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions (dual-DB, SQLite-first state, Expo SDK 55)
- [x] Technology stack fully specified (all packages with version ranges)
- [x] Integration patterns defined (WaniKani API, Bunpro, Anki, R2, curriculum updates)
- [x] Performance considerations addressed (pre-fetching, async writes, indexing)

**✅ Implementation Patterns**
- [x] Naming conventions established (database, code, NativeWind)
- [x] Structure patterns defined (component files, core modules, data queries)
- [x] Communication patterns specified (contexts, hooks, callbacks)
- [x] Process patterns documented (error handling, loading states, transactions)

**✅ Project Structure**
- [x] Complete directory structure defined (~100 files mapped)
- [x] Component boundaries established (three-layer architecture diagram)
- [x] Integration points mapped (5 external integrations)
- [x] Requirements to structure mapping complete (all FR categories → directories)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all critical decisions made, all requirements covered, all patterns defined with concrete examples.

**Key Strengths:**
1. Dual-database architecture makes curriculum updates trivial and user data bulletproof
2. Three-layer separation (`core/` → `data/` → UI) enables independent testing of business logic
3. Pre-fetching + async writes in the review loop directly address the <100ms performance target
4. Comprehensive enforcement rules prevent the most common AI agent consistency failures
5. Result type pattern prevents unhandled errors throughout the core and data layers
6. Requirements mapping gives every FR a specific home in the codebase

**Areas for Future Enhancement:**
- Structured logging framework (post-MVP)
- Performance profiling tooling for SQLite query benchmarking
- Storybook or equivalent for component development in isolation
- Curriculum JSON schema formalization during content pipeline implementation

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and layer boundaries (`core/` never imports from `data/` or UI)
- Refer to this document for all architectural questions
- When in doubt, the enforcement rules in "Implementation Patterns" are authoritative

**First Implementation Priority:**

```bash
npx create-expo-app@latest japanese-learning --template default@sdk-55
```

Then configure NativeWind, install dependencies, set up dual-database infrastructure, and build the core review loop.
