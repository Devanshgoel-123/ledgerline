-- Google sign-in proves an email address; email/password sign-up does not.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;
-- Session tokens issued before this moment are rejected (account claimed, password reset, etc.).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMP WITH TIME ZONE;

-- Until now every account was created through Google sign-in, so all existing emails are proven.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
