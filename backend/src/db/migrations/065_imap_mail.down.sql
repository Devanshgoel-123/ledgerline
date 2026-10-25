ALTER TABLE imports DROP CONSTRAINT IF EXISTS imports_source_check;
UPDATE imports SET source = 'gmail' WHERE source = 'mail';
ALTER TABLE imports ADD CONSTRAINT imports_source_check CHECK (source IN ('upload', 'gmail'));

ALTER TABLE imports RENAME COLUMN mail_message_id TO gmail_message_id;
ALTER TABLE mail_messages RENAME COLUMN message_id TO gmail_message_id;

-- App passwords cannot become OAuth tokens: Gmail has to be connected again.
ALTER TABLE mail_connections
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS history_id TEXT,
  ADD COLUMN IF NOT EXISTS watch_expiration TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_connections ALTER COLUMN refresh_token_encrypted DROP DEFAULT;
ALTER TABLE mail_connections
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS host,
  DROP COLUMN IF EXISTS port,
  DROP COLUMN IF EXISTS password_encrypted;
ALTER TABLE mail_connections RENAME COLUMN email TO google_email;
ALTER TABLE mail_connections RENAME TO gmail_connections;
