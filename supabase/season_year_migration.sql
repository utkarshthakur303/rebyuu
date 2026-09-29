-- The year of the season a title belongs to, as AniList files it.
--
-- AniList puts a December premiere in the next year's Winter season: a film
-- released in December 2023 is "Winter 2024". anime_index.year is the start
-- year (2023), so season + year alone would put that film in Winter 2023,
-- and its title page would link a season page that doesn't list it.
--
-- Safe to run on the live table: one new nullable column, no table rewrite.
-- The app reads `year` wherever this is still empty (seasonYearOf in
-- api/_catalog.js), and the sync checks for the column on its own, so
-- deploying before or after this runs changes nothing that works today.
--
-- After running it, backfill once: GitHub → Actions → "Sync anime catalogue"
-- → Run workflow → mode "full".

ALTER TABLE anime_index ADD COLUMN IF NOT EXISTS season_year INTEGER;
