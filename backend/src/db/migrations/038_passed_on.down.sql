UPDATE transactions SET category_slug = 'other' WHERE category_slug = 'passed-on';
UPDATE user_rules SET set_category_slug = NULL WHERE set_category_slug = 'passed-on';
DELETE FROM categories WHERE is_global = TRUE AND slug = 'passed-on';
