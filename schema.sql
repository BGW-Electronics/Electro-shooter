-- BGW ELECTRO SHOOTER leaderboard schema (Cloudflare D1)
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  time REAL NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores (ip_hash, created_at);

-- daily play counter (one row per UTC day) — powers "played today / this month"
CREATE TABLE IF NOT EXISTS plays (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- last ping time per IP, used only to throttle rapid-fire /api/plays POSTs
CREATE TABLE IF NOT EXISTS play_pings (
  ip_hash TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
