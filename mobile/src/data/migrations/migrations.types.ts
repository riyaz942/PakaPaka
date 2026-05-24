import type { SQLiteDatabase } from 'expo-sqlite';

export type MigrationDatabase = Pick<
  SQLiteDatabase,
  'execSync' | 'runSync' | 'getAllSync' | 'getFirstSync' | 'withTransactionSync'
>;

export type Migration = {
  version: number;
  name: string;
  up: (db: MigrationDatabase) => void;
};
