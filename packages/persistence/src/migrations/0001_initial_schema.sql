-- Migration: 0001_initial_schema
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace members
CREATE TABLE IF NOT EXISTS workspace_members (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'reviewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_workspace_member UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  is_demo_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions (connect-pg-simple compatible)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(255) PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  current_version_id VARCHAR(64),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(workspace_id, document_type);

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  byte_size INTEGER NOT NULL,
  media_type VARCHAR(128) NOT NULL,
  storage_uri VARCHAR(512) NOT NULL,
  extractor_version VARCHAR(32) NOT NULL,
  page_count INTEGER NOT NULL,
  canonical_text TEXT NOT NULL,
  document_ir_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_doc_version UNIQUE (document_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_sha ON document_versions(workspace_id, sha256);

-- Source blocks
CREATE TABLE IF NOT EXISTS source_blocks (
  id VARCHAR(64) PRIMARY KEY,
  document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  block_id VARCHAR(128) NOT NULL,
  page_number INTEGER NOT NULL,
  block_type VARCHAR(32) NOT NULL,
  canonical_start INTEGER NOT NULL,
  canonical_end INTEGER NOT NULL,
  text TEXT NOT NULL,
  confidence VARCHAR(16),
  is_ocr BOOLEAN NOT NULL DEFAULT FALSE,
  bounding_box_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_source_blocks_version ON source_blocks(document_version_id);
CREATE INDEX IF NOT EXISTS idx_source_blocks_offsets ON source_blocks(document_version_id, canonical_start, canonical_end);

-- Vector chunks
CREATE TABLE IF NOT EXISTS vector_chunks (
  id VARCHAR(64) PRIMARY KEY,
  document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading_context VARCHAR(255),
  canonical_start INTEGER NOT NULL,
  canonical_end INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_version ON vector_chunks(document_version_id);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_workspace ON vector_chunks(workspace_id);

-- Analysis tasks
CREATE TABLE IF NOT EXISTS analysis_tasks (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  comparison_version_id VARCHAR(64),
  workflow VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL,
  lease_worker_id VARCHAR(128),
  lease_expires_at TIMESTAMPTZ,
  fencing_token INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  last_error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_poll ON analysis_tasks(status, next_attempt_after, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_version ON analysis_tasks(document_version_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON analysis_tasks(workspace_id);

-- Analysis runs
CREATE TABLE IF NOT EXISTS analysis_runs (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL UNIQUE REFERENCES analysis_tasks(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  comparison_version_id VARCHAR(64),
  workflow VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  summary_json JSONB NOT NULL,
  model_metadata_json JSONB,
  fencing_token INTEGER NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runs_version ON analysis_runs(document_version_id);
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON analysis_runs(workspace_id);

-- Findings
CREATE TABLE IF NOT EXISTS findings (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  workflow VARCHAR(64) NOT NULL,
  rule_id VARCHAR(128),
  category VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  explanation TEXT NOT NULL,
  suggested_action TEXT,
  suggested_patch_json JSONB,
  confidence VARCHAR(32) NOT NULL DEFAULT 'high',
  decision_state VARCHAR(32) NOT NULL DEFAULT 'pending',
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  decided_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_run ON findings(run_id);
CREATE INDEX IF NOT EXISTS idx_findings_version ON findings(document_version_id);
CREATE INDEX IF NOT EXISTS idx_findings_workspace ON findings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_findings_decision ON findings(workspace_id, decision_state);

-- Citations
CREATE TABLE IF NOT EXISTS citations (
  id VARCHAR(64) PRIMARY KEY,
  finding_id VARCHAR(64) NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_version_id VARCHAR(64) NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  block_id VARCHAR(128) NOT NULL,
  page_number INTEGER NOT NULL,
  canonical_start INTEGER NOT NULL,
  canonical_end INTEGER NOT NULL,
  exact_quote TEXT NOT NULL,
  confidence VARCHAR(16) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'digital_text',
  bounding_box_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_citations_finding ON citations(finding_id);
CREATE INDEX IF NOT EXISTS idx_citations_version ON citations(document_version_id);

-- Model invocations
CREATE TABLE IF NOT EXISTS model_invocations (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  task_id VARCHAR(64) NOT NULL REFERENCES analysis_tasks(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  model_revision VARCHAR(128),
  prompt_hash VARCHAR(64) NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  is_live BOOLEAN NOT NULL,
  is_recorded BOOLEAN NOT NULL,
  is_deterministic BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_invocations_run ON model_invocations(run_id);
CREATE INDEX IF NOT EXISTS idx_model_invocations_task ON model_invocations(task_id);

-- Audit events
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id VARCHAR(64) NOT NULL,
  action VARCHAR(128) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events(target_type, target_id);
