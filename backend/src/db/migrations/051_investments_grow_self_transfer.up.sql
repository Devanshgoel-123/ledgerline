-- Add new investment-related categories and providers
-- Add self-transfer as a subcategory of investments
INSERT INTO categories (user_id, slug, label, blurb, accent, is_global, sort_order, meta)
SELECT NULL, 'self-transfer', 'Self Transfer', 'Internal transfers between accounts', '#8b8b8b', TRUE, 8, '{"parent": "investments"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE is_global = TRUE AND slug = 'self-transfer');

-- Add Grow (Zerodha) as a provider under investments
INSERT INTO providers (user_id, canonical_name, aliases, upi_handles, sender_domains, website_domain, logo_url, category_slug, is_global)
SELECT NULL, 'Zerodha Grow', ARRAY['Grow', 'Zerodha Grow', 'Groww'], ARRAY[]::text[], ARRAY['groww.in', 'zerodha.com'], 'groww.in', 'https://zerodha.com/static/images/branding/zerodha-logo.svg', 'investments', TRUE
WHERE NOT EXISTS (SELECT 1 FROM providers WHERE is_global = TRUE AND canonical_name = 'Zerodha Grow');

-- Update investments category description to include Grow
UPDATE categories
SET blurb = 'Brokers · SIPs · mutual funds · Grow'
WHERE is_global = TRUE AND slug = 'investments';
