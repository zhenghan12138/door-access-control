CREATE TABLE gateway_commands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action = 'open-door'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  response_json TEXT,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL
);

CREATE INDEX gateway_commands_pending_idx ON gateway_commands(status, created_at);
CREATE INDEX gateway_commands_expires_idx ON gateway_commands(expires_at);
