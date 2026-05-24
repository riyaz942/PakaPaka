import { migration001Initial } from '@/data/migrations/001_initial';
import type { Migration } from '@/data/migrations/migrations.types';

export const migrations: Migration[] = [migration001Initial];
