-- =============================================================================
-- Migration: 20261027_npl_schema.sql
-- Description: Nepal Premier League (NPL) fixtures, live scores, and broadcasts
-- Author: Sportivo Engineering
-- =============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: npl_matches
CREATE TABLE IF NOT EXISTS public.npl_matches (
    id TEXT PRIMARY KEY, -- e.g. 'npl26-01', 'npl26-02', 'npl26-03'
    match_number INTEGER,
    competition TEXT NOT NULL DEFAULT 'Nepal Premier League',
    season TEXT NOT NULL DEFAULT '2026',
    round TEXT NOT NULL DEFAULT 'League',
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_team_short TEXT,
    away_team_short TEXT,
    home_team_logo TEXT,
    away_team_logo TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    venue TEXT NOT NULL DEFAULT 'Tribhuvan University International Cricket Ground, Kirtipur',
    status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED')),
    home_score TEXT,
    away_score TEXT,
    summary TEXT,
    source_url TEXT DEFAULT 'https://nepalpremierleague.org/fixtures',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_npl_matches_start_time ON public.npl_matches (start_time);
CREATE INDEX IF NOT EXISTS idx_npl_matches_status ON public.npl_matches (status);

-- 2. Table: npl_broadcasts
CREATE TABLE IF NOT EXISTS public.npl_broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT NOT NULL REFERENCES public.npl_matches(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- e.g. 'Action Sports HD', 'DishHome', 'NetTV', 'YouTube Official'
    authorized_embed_url TEXT NOT NULL,
    authorization_status TEXT NOT NULL DEFAULT 'authorized' CHECK (authorization_status IN ('authorized', 'pending_verification', 'revoked')),
    availability_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (availability_status IN ('live', 'scheduled', 'offline')),
    is_hls BOOLEAN NOT NULL DEFAULT FALSE,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npl_broadcasts_match_id ON public.npl_broadcasts (match_id);
CREATE INDEX IF NOT EXISTS idx_npl_broadcasts_availability ON public.npl_broadcasts (availability_status);
CREATE INDEX IF NOT EXISTS idx_npl_broadcasts_auth_status ON public.npl_broadcasts (authorization_status);

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS
ALTER TABLE public.npl_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npl_broadcasts ENABLE ROW LEVEL SECURITY;

-- Matches: Public read access for visitors
DROP POLICY IF EXISTS "Public can view NPL matches" ON public.npl_matches;
CREATE POLICY "Public can view NPL matches"
    ON public.npl_matches
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Matches: Service-role only write access (Admin synchronization)
DROP POLICY IF EXISTS "Service role manages NPL matches" ON public.npl_matches;
CREATE POLICY "Service role manages NPL matches"
    ON public.npl_matches
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Broadcasts: Public read access ONLY for authorized and verified broadcasts
DROP POLICY IF EXISTS "Public can view authorized broadcasts" ON public.npl_broadcasts;
CREATE POLICY "Public can view authorized broadcasts"
    ON public.npl_broadcasts
    FOR SELECT
    TO anon, authenticated
    USING (authorization_status = 'authorized');

-- Broadcasts: Service-role only write access
DROP POLICY IF EXISTS "Service role manages NPL broadcasts" ON public.npl_broadcasts;
CREATE POLICY "Service role manages NPL broadcasts"
    ON public.npl_broadcasts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

