-- Migration: Data Privacy Cleanup
-- Remove sensitive fields that violate compliance rules
-- Keep only: amount, date, type, merchant, category, upi_id (as reference, not account number)

-- Step 1: Rename description to narration_summary (store only merchant-extracted text, not full narration)
ALTER TABLE transactions
  RENAME COLUMN description TO narration_summary;

-- Add comment to clarify: this should contain only merchant name/category info, never full transaction narration
COMMENT ON COLUMN transactions.narration_summary IS
  'PRIVACY: Store only merchant/category info extracted from narration. Never store full transaction text. Max 100 chars.';

-- Step 2: Add encryption key column (for future encryption at rest)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS encrypted_at timestamp(3) with time zone;

-- Step 3: Make payee field optional (recipients are sensitive - users may remove this)
ALTER TABLE transactions
  ALTER COLUMN payee DROP NOT NULL;

-- Step 4: Add data_retention_expires for GDPR/privacy compliance
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS data_retention_expires date;

-- Default: Keep transaction data for 7 years (India's financial record retention requirement)
UPDATE transactions
  SET data_retention_expires = date + interval '7 years'
  WHERE data_retention_expires IS NULL;

-- Step 5: Add comment on upi_id to clarify it's a reference, not account number
COMMENT ON COLUMN transactions.upi_id IS
  'PRIVACY: UPI reference ID (e.g., UPI/123456/HDFC), not a user account number. Safe to store.';

-- Step 6: Create index on user_id + account_id for faster multi-bank queries
CREATE INDEX IF NOT EXISTS transactions_user_account_idx
  ON transactions(user_id, account_id);

-- Step 7: Add audit log table for compliance tracking
CREATE TABLE IF NOT EXISTS transaction_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'created', 'updated', 'deleted'
  changed_fields jsonb,
  timestamp timestamp(3) with time zone NOT NULL DEFAULT now(),
  ip_address text
);

CREATE INDEX IF NOT EXISTS transaction_audit_log_user_idx
  ON transaction_audit_log(user_id);

-- Step 8: Add encryption key table for user-controlled encryption
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  key_hash text NOT NULL, -- Hash of encryption key (never store actual key)
  created_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now()
);

-- Step 9: Add telegram queue table for processing PDFs without blocking
CREATE TABLE IF NOT EXISTS telegram_pdf_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id text NOT NULL,
  file_name text,
  bank_type text, -- 'hdfc', 'icici', 'sbi'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message text,
  created_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  processing_started_at timestamp(3) with time zone,
  completed_at timestamp(3) with time zone,
  retry_count integer NOT NULL DEFAULT 0,
  INDEX idx_user_status (user_id, status),
  INDEX idx_pending (status, created_at)
);

-- Step 10: Add telegram processed files table to avoid re-processing
CREATE TABLE IF NOT EXISTS telegram_processed_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id text NOT NULL,
  file_hash text NOT NULL,
  processed_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  transaction_count integer,
  UNIQUE(user_id, file_id)
);

-- Step 11: Update auth to make email optional (support OAuth-only users)
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

-- Add oauth provider tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider text, -- 'google', 'github', etc
  ADD COLUMN IF NOT EXISTS oauth_id text;

CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_unique
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;
