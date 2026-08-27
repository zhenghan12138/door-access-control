CREATE TABLE proxy_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  updated_at INTEGER NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
