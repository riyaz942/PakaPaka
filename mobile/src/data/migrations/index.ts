import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { migration004PassagePracticeResults } from '@/data/migrations/004_passage_practice_results';
import { migration005PersonalMnemonics } from '@/data/migrations/005_personal_mnemonics';
import { migration006RelatedItemBoosts } from '@/data/migrations/006_related_item_boosts';
import { migration007WeaknessStats } from '@/data/migrations/007_weakness_stats';
import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { migration009Streak } from '@/data/migrations/009_streak';
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
];
