-- Bank mail is read over IMAP with an app password instead of Google OAuth.
-- A mailbox connected through Google keeps its address and scan progress, but
-- has no password yet: the app asks for one before the next scan.
ALTER TABLE gmail_connections RENAME TO mail_connections;
ALTER TABLE mail_connections RENAME COLUMN google_email TO email;
ALTER TABLE mail_connections
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gmail',
  ADD COLUMN IF NOT EXISTS host TEXT NOT NULL DEFAULT 'imap.gmail.com',
  ADD COLUMN IF NOT EXISTS port INTEGER NOT NULL DEFAULT 993,
  ADD COLUMN IF NOT EXISTS password_encrypted TEXT;
ALTER TABLE mail_connections
  ALTER COLUMN provider DROP DEFAULT,
  ALTER COLUMN host DROP DEFAULT,
  ALTER COLUMN port DROP DEFAULT,
  DROP COLUMN IF EXISTS refresh_token_encrypted,
  DROP COLUMN IF EXISTS access_token_encrypted,
  DROP COLUMN IF EXISTS token_expiry,
  DROP COLUMN IF EXISTS history_id,
  DROP COLUMN IF EXISTS watch_expiration;

-- Message ids are no longer Gmail's: name the columns for any mailbox.
ALTER TABLE mail_messages RENAME COLUMN gmail_message_id TO message_id;
ALTER TABLE imports RENAME COLUMN gmail_message_id TO mail_message_id;

ALTER TABLE imports DROP CONSTRAINT IF EXISTS imports_source_check;
UPDATE imports SET source = 'mail' WHERE source = 'gmail';
ALTER TABLE imports ADD CONSTRAINT imports_source_check CHECK (source IN ('upload', 'mail'));
