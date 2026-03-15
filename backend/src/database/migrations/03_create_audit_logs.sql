-- Phase 2: Create audit_logs table (Activity Stream)

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID        REFERENCES users(user_id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL, -- Values: 'upload' | 'delete' | 'restore' | 'download' | 'share' | 'rename'
    target_type VARCHAR(20) NOT NULL, -- Values: 'file' | 'folder'
    target_id   UUID        NOT NULL,
    metadata    JSONB, -- Example: { file_name: 'report.pdf', folder_id: '...', ip: '...' }
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Indexes for fast Activity Stream queries
CREATE INDEX idx_audit_actor_time  ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_target_time ON audit_logs(target_id, created_at DESC);
CREATE INDEX idx_audit_recent      ON audit_logs(created_at DESC);
