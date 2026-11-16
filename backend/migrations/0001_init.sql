CREATE TABLE users (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE identities (provider TEXT NOT NULL, sub TEXT NOT NULL, user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, PRIMARY KEY (provider, sub));
CREATE INDEX identities_user ON identities(user_id);
CREATE TABLE sync_state (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, last_device_id TEXT);
CREATE TABLE refresh_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  device_id TEXT NOT NULL, device_label TEXT NOT NULL, created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL, revoked_at INTEGER);
CREATE INDEX refresh_tokens_device ON refresh_tokens(device_id);
CREATE INDEX refresh_tokens_user ON refresh_tokens(user_id);
