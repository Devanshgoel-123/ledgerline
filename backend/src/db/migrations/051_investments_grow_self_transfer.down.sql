-- Rollback: Remove self-transfer category and Grow provider
DELETE FROM providers WHERE is_global = TRUE AND canonical_name = 'Zerodha Grow';
DELETE FROM categories WHERE is_global = TRUE AND slug = 'self-transfer';

-- Restore investments category description
UPDATE categories
SET blurb = 'Brokers · SIPs · mutual funds'
WHERE is_global = TRUE AND slug = 'investments';
