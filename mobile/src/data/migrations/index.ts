import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { migration004PassagePracticeResults } from '@/data/migrations/004_passage_practice_results';
import { migration005PersonalMnemonics } from '@/data/migrations/005_personal_mnemonics';
import { migration006RelatedItemBoosts } from '@/data/migrations/006_related_item_boosts';
import { migration007WeaknessStats } from '@/data/migrations/007_weakness_stats';
import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { migration009Streak } from '@/data/migrations/009_streak';
import { migration010SrsLastReviewedAt } from '@/data/migrations/010_srs_last_reviewed_at';
import { migration011SrsLearningSteps } from '@/data/migrations/011_srs_learning_steps';
import { migration012UserSynonyms } from '@/data/migrations/012_user_synonyms';
import { migration013DailyLessonLog } from '@/data/migrations/013_daily_lesson_log';
import { migration014StreakCelebration } from '@/data/migrations/014_streak_celebration';
import { migration015GoalRingState } from '@/data/migrations/015_goal_ring_state';
import { migration016FuriganaOverrides } from '@/data/migrations/016_furigana_overrides';
import { migration017AiSessions } from '@/data/migrations/017_ai_sessions';
import type { Migration } from '@/data/migrations/migrations.types';

export const migrations: Migration[] = [
  migration001Initial,
  migration002ItemStudyStatus,
  migration003SrsStatesAndImportMetadata,
  migration004PassagePracticeResults,
  migration005PersonalMnemonics,
  migration006RelatedItemBoosts,
  migration007WeaknessStats,
  migration008CognitiveLoadHistory,
  migration009Streak,
  migration010SrsLastReviewedAt,
  migration011SrsLearningSteps,
  migration012UserSynonyms,
  migration013DailyLessonLog,
  migration014StreakCelebration,
  migration015GoalRingState,
  migration016FuriganaOverrides,
  migration017AiSessions,
];
