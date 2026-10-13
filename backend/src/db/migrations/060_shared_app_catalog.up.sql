-- Shared apps are the same for every user: well-known brands, their
-- categories, and their merchant UPI handles. Anything a user added to a
-- shared app (a personal UPI id, a category change) moves to that user's own
-- copy, and the shared app goes back to the catalog below.

CREATE TEMP TABLE shared_catalog (name TEXT PRIMARY KEY, category TEXT, handles TEXT[]);
INSERT INTO shared_catalog (name, category, handles) VALUES
  ('Adidas', 'shopping', '{adidas}'::text[]),
  ('Airtel Payments', 'household', '{airtelpayments}'::text[]),
  ('Ajio', 'shopping', '{ajio}'::text[]),
  ('Allen Solly', 'shopping', '{allensolly}'::text[]),
  ('Amazon', 'shopping', '{amazon}'::text[]),
  ('Apollo Hospital', 'healthcare', '{apollo,apollohospital,apollohospitals,apollopharmacy}'::text[]),
  ('Apple', 'shopping', '{apple,applestore,itunes,appleservices}'::text[]),
  ('Axis Bank', 'banks', '{}'::text[]),
  ('Bata', 'shopping', '{bata}'::text[]),
  ('Bewakoof', 'shopping', '{bewakoof}'::text[]),
  ('Biba', 'shopping', '{biba}'::text[]),
  ('BigBasket', 'grocery', '{bigbasket}'::text[]),
  ('Bistro', 'food', '{bistro}'::text[]),
  ('Blinkit', 'food', '{blinkit}'::text[]),
  ('Burger King', 'food', '{burgerking}'::text[]),
  ('Chaayos', 'food', '{chaayos}'::text[]),
  ('Croma', 'shopping', '{croma,infinitiretail}'::text[]),
  ('Cult.fit', 'sports', '{cultfit,curefit}'::text[]),
  ('DMart', 'grocery', '{dmart,avenuesupermarts}'::text[]),
  ('Decathlon', 'shopping', '{decathlon}'::text[]),
  ('District', 'outing', '{district}'::text[]),
  ('Dominos', 'food', '{dominos,dominospizza}'::text[]),
  ('EatSure', 'food', '{eatsure}'::text[]),
  ('Fabindia', 'shopping', '{fabindia}'::text[]),
  ('FirstCry', 'shopping', '{firstcry}'::text[]),
  ('Flipkart', 'shopping', '{flipkart}'::text[]),
  ('Furlenco', 'household', '{furlenco}'::text[]),
  ('H&M', 'shopping', '{handm,hmhennes}'::text[]),
  ('HDFC Bank', 'banks', '{}'::text[]),
  ('ICICI Bank', 'banks', '{}'::text[]),
  ('IKEA', 'household', '{ikea}'::text[]),
  ('Instamart', 'food', '{instamart}'::text[]),
  ('Jio WiFi', 'household', '{jiofiber,jiowifi}'::text[]),
  ('JioMart', 'grocery', '{jiomart}'::text[]),
  ('KFC', 'food', '{kfc}'::text[]),
  ('Lapinoz', 'food', '{lapinoz,lapinozpizza}'::text[]),
  ('Lenskart', 'shopping', '{lenskart}'::text[]),
  ('Levi''s', 'shopping', '{levis,levistrauss}'::text[]),
  ('Lifestyle', 'shopping', '{lifestylestores}'::text[]),
  ('Louis Philippe', 'shopping', '{louisphilippe}'::text[]),
  ('MakeMyTrip', 'rides', '{makemytrip}'::text[]),
  ('Mamaearth', 'personal', '{mamaearth,honasa}'::text[]),
  ('Marks & Spencer', 'shopping', '{marksandspencer,marksspencer}'::text[]),
  ('Max Fashion', 'shopping', '{maxfashion}'::text[]),
  ('McDonald''s', 'food', '{mcdonalds}'::text[]),
  ('Meesho', 'shopping', '{meesho,fashnear}'::text[]),
  ('Metro Shoes', 'shopping', '{metroshoes,mochishoes}'::text[]),
  ('Myntra', 'shopping', '{myntra}'::text[]),
  ('Namma Yatri', 'rides', '{nammayatri,yatri}'::text[]),
  ('Netmeds', 'pharmacy', '{netmeds}'::text[]),
  ('Nike', 'shopping', '{nike}'::text[]),
  ('Nykaa', 'shopping', '{nykaa,nykaafashion,fsnecommerce}'::text[]),
  ('Ownly', 'food', '{ownly,ctrlx,ctrlxtechnologies}'::text[]),
  ('Pantaloons', 'shopping', '{pantaloons,abfrl}'::text[]),
  ('Peter England', 'shopping', '{peterengland}'::text[]),
  ('PharmEasy', 'pharmacy', '{pharmeasy}'::text[]),
  ('Pizza Hut', 'food', '{pizzahut}'::text[]),
  ('Pronto', 'household', '{pronto}'::text[]),
  ('Puma', 'shopping', '{puma}'::text[]),
  ('Purplle', 'personal', '{purplle}'::text[]),
  ('Rapido', 'rides', '{rapido}'::text[]),
  ('Reliance Digital', 'shopping', '{reliancedigital}'::text[]),
  ('Reliance Fresh', 'grocery', '{reliancefresh}'::text[]),
  ('Reliance Retail', 'shopping', '{relianceretail,rrvl}'::text[]),
  ('Reliance Trends', 'shopping', '{reliancetrends,trendsfootwear}'::text[]),
  ('SBI', 'banks', '{}'::text[]),
  ('Shoppers Stop', 'shopping', '{shoppersstop}'::text[]),
  ('Skechers', 'shopping', '{skechers}'::text[]),
  ('Smart Bazaar', 'grocery', '{smartbazaar,reliancesmart}'::text[]),
  ('Snitch', 'shopping', '{snitch}'::text[]),
  ('Starbucks', 'food', '{starbucks,tatastarbucks}'::text[]),
  ('Sugar Cosmetics', 'personal', '{sugarcosmetics}'::text[]),
  ('Swiggy', 'food', '{swiggy}'::text[]),
  ('Swish', 'food', '{swish}'::text[]),
  ('Tanishq', 'shopping', '{tanishq}'::text[]),
  ('Tata 1mg', 'pharmacy', '{onemg,1mg}'::text[]),
  ('Tata CLiQ', 'shopping', '{tatacliq}'::text[]),
  ('The Souled Store', 'shopping', '{thesouledstore,souledstore}'::text[]),
  ('Titan', 'shopping', '{titan,titaneyeplus}'::text[]),
  ('Uber', 'rides', '{uber}'::text[]),
  ('Uniqlo', 'shopping', '{uniqlo}'::text[]),
  ('Urban Company', 'personal', '{urbancompany,urbanclap}'::text[]),
  ('Van Heusen', 'shopping', '{vanheusen}'::text[]),
  ('W for Woman', 'shopping', '{wforwoman}'::text[]),
  ('Wakefit', 'household', '{wakefit}'::text[]),
  ('Westside', 'shopping', '{westside,trentlimited}'::text[]),
  ('Woodland', 'shopping', '{woodland}'::text[]),
  ('Zara', 'shopping', '{zara}'::text[]),
  ('Zepto', 'food', '{zepto}'::text[]),
  ('Zomato', 'food', '{zomato}'::text[]),
  ('boAt', 'shopping', '{boatlifestyle,imaginemarketing}'::text[]),
  ('Groww', 'investments', '{groww}'::text[]),
  ('Zerodha', 'investments', '{zerodha,zerodhabroking}'::text[]),
  ('Upstox', 'investments', '{upstox}'::text[]),
  ('Angel One', 'investments', '{angelone,angelbroking}'::text[]),
  ('INDmoney', 'investments', '{indmoney}'::text[]),
  ('Paytm Money', 'investments', '{paytmmoney}'::text[]),
  ('Kuvera', 'investments', '{kuvera}'::text[]),
  ('ET Money', 'investments', '{etmoney}'::text[]),
  ('smallcase', 'investments', '{smallcase}'::text[]),
  ('Ola', 'rides', '{olacabs,olamoney,anitechnologies}'::text[]),
  ('IRCTC', 'travel', '{irctc}'::text[]),
  ('IndiGo', 'travel', '{goindigo,interglobe}'::text[]),
  ('Goibibo', 'travel', '{goibibo}'::text[]),
  ('Airbnb', 'stays', '{airbnb}'::text[]),
  ('OYO', 'stays', '{oyorooms,oravel}'::text[]);

