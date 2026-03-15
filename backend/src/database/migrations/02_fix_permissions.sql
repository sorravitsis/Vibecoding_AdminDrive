-- Phase 1: Fix permissions table (Polymorphic -> Typed)

-- 1. Drop the broken item_id column
ALTER TABLE permissions DROP COLUMN item_id;

-- 2. Add typed columns with proper Foreign Keys
ALTER TABLE permissions
    ADD COLUMN file_id   UUID REFERENCES files(file_id)    ON DELETE CASCADE,
    ADD COLUMN folder_id UUID REFERENCES folders(folder_id) ON DELETE CASCADE;

-- 3. Enforce exactly one target per row (file or folder)
ALTER TABLE permissions
    ADD CONSTRAINT one_item_only CHECK (
        (file_id IS NOT NULL)::int + (folder_id IS NOT NULL)::int = 1
    );

-- 4. Create indexes for fast lookups
CREATE INDEX idx_perm_file   ON permissions(file_id, user_id);
CREATE INDEX idx_perm_folder ON permissions(folder_id, user_id);
