-- 054 kept each user's tweaks to a shared app (category, extra UPI ids) in
-- user_provider_overrides. Shared apps now work by giving that user their own
-- copy instead (see 060). Turn every override into the user's copy, move their
-- transactions and rules onto it, then drop the table. Runs before 060 so no
-- override is lost when 060 removes non-brand shared apps.

-- A copy of the shared app for each user who changed it and has none yet.
INSERT INTO providers (user_id, canonical_name, aliases, upi_handles, sender_domains, website_domain, logo_url, category_slug, is_global)
SELECT DISTINCT ON (o.user_id, lower(g.canonical_name))
  o.user_id, g.canonical_name, g.aliases, g.upi_handles, g.sender_domains, g.website_domain, g.logo_url, g.category_slug, FALSE
FROM user_provider_overrides o
JOIN providers g ON g.id = o.provider_id AND g.is_global
WHERE NOT EXISTS (
  SELECT 1 FROM providers p
  WHERE p.user_id = o.user_id AND NOT p.is_global AND lower(p.canonical_name) = lower(g.canonical_name)
);

-- The user's choices go on their copy.
UPDATE providers c
SET upi_handles = ARRAY(SELECT DISTINCT h FROM unnest(c.upi_handles || o.upi_handles) AS h),
    category_slug = COALESCE(o.category_slug, c.category_slug)
FROM user_provider_overrides o
JOIN providers g ON g.id = o.provider_id AND g.is_global
WHERE c.user_id = o.user_id AND NOT c.is_global AND lower(c.canonical_name) = lower(g.canonical_name);

-- Their payments and rules follow the copy.
UPDATE transactions t
SET provider_id = c.id
FROM user_provider_overrides o
JOIN providers g ON g.id = o.provider_id AND g.is_global
JOIN providers c ON c.user_id = o.user_id AND NOT c.is_global AND lower(c.canonical_name) = lower(g.canonical_name)
WHERE t.user_id = o.user_id AND t.provider_id = g.id;

UPDATE user_rules r
SET set_provider_id = c.id
FROM user_provider_overrides o
JOIN providers g ON g.id = o.provider_id AND g.is_global
JOIN providers c ON c.user_id = o.user_id AND NOT c.is_global AND lower(c.canonical_name) = lower(g.canonical_name)
WHERE r.user_id = o.user_id AND r.set_provider_id = g.id;

DROP TABLE user_provider_overrides;
