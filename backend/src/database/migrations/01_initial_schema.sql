-- Initial Schema (Before Fixes)

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Folders
CREATE TABLE IF NOT EXISTS folders (
    folder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_folder_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(folder_id),
    owner_id UUID REFERENCES users(user_id),
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Files
CREATE TABLE IF NOT EXISTS files (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_file_id VARCHAR(255) UNIQUE,
    folder_id UUID REFERENCES folders(folder_id),
    uploader_id UUID REFERENCES users(user_id),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Permissions (Broken Polymorphic Reference)
CREATE TABLE IF NOT EXISTS permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL, -- BROKEN: doesn't know if it's a file or folder
    user_id UUID REFERENCES users(user_id),
    access_level VARCHAR(20) NOT NULL -- view | edit
);
