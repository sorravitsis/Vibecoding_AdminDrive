-- Phase 3: Soft Delete (Add status + deleted_at + deleted_by)

-- 1. Alter files table
ALTER TABLE files
    ADD COLUMN status     VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    ADD COLUMN deleted_at TIMESTAMP,
    ADD COLUMN deleted_by UUID REFERENCES users(user_id),
    ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- 2. Alter folders table
ALTER TABLE folders
    ADD COLUMN status     VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    ADD COLUMN deleted_at TIMESTAMP,
    ADD COLUMN deleted_by UUID REFERENCES users(user_id),
    ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- 3. Safety views: Prevents accidentally querying deleted records
CREATE OR REPLACE VIEW active_files AS
    SELECT * FROM files WHERE status = 'active';

CREATE OR REPLACE VIEW active_folders AS
    SELECT * FROM folders WHERE status = 'active';
