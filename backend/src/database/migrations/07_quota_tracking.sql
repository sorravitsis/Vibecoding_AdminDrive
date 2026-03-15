-- Phase 6: Quota Tracking (Add quota_bytes and used_bytes to users)

-- 1. Add columns to users
ALTER TABLE users
    ADD COLUMN quota_bytes BIGINT NOT NULL DEFAULT 5368709120, -- Default 5 GB
    ADD COLUMN used_bytes  BIGINT NOT NULL DEFAULT 0;

-- 2. Backfill existing data if any (O(n) during migration only)
UPDATE users u SET used_bytes = (
    SELECT COALESCE(SUM(f.file_size), 0)
    FROM files f
    WHERE f.uploader_id = u.user_id
        AND f.status = 'active'
);
