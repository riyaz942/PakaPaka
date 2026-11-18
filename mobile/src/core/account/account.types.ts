import type { Result } from '@/types/result.types';

export type AccountErrorCode =
  | 'paused'
  | 'rate_limited'
  | 'network'
  | 'session_ended'
  | 'cancelled'
  | 'not_found'
  | 'revision_conflict'
  | 'server';

export type AccountDevice = {
  deviceId: string;
  label: string;
  lastUsedAt: number;
  current: boolean;
};

export type AccountInfo = {
  provider: 'google';
  devices: AccountDevice[];
};

export type AccountSession = {
  isSignedIn(): Promise<boolean>;
  signIn(): Promise<Result<void>>;
  getAccount(): Promise<Result<AccountInfo>>;
  removeDevice(id: string): Promise<Result<void>>;
  signOut(): Promise<Result<void>>;
  signOutEverywhere(): Promise<Result<void>>;
  deleteAccount(): Promise<Result<void>>;
  /** An authorized call with the same refresh rules as the calls above. */
  request(path: string, init: RequestInit): Promise<Result<Response>>;
};
