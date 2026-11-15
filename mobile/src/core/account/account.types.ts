export type AccountErrorCode =
  | 'paused'
  | 'rate_limited'
  | 'network'
  | 'session_ended'
  | 'cancelled'
  | 'not_found'
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
