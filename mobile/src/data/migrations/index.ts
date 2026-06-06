import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import type { Migration } from '@/data/migrations/migrations.types';

export const migrations: Migration[] = [migration001Initial, migration002ItemStudyStatus];
