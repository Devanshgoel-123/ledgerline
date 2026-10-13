-- A payment the user deleted stays deleted: mail scans and statement imports
-- check this list before adding the same payment back.
CREATE TABLE IF NOT EXISTS deleted_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  mail_message_id TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deleted_transactions_user_date_idx ON deleted_transactions (user_id, date);
CREATE INDEX IF NOT EXISTS deleted_transactions_user_mail_idx ON deleted_transactions (user_id, mail_message_id);
