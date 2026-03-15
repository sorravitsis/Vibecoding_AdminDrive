-- Phase 4: Session Invalidation (Add token_version to users)

-- 1. Add token_version to users
ALTER TABLE users
    ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN updated_at    TIMESTAMP DEFAULT NOW();
