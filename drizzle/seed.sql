-- Platform 初期データ（冪等 seed）。
-- slug をキーに ON CONFLICT DO NOTHING で何度流しても安全。
-- 適用例:
--   pnpm db:seed:local   (= wrangler d1 execute cheatdex --local  --file ./drizzle/seed.sql)
--   pnpm db:seed:remote  (= wrangler d1 execute cheatdex --remote --file ./drizzle/seed.sql)
INSERT INTO platform (slug, name, created_at)
VALUES ('ps2', 'PlayStation 2', unixepoch() * 1000)
ON CONFLICT(slug) DO NOTHING;
