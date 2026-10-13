-- "Passed on": money that moved through your account for someone else (it is not your spend).
INSERT INTO categories (user_id, slug, label, blurb, accent, is_global, sort_order, meta)
SELECT NULL, 'passed-on', 'Passed on', 'Someone else''s money that you passed on', '#64748b', TRUE, 28, '{"parent":"household"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE is_global = TRUE AND slug = 'passed-on');

-- An earlier version also relabelled specific payments in one person's ledger.
-- Per-person data fixes do not belong in migrations: they run on every install.
