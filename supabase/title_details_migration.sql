-- Title-page details for search.
--
-- Adds, per title: every name it is searched by (romaji, English, native
-- script, synonyms), and the follow-up facts people search a title with —
-- where to stream it, when the next episode airs, its sequels and prequels,
-- its studio, source material, format and episode length.
--
-- Safe to run on the live table: every column is new, nullable or defaulted,
-- and ADD COLUMN with a constant default does not rewrite the table on
-- Postgres 11+. The app and the nightly sync work both before and after this
-- runs; until it does, the sync keeps writing only the original columns.
--
-- After running it, backfill once: GitHub → Actions → "Sync anime catalogue"
-- → Run workflow → mode "full". The nightly "fresh" run keeps airing and
-- trending titles current from then on.

ALTER TABLE anime_index
  ADD COLUMN IF NOT EXISTS title_romaji TEXT,
  ADD COLUMN IF NOT EXISTS title_english TEXT,
  ADD COLUMN IF NOT EXISTS title_native TEXT,
  ADD COLUMN IF NOT EXISTS synonyms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS duration INTEGER,
  ADD COLUMN IF NOT EXISTS studios TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mal_id INTEGER,
  -- [{ "site": "Crunchyroll", "url": "https://…" }]
  ADD COLUMN IF NOT EXISTS streaming JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "id": "anilist-182255", "relation": "SEQUEL", "title": "…", "year": 2026, "format": "TV" }]
  ADD COLUMN IF NOT EXISTS relations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_episode INTEGER,
  ADD COLUMN IF NOT EXISTS next_episode_at TIMESTAMPTZ;
