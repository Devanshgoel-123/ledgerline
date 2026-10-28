-- Ledgerline runs on your own machine for one person: no sign-in, so the
-- account, allowlist, invite and reset-link storage goes.
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS allowed_emails;
DROP TABLE IF EXISTS invites;
DROP INDEX IF EXISTS users_apple_sub_idx;
ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS apple_sub,
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS sessions_valid_after;
