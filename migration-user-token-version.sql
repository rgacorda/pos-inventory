-- =============================================================================
-- Migration: Track a session version on each user
--
-- Adds:
--   users."tokenVersion"
--
-- Existing sessions stay valid. Logging everyone out increments this value
-- and rejects tokens issued before that.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-user-token-version.sql
--
-- Safe to re-run: ADD COLUMN uses IF NOT EXISTS.
-- =============================================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0;

COMMIT;
