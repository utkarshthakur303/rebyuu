-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN ROLE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Context
--   /admin had no guard of any kind and was linked from the navbar and footer
--   on every page, so a signed-out visitor could open the moderation panel and
--   read the comment queue (schema.sql:94 makes comments public-read). The app
--   now gates /admin on `users.is_admin`, but the users table has no such
--   column — id, username, bio, avatar_url, created_at, updated_at only.
--
--   The client check fails closed: with this column absent the lookup errors,
--   AdminRoute reads that as "not an admin", and nobody reaches /admin. That
--   is the safe direction, but it also means YOU cannot reach it until you run
--   STEP 1 and STEP 2 below.
--
--   A client-side flag only hides UI. Anyone can call the REST API directly
--   with the public anon key, so it is not a security control on its own —
--   STEP 3 is what actually protects the data.
--
-- How to run
--   Supabase dashboard → SQL Editor. Run STEP 1 and STEP 2, then verify. Read
--   the note on STEP 3 before running it; it grants real moderation power.

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1 — the column
-- ───────────────────────────────────────────────────────────────────────────
-- Defaults to false, so every existing row becomes a non-admin. Idempotent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- `Public read profiles` (schema.sql:108) is USING (true), so is_admin is
-- world-readable. That is acceptable — knowing who moderates grants nothing —
-- but be aware it is public, not private, information.
--
-- No UPDATE policy is added for is_admin, and `Users can update own data`
-- (schema.sql:103) is USING (auth.uid() = id) with no column restriction.
-- That means a user CAN currently set their own is_admin to true through the
-- API. STEP 4 closes that hole and is not optional.

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2 — make yourself an admin
-- ───────────────────────────────────────────────────────────────────────────
-- Replace the address with the account you sign in with, then run it.

UPDATE users
SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');

-- Verify: expect exactly the rows you intended, and no others.
--   SELECT u.username, au.email, u.is_admin
--   FROM users u JOIN auth.users au ON au.id = u.id
--   WHERE u.is_admin;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4 — stop users promoting themselves  (run this; it is not optional)
-- ───────────────────────────────────────────────────────────────────────────
-- Numbered 4 because it must be applied before STEP 3 matters. `Users can
-- update own data` (schema.sql:103) is USING (auth.uid() = id) with no column
-- restriction, so a user can PATCH their own is_admin to true through the REST
-- API. This revokes that ability, leaving the SQL editor as the only place an
-- admin can be created.

-- Column privileges are checked independently of RLS and cannot recurse, which
-- makes them a cleaner fit here than rewriting the row policy. `Users can
-- update own data` stays exactly as it is; the API simply loses permission to
-- write this one column.
--
-- The grant list is the set of columns the app actually updates
-- (ProfilePage.tsx:162 writes bio and avatar_url). Add to it if the profile
-- editor grows, but never add is_admin.

REVOKE UPDATE ON users FROM anon, authenticated;

GRANT UPDATE (username, bio, avatar_url, updated_at) ON users TO authenticated;

-- Verify: this must fail with "permission denied for column is_admin" when run
-- as a normal signed-in user against the REST API.
--   PATCH /rest/v1/users?id=eq.<your-uuid>   {"is_admin": true}
--
-- service_role keeps full access, so scripts/syncAnime.ts is unaffected.

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3 — let admins actually moderate  (read before running)
-- ───────────────────────────────────────────────────────────────────────────
-- AdminPage deletes comments (AdminPage.tsx:60), but the only DELETE policy on
-- comments is `auth.uid() = user_id` (schema.sql:117) — so today an admin can
-- only delete their OWN comments and the panel does nothing useful. This adds
-- the policy that makes moderation real.
--
-- Consequence: an is_admin account can permanently delete any user's comment.
-- Do not run this until STEP 4 is applied, or a user could promote themselves
-- and then delete other people's content.

CREATE POLICY "Admins can delete any comment" ON comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid()) AND u.is_admin
    )
  );

-- The same gap exists on episode_comments if the panel grows to cover them.
-- Left out deliberately: add it when the UI needs it, not before.
