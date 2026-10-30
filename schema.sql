-- 排行榜資料表
-- 套用：npx wrangler d1 execute orbiter-leaderboard --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,            -- 每局一次，避免同一局重複上傳
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cruise', 'combat')),
  km INTEGER NOT NULL,
  kills INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT NOT NULL,                  -- 雜湊後的來源，僅用於限制送出頻率，不存原始 IP
  created_at INTEGER NOT NULL
);

-- D1 依掃描列數計費，排名與頻率檢查都要走索引
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (mode, km DESC);
CREATE INDEX IF NOT EXISTS idx_scores_rate ON scores (ip_hash, created_at);
