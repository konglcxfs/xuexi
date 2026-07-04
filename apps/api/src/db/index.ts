import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_FILE = process.env.XUEXI_DB_FILE ?? path.join(__dirname, '..', '..', 'data', 'xuexi.sqlite')

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })

// 优先使用 node:sqlite 内置模块（Node 22+ 自带），零依赖、零原生编译。
// node:sqlite 的 DatabaseSync API 与 better-sqlite3 几乎一致。
export const db = new DatabaseSync(DB_FILE)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

/**
 * 极简 schema —— 直接写 SQL，便于查看。
 */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary_school', 'ruankao')),
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  graph TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  prerequisites_json TEXT NOT NULL DEFAULT '[]',
  difficulty REAL NOT NULL DEFAULT 0.5,
  tags_json TEXT NOT NULL DEFAULT '[]',
  mastery_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS mastery_states (
  user_id TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  mastery REAL NOT NULL DEFAULT 0,
  stability REAL NOT NULL DEFAULT 1,
  last_reviewed_at TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, knowledge_point_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  current_day_index INTEGER NOT NULL DEFAULT 0,
  days_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  knowledge_point_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  knowledge_point_id TEXT,
  plan_task_id TEXT,
  state TEXT NOT NULL DEFAULT 'idle',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weakness_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  report_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mastery_user ON mastery_states(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user ON learning_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_sessions(user_id);

-- ----------------------------------------------------------------------------
-- 桌面端 / 多平台需要的桌面相关表（与原有 role-based 表并存，向后兼容）
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  vendor TEXT NOT NULL CHECK (vendor IN ('openai','deepseek','anthropic','ollama','custom')),
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  -- 加密后的 API key（base64 + 由调用方传入的 secret 解密）
  encrypted_api_key TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_cfg_user ON ai_provider_configs(user_id);

CREATE TABLE IF NOT EXISTS subject_enrollments (
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  PRIMARY KEY (user_id, subject_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enroll_user ON subject_enrollments(user_id);

CREATE TABLE IF NOT EXISTS user_knowledge_graphs (
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  graph_id TEXT NOT NULL,
  -- 整张图谱快照的 JSON（节点 + 连接）
  graph_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, subject_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_library (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('textbook','question_bank','material')),
  display_name TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  locator TEXT NOT NULL,
  -- 来源文件 / 目录快照
  files_json TEXT NOT NULL DEFAULT '[]',
  -- 已抽取出的知识点 / 题目（JSON）
  extracted_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_src_user ON source_library(user_id);

-- ----------------------------------------------------------------------------
-- 家长课程 / 目标 / 每日计划块 / 家庭 / 测评（Phase 1 + 课程/目标 MVP）
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS family_members (
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent','child')),
  alias TEXT,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (family_id, user_id),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fam_member_user ON family_members(user_id);

CREATE TABLE IF NOT EXISTS parent_curriculums (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  parent_user_id TEXT NOT NULL,
  child_user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  priority REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (child_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_curr_child ON parent_curriculums(child_user_id, status);
CREATE INDEX IF NOT EXISTS idx_curr_family ON parent_curriculums(family_id);

CREATE TABLE IF NOT EXISTS parent_goals (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  parent_user_id TEXT NOT NULL,
  child_user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metric_json TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','expired','abandoned')),
  progress_json TEXT NOT NULL DEFAULT '{"lastCheckedAt":"","value":0,"note":""}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (child_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goal_child ON parent_goals(child_user_id, status);

CREATE TABLE IF NOT EXISTS daily_plan_blocks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                       -- YYYY-MM-DD
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('preview','review','learn','practice')),
  title TEXT NOT NULL,
  knowledge_point_ids_json TEXT NOT NULL DEFAULT '[]',
  estimated_minutes INTEGER NOT NULL DEFAULT 15,
  reason TEXT NOT NULL DEFAULT '',
  source_ref_json TEXT NOT NULL DEFAULT '{"kind":"manual","refId":"","label":""}',
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  resource_refs_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_user_date ON daily_plan_blocks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_plan_blocks(date);

CREATE TABLE IF NOT EXISTS placement_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  theta REAL NOT NULL DEFAULT 0,
  se REAL NOT NULL DEFAULT 1,
  responses_json TEXT NOT NULL DEFAULT '[]',
  profile_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_placement_user ON placement_sessions(user_id);
`)
