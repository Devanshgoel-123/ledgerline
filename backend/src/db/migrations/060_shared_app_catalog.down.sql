-- Personal copies and catalog resets cannot be undone without losing data.
-- Restore the old "Zerodha Grow" name so earlier migrations' lookups still match.
UPDATE providers SET canonical_name = 'Zerodha Grow'
WHERE is_global = TRUE AND canonical_name = 'Groww';
