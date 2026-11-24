-- 설정값: enabled ('true' | 'false') — 관리자 패널에서 체험을 켜고 끈다
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO state (key, value) VALUES ('enabled', 'true');

-- 세트 기록: 한 사람(player)이 세트마다 한 줄. 랭킹은 사람별 최고 세트로 계산 (js/ranking.js)
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL,
  nickname TEXT NOT NULL,
  set_no INTEGER NOT NULL,
  mission_id TEXT NOT NULL,
  low_stars INTEGER NOT NULL,
  low_q INTEGER NOT NULL,
  top_stars INTEGER NOT NULL,
  top_q INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (player, set_no)
);
