CREATE TABLE starred_files (
  star_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users ON DELETE CASCADE,
  file_id UUID REFERENCES files ON DELETE CASCADE,
  folder_id UUID REFERENCES folders ON DELETE CASCADE,
  starred_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT one_starred_item CHECK (
    (file_id IS NOT NULL)::int + (folder_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT unique_star_file UNIQUE (user_id, file_id),
  CONSTRAINT unique_star_folder UNIQUE (user_id, folder_id)
);
CREATE INDEX idx_starred_user ON starred_files(user_id, starred_at DESC);