-- "Zerodha Grow" mixed two companies. Groww keeps the row and its links.
UPDATE providers
SET canonical_name = 'Groww',
    aliases = ARRAY['Groww', 'Grow', 'Groww Invest'],
    sender_domains = ARRAY['groww.in'],
    website_domain = 'groww.in',
    logo_url = NULL
WHERE is_global = TRUE AND canonical_name = 'Zerodha Grow'
  AND NOT EXISTS (SELECT 1 FROM providers WHERE is_global = TRUE AND canonical_name = 'Groww');

INSERT INTO providers (user_id, canonical_name, aliases, upi_handles, sender_domains, website_domain, logo_url, category_slug, is_global)
SELECT NULL, v.name, v.aliases, c.handles, v.domains, v.site, NULL, c.category, TRUE
FROM (VALUES
  ('Groww', ARRAY['Groww', 'Grow', 'Groww Invest'], ARRAY['groww.in'], 'groww.in'),
  ('Zerodha', ARRAY['Zerodha', 'Zerodha Broking', 'Kite', 'Coin by Zerodha'], ARRAY['zerodha.com'], 'zerodha.com'),
  ('Upstox', ARRAY['Upstox', 'RKSV'], ARRAY['upstox.com'], 'upstox.com'),
  ('Angel One', ARRAY['Angel One', 'Angel Broking'], ARRAY['angelone.in'], 'angelone.in'),
  ('INDmoney', ARRAY['INDmoney', 'IND Money'], ARRAY['indmoney.com'], 'indmoney.com'),
  ('Paytm Money', ARRAY['Paytm Money'], ARRAY['paytmmoney.com'], 'paytmmoney.com'),
  ('Kuvera', ARRAY['Kuvera'], ARRAY['kuvera.in'], 'kuvera.in'),
  ('ET Money', ARRAY['ET Money', 'ETMoney'], ARRAY['etmoney.com'], 'etmoney.com'),
  ('smallcase', ARRAY['smallcase'], ARRAY['smallcase.com'], 'smallcase.com'),
  ('Ola', ARRAY['Ola', 'Ola Cabs', 'ANI Technologies'], ARRAY['olacabs.com'], 'olacabs.com'),
  ('IRCTC', ARRAY['IRCTC', 'Indian Railway Catering'], ARRAY['irctc.co.in'], 'irctc.co.in'),
  ('IndiGo', ARRAY['IndiGo', 'InterGlobe Aviation'], ARRAY['goindigo.in'], 'goindigo.in'),
  ('Goibibo', ARRAY['Goibibo', 'Ibibo'], ARRAY['goibibo.com'], 'goibibo.com'),
  ('Airbnb', ARRAY['Airbnb'], ARRAY['airbnb.com'], 'airbnb.co.in'),
  ('OYO', ARRAY['OYO', 'OYO Rooms', 'Oravel Stays'], ARRAY['oyorooms.com'], 'oyorooms.com')
) AS v(name, aliases, domains, site)
JOIN shared_catalog c ON c.name = v.name
WHERE NOT EXISTS (SELECT 1 FROM providers p WHERE p.is_global = TRUE AND lower(p.canonical_name) = lower(v.name));

