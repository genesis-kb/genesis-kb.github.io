-- ============================================================
-- Auth Users Migration
-- Creates the users table for JWT-based authentication.
-- Portable — no vendor dependency (Supabase, Clerk, etc.)
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,              -- bcrypt hash
    name        TEXT,
    avatar_url  TEXT,
    provider    TEXT DEFAULT 'local',       -- 'local' | 'github' (future OAuth)
    provider_id TEXT,                       -- external provider user ID (future)
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();
