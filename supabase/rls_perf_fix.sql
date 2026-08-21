-- ═══════════════════════════════════════════════════════════════════════════
-- RLS PERFORMANCE FIX — wrap auth.<fn>() in a scalar subquery
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Postgres treats a bare auth.uid() in a policy as volatile per row, so it is
-- re-evaluated once for every row scanned. Wrapping it as (select auth.uid())
-- turns it into an InitPlan: evaluated once per statement and reused.
--
-- The rewrite is SEMANTICALLY IDENTICAL. Same rows in, same rows out — this
-- only changes how often the expression is computed. No policy is loosened.
--
-- The linter flagged "Users can insert own data", but every policy below has
-- the same shape, so they are all corrected here.
--
-- BEFORE RUNNING
--   schema.sql has already proven unreliable as a record of live state (it
--   declared RLS enabled on anime_index while production had it off), so
--   confirm what actually exists first:
--
--     select tablename, policyname, cmd, qual, with_check
--     from pg_policies
--     where schemaname = 'public'
--     order by tablename, policyname;
--
--   If a live policy differs from what is written here, fix the live one —
--   do not blindly apply this file over it.
--
-- AFTER RUNNING
--   Exercise the auth paths: sign in, post a rating, post a comment, create a
--   list, edit your profile. A policy typo surfaces as a silent empty result
--   or a permission error, not as a failed migration.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── users ──────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own data" on public.users;
create policy "Users can insert own data"
    on public.users for insert to authenticated
    with check ((select auth.uid()) = id);

drop policy if exists "Users can update own data" on public.users;
create policy "Users can update own data"
    on public.users for update to authenticated
    using ((select auth.uid()) = id);

-- Profiles are deliberately world-readable, and must stay that way:
-- getAnimeReviews joins users to render each review author's username and
-- avatar, for logged-out visitors too. Restricting this to `auth.uid() = id`
-- would blank out every author name on the site.
--
-- The old name ("Users can read own data") and its dead `auth.uid() = id OR`
-- prefix both implied a restriction that never applied — the `OR true` made
-- the predicate unconditionally true. Renamed and simplified so the intent is
-- legible; the effective permission is unchanged.
--
-- Exposed columns are id, username, bio, avatar_url and timestamps. Emails and
-- credentials live in auth.users, which is a separate, protected schema.
drop policy if exists "Users can read own data" on public.users;
drop policy if exists "Public read profiles" on public.users;
create policy "Public read profiles"
    on public.users for select
    using (true);


-- ── ratings ────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own ratings" on public.ratings;
create policy "Users can insert own ratings"
    on public.ratings for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own ratings" on public.ratings;
create policy "Users can update own ratings"
    on public.ratings for update to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own ratings" on public.ratings;
create policy "Users can delete own ratings"
    on public.ratings for delete to authenticated
    using ((select auth.uid()) = user_id);


-- ── comments ───────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own comments" on public.comments;
create policy "Users can insert own comments"
    on public.comments for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own comments" on public.comments;
create policy "Users can update own comments"
    on public.comments for update to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own comments" on public.comments;
create policy "Users can delete own comments"
    on public.comments for delete to authenticated
    using ((select auth.uid()) = user_id);


-- ── lists ──────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own lists" on public.lists;
create policy "Users can insert own lists"
    on public.lists for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own lists" on public.lists;
create policy "Users can update own lists"
    on public.lists for update to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own lists" on public.lists;
create policy "Users can delete own lists"
    on public.lists for delete to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own lists or public lists" on public.lists;
create policy "Users can read own lists or public lists"
    on public.lists for select
    using ((select auth.uid()) = user_id OR is_private = false);


-- ── reports ────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own reports" on public.reports;
create policy "Users can insert own reports"
    on public.reports for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own reports" on public.reports;
create policy "Users can read own reports"
    on public.reports for select to authenticated
    using ((select auth.uid()) = user_id);


-- ── episode_ratings ────────────────────────────────────────────────────────
drop policy if exists "Users can insert own episode ratings" on public.episode_ratings;
create policy "Users can insert own episode ratings"
    on public.episode_ratings for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own episode ratings" on public.episode_ratings;
create policy "Users can update own episode ratings"
    on public.episode_ratings for update to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own episode ratings" on public.episode_ratings;
create policy "Users can delete own episode ratings"
    on public.episode_ratings for delete to authenticated
    using ((select auth.uid()) = user_id);


-- ── episode_comments ───────────────────────────────────────────────────────
drop policy if exists "Users can insert own episode comments" on public.episode_comments;
create policy "Users can insert own episode comments"
    on public.episode_comments for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own episode comments" on public.episode_comments;
create policy "Users can update own episode comments"
    on public.episode_comments for update to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own episode comments" on public.episode_comments;
create policy "Users can delete own episode comments"
    on public.episode_comments for delete to authenticated
    using ((select auth.uid()) = user_id);


-- ── Verify: no policy should still contain a bare auth.<fn>() call ─────────
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and (qual ~ '(^|[^(])auth\.(uid|role|jwt)\(\)'
--     or with_check ~ '(^|[^(])auth\.(uid|role|jwt)\(\)')
-- order by tablename;
