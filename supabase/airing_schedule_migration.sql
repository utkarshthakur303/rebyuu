-- Each title's airing schedule: when every episode airs, past and future.
--
-- Episode pages use it to answer "<show> episode 8 release date" for any
-- scheduled episode, to say when an aired episode came out, and to spot a
-- skipped week ("is episode 5 delayed"). The next episode is worked out from
-- it when a page is served, so a page no longer shows a stale "next episode"
-- between an episode airing and the next daily sync (see api/_schedule.js).
--
-- [{ "episode": 8, "at": "2026-11-15T14:30:00.000Z" }], in episode order,
-- at most 40 entries (scripts/animeRow.mjs, mergeSchedule).
--
-- Safe to run on the live table: the column is new and defaulted, and ADD
-- COLUMN with a constant default does not rewrite the table on Postgres 11+.
-- The site and the sync work before and after it runs; until it does, pages
-- fall back to next_episode / next_episode_at and the sync skips the column.
--
-- After running it: GitHub → Actions → "Sync anime catalogue" → Run workflow
-- (mode "fresh" is enough — it covers every airing and upcoming title).

ALTER TABLE anime_index
  ADD COLUMN IF NOT EXISTS airing_schedule JSONB NOT NULL DEFAULT '[]'::jsonb;
