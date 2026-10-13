-- Store category hints for UPI IDs to enable pre-suggestion on future transactions
CREATE TABLE upi_category_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upi_id VARCHAR(255) NOT NULL,
  category_slug VARCHAR(50) NOT NULL,
  usage_count INT NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, upi_id)
);

CREATE INDEX upi_category_hints_last_used_idx
  ON upi_category_hints (user_id, last_used_at);

-- Backfill hints from existing categorized transactions, keeping the most used category per UPI ID
INSERT INTO upi_category_hints (user_id, upi_id, category_slug, usage_count, last_used_at)
SELECT DISTINCT ON (user_id, upi_id)
  user_id,
  upi_id,
  category_slug,
  usage_count,
  last_used
FROM (
  SELECT
    t.user_id,
    t.upi_id,
    t.category_slug,
    COUNT(*) AS usage_count,
    MAX(t.date::timestamp with time zone) AS last_used
  FROM transactions t
  WHERE t.upi_id IS NOT NULL
    AND t.category_slug IS NOT NULL
    AND t.payee IS NOT NULL  -- Only person-to-person transactions
  GROUP BY t.user_id, t.upi_id, t.category_slug
) counted
ORDER BY user_id, upi_id, usage_count DESC, last_used DESC;
