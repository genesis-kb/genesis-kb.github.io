-- ============================================================
-- Auth Users Migration
-- Creates the users table for JWT-based authentication.
-- Portable — no vendor dependency (Supabase, Clerk, etc.)
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL,
    password    TEXT NOT NULL,              -- bcrypt hash
    name        TEXT,
    avatar_url  TEXT,
    provider    TEXT DEFAULT 'local',       -- 'local' | 'github' (future OAuth)
    provider_id TEXT,                       -- external provider user ID (future)
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Secure table so hashes cannot be read via APIs (P1)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id) WHERE provider_id IS NOT NULL;

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
    CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_users_updated_at();
END $$;
