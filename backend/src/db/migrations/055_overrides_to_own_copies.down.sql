-- Copies made by the up migration stay; only the old table comes back, empty.
CREATE TABLE IF NOT EXISTS user_provider_overrides (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_slug TEXT,
  upi_handles TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider_id)
);