-- Shared apps that are not public brands become private to the users who use them.
CREATE TEMP TABLE personal_globals AS
SELECT id FROM providers WHERE is_global = TRUE AND canonical_name IN ('Office Cafeteria');

-- Each user who has a payment or rule on a shared app that carries handles
-- outside the catalog (or on a personal shared app) gets their own copy.
-- Category changes on shared apps were never recorded per user. The one trace
-- left: approving a statement match stamped the app's category on that user's
-- own payments as a user override. Those users keep the changed category on
-- their copy; everyone else gets the catalog category back.
CREATE TEMP TABLE user_copies AS
WITH extra AS (
  SELECT p.id AS global_id, h AS handle
  FROM providers p
  CROSS JOIN LATERAL unnest(p.upi_handles) AS h
  LEFT JOIN shared_catalog c ON c.name = p.canonical_name
  WHERE p.is_global = TRUE
    AND (c.name IS NULL OR NOT (lower(h) = ANY (SELECT lower(x) FROM unnest(c.handles) x)))
),
users_on_app AS (
  SELECT DISTINCT t.user_id, t.provider_id AS global_id
  FROM transactions t
  WHERE t.provider_id IN (SELECT id FROM personal_globals)
     OR EXISTS (
       SELECT 1 FROM extra e
       WHERE e.global_id = t.provider_id
         AND t.upi_id IS NOT NULL
         AND position(lower(e.handle) IN lower(t.upi_id)) > 0
     )
  UNION
  SELECT DISTINCT r.user_id, r.set_provider_id
  FROM user_rules r
  WHERE r.set_provider_id IN (SELECT id FROM personal_globals)
  UNION
  SELECT DISTINCT t.user_id, t.provider_id
  FROM transactions t
  JOIN providers p ON p.id = t.provider_id AND p.is_global = TRUE
  JOIN shared_catalog c ON c.name = p.canonical_name
  WHERE p.category_slug IS DISTINCT FROM c.category
    AND t.classification_source = 'user_override'
    AND t.category_slug = p.category_slug
)
SELECT u.user_id,
       u.global_id,
       ARRAY(
         SELECT DISTINCT h FROM unnest(p.upi_handles) h
         WHERE p.id IN (SELECT id FROM personal_globals)
            OR lower(h) = ANY (SELECT lower(x) FROM unnest(c.handles) x)
            OR EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.user_id = u.user_id AND t.provider_id = p.id
                AND t.upi_id IS NOT NULL AND position(lower(h) IN lower(t.upi_id)) > 0
            )
       ) AS handles,
       CASE
         WHEN c.name IS NULL THEN p.category_slug
         WHEN p.category_slug IS DISTINCT FROM c.category AND EXISTS (
           SELECT 1 FROM transactions t
           WHERE t.user_id = u.user_id AND t.provider_id = p.id
             AND t.classification_source = 'user_override'
             AND t.category_slug = p.category_slug
         ) THEN p.category_slug
         ELSE c.category
       END AS category
