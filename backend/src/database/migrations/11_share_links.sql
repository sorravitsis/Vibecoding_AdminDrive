CREATE TABLE IF NOT EXISTS share_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files ON DELETE CASCADE,
  folder_id UUID REFERENCES folders ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  access_type VARCHAR(20) DEFAULT 'view', -- 'view' or 'download'
  password_hash VARCHAR(255),
  expires_at TIMESTAMP,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT one_shared_item CHECK (
    (file_id IS NOT NULL)::int + (folder_id IS NOT NULL)::int = 1
  )
);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_share_links_file ON share_links(file_id);
