-- ═══════════════════════════════════════════════════════════════════════════
-- RLS HARDENING
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Context
--   schema.sql declares `alter table ... enable row level security` for these
--   tables, but a live anon-key write to anime_index succeeded (HTTP 200,
--   updated_at changed) while only a SELECT policy exists. With RLS genuinely
--   enabled and no write policy, that write must be denied — so RLS was not
--   actually on. Policies are inert while RLS is off.
--
--   The anon key is public by design. It ships in the client bundle at
--   www.rebyuu.app and has been in this public repo since the initial commit,
--   so "the key is secret" is never the control. RLS is.
--
--   service_role bypasses RLS in Supabase, so scripts/syncAnime.ts keeps
--   working once it runs with SUPABASE_SERVICE_ROLE_KEY.
--
-- How to run
--   Steps are ordered and NOT idempotent as a whole. Run STEP 1 alone, read
--   the output, then run STEP 2. Steps 1, 3 and 4 are commented out on
--   purpose so that executing this file top-to-bottom cannot fire them
--   out of order — uncomment or copy the block you actually want.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1 — Diagnose. Run this alone first and read the output.
-- ───────────────────────────────────────────────────────────────────────────
-- Any row with rls_enabled = false is currently open to anyone holding the
-- public anon key. policy_count is informational: policies do nothing at all
-- while rls_enabled is false.
--
-- select c.relname        as table_name,
--        c.relrowsecurity as rls_enabled,
--        (
--          select count(*)
--          from pg_policies p
--          where p.schemaname = 'public'
--            and p.tablename  = c.relname
--        )                as policy_count
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relkind = 'r'
-- order by c.relrowsecurity asc,
--          c.relname;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2 — anime_index: public catalogue, read-only to the world.
-- ───────────────────────────────────────────────────────────────────────────
-- This is the safe-to-run-now section.

alter table public.anime_index enable row level security;

-- Recreated idempotently; unchanged in behaviour from the existing policy.
drop policy if exists "Public read anime_index" on public.anime_index;

create policy "Public read anime_index"
    on public.anime_index
    for select
    to anon, authenticated
    using (true);

-- Defence in depth: with RLS on and no write policy these are already refused,
-- but revoking the grants removes the privilege as well as the row access.
-- Safe because the app never writes here — it only issues selects. The sync
-- script is the sole writer and runs as service_role.
revoke insert, update, delete
    on public.anime_index
    from anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3 — Only if STEP 1 shows rls_enabled = false on these.
-- ───────────────────────────────────────────────────────────────────────────
-- These hold user data. If RLS is off, anyone holding the public anon key can
-- read and modify every row, including other people's.
--
-- ⚠  Verify each table has the policies it needs BEFORE enabling, or
--    legitimate access will break the moment RLS switches on.
--
-- alter table public.users            enable row level security;
-- alter table public.ratings          enable row level security;
-- alter table public.comments         enable row level security;
-- alter table public.lists            enable row level security;
-- alter table public.list_items       enable row level security;
-- alter table public.reports          enable row level security;
-- alter table public.episode_ratings  enable row level security;
-- alter table public.episode_comments enable row level security;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4 — Verify the lock actually took.
-- ───────────────────────────────────────────────────────────────────────────
-- 4a. Confirm the flag flipped in the catalogue:
--
-- select c.relname        as table_name,
--        c.relrowsecurity as rls_enabled
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname = 'anime_index';
--
-- 4b. Confirm from the outside. This must now FAIL, not return 200:
--
-- curl -X POST "$VITE_SUPABASE_URL/rest/v1/anime_index" \
--   -H "apikey: $ANON_KEY" \
--   -H "Authorization: Bearer $ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -H "Prefer: resolution=merge-duplicates" \
--   -d '[{"id":"anilist-16498","title":"pwned"}]'