FROM users_on_app u
JOIN providers p ON p.id = u.global_id
LEFT JOIN shared_catalog c ON c.name = p.canonical_name;

INSERT INTO providers (user_id, canonical_name, aliases, upi_handles, sender_domains, website_domain, logo_url, category_slug, is_global)
SELECT uc.user_id, p.canonical_name, p.aliases, uc.handles, p.sender_domains, p.website_domain, p.logo_url, uc.category, FALSE
FROM user_copies uc
JOIN providers p ON p.id = uc.global_id
WHERE NOT EXISTS (
  SELECT 1 FROM providers own
  WHERE own.is_global = FALSE AND own.user_id = uc.user_id
    AND lower(own.canonical_name) = lower(p.canonical_name)
);

-- A user who already had a copy keeps it, with the personal handles added.
UPDATE providers own
SET upi_handles = ARRAY(SELECT DISTINCT h FROM unnest(own.upi_handles || uc.handles) h)
FROM user_copies uc
JOIN providers p ON p.id = uc.global_id
WHERE own.is_global = FALSE AND own.user_id = uc.user_id
  AND lower(own.canonical_name) = lower(p.canonical_name);

UPDATE transactions t
SET provider_id = own.id
FROM user_copies uc
JOIN providers p ON p.id = uc.global_id
JOIN providers own ON own.is_global = FALSE AND own.user_id = uc.user_id
  AND lower(own.canonical_name) = lower(p.canonical_name)
WHERE t.user_id = uc.user_id AND t.provider_id = uc.global_id;

UPDATE user_rules r
SET set_provider_id = own.id
FROM user_copies uc
JOIN providers p ON p.id = uc.global_id
JOIN providers own ON own.is_global = FALSE AND own.user_id = uc.user_id
  AND lower(own.canonical_name) = lower(p.canonical_name)
WHERE r.user_id = uc.user_id AND r.set_provider_id = uc.global_id;

DELETE FROM providers WHERE id IN (SELECT id FROM personal_globals);

-- Shared apps go back to the catalog's handles and category.
UPDATE providers p
SET upi_handles = c.handles,
    category_slug = c.category
FROM shared_catalog c
WHERE p.is_global = TRUE AND p.canonical_name = c.name;

DROP TABLE user_copies;
DROP TABLE personal_globals;
DROP TABLE shared_catalog;
