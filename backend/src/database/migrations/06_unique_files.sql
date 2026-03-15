-- Phase 5: Race Condition (Add UNIQUE constraint on files)

-- 1. Unique index only for active files in the same folder
-- (Deleted files can have duplicate names in the recycle bin)
-- Use CREATE UNIQUE INDEX for partial unique constraints in PostgreSQL
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_file_per_folder 
ON files (folder_id, file_name) 
WHERE (status = 'active');
