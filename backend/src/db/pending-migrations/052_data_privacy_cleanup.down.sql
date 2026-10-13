-- Rollback: Data Privacy Cleanup

-- Drop new tables
DROP TABLE IF EXISTS telegram_processed_files;
DROP TABLE IF EXISTS telegram_pdf_queue;
DROP TABLE IF EXISTS user_encryption_keys;
DROP TABLE IF EXISTS transaction_audit_log;

-- Restore old auth structure
ALTER TABLE users
  DROP COLUMN IF EXISTS oauth_provider,
  DROP COLUMN IF EXISTS oauth_id;

DROP INDEX IF EXISTS users_oauth_unique;

-- Make email and password required again
ALTER TABLE users
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL;

-- Restore payee as required
ALTER TABLE transactions
  ALTER COLUMN payee SET NOT NULL;

-- Remove new columns
ALTER TABLE transactions
  DROP COLUMN IF EXISTS data_retention_expires,
  DROP COLUMN IF EXISTS encrypted_at;

-- Rename back
ALTER TABLE transactions
  RENAME COLUMN narration_summary TO description;

-- Drop indexes
DROP INDEX IF EXISTS transactions_user_account_idx;
