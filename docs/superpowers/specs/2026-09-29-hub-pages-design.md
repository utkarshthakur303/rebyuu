# Hub pages: seasons, airing, upcoming, top rated, genres

Date: 2026-09-29 · Branch: `seo/hub-pages`

## Goal

Give the searches people make for *lists* of anime a page to land on:
"fall 2026 anime", "anime airing now", "anime schedule", "upcoming anime",
"top rated anime", "best anime of 2025", "best romance anime".

Success looks like:

- Each of those searches has one indexable Rebyuu URL with a matching title,
  a short intro, the list itself in the served HTML, and structured data.
- New seasons get their page on their own as soon as the nightly sync has
  enough shows for them. Nobody edits code or copy each season.
- Nothing is built twice: every hub page *is* the Browse page, set to a
  preset. Someone using Browse sees no change in how it behaves.

## Why the Browse filters don't already do this

Every filtered Browse URL (`/browse?season=Fall&year=2026`, …) is blocked
in `robots.txt` and canonicalised to `/browse`, deliberately: the filter
combinations add up to ~296,000 near-duplicate URLs. So Google knows only
one page, "Browse anime", listing trending titles. That stays as it is. The
hubs give a small, chosen set of filter views a real address instead of
opening the filter space up.

## The pages

| URL | Browse preset | Default order | Indexed when |
|---|---|---|---|
| `/seasons/fall-2026` (any season, any year) | season + season year | Most popular | ≥ 12 quality titles |
| `/airing` | status: airing | Trending | always |
| `/upcoming` | status: upcoming | Most popular | always |
| `/top` | none | Top rated | always |
| `/top/2025` (years up to the current one) | year | Top rated | ≥ 12 quality titles |
| `/genres/romance` (the 18 Browse genres) | one genre | Most popular | ≥ 12 quality titles |

"Quality titles" is the rule the title sitemap already uses: synopsis ≥ 130
characters, and rated ≥ 6, airing, or upcoming for this year or later. It
moves out of `api/sitemap.js` into a shared module so the sitemap and the
hubs use one definition.

Why these default orders:

- **Airing: Trending, Upcoming: Most popular.** These match the homepage
  rails, whose "View More" buttons will now open these pages. So "View More"
  still continues the same list.
- **Genres: Most popular, not Top rated.** Sorted by AniList score, Comedy,
  Action and Sci-Fi each open with a run of Gintama seasons. Sorting by
  popularity puts the best-known shows of the genre first.
- **Seasons: Most popular.** Upcoming shows have no score yet, and "most
  followed" is what people check at the start of a season.

### Titles, headings, descriptions

Built by one function each in `api/_hubs.js`, so the prerender and React
call the same code and cannot drift apart.

| Page | Title tag | H1 |
|---|---|---|
| Season, upcoming or current | `Fall 2026 Anime: Every New Show This Season · Rebyuu` | Fall 2026 Anime |
| Season, past | `Fall 2015 Anime: Every Show of the Season · Rebyuu` | Fall 2015 Anime |
| Airing | `Anime Airing Now & This Week's Episode Schedule · Rebyuu` | Anime Airing Now |
| Upcoming | `Upcoming Anime: The Most Anticipated New Shows · Rebyuu` | Upcoming Anime |
| Top | `Top Rated Anime of All Time · Rebyuu` | Top Rated Anime |
| Year, past | `Best Anime of 2025, Top Rated First · Rebyuu` | Best Anime of 2025 |
| Year, current | `Best Anime of 2026 So Far · Rebyuu` | Best Anime of 2026 So Far |
| Genre | `Best Romance Anime, Most Popular First · Rebyuu` | Best Romance Anime |

If a visitor changes the order on a page whose heading names one ("Best …"),
the H1 drops the claim ("Romance Anime", "Anime of 2025"). A heading never
describes an order the grid isn't showing.

Meta descriptions are fixed templates per page type, with no live data, for
example: "Every anime of the Fall 2026 season, most popular first. Open any
show for ratings, reviews and where to watch. Updated daily."

Intros are one to three sentences above the grid, short enough that on a
phone the grid still starts on the first screen:

- **Seasons**, generated from the list: when the season starts or started,
  the three most followed shows, and for current and past seasons the
  highest rated one with its AniList score. Every season page therefore has
  its own text, with no hand-written copy needed for new seasons.
- **Genres**: 18 short hand-written intros (Claude drafts them, you edit them
  in the PR), kept in one map in `api/_hubs.js`.
- **Top, year, airing, upcoming**: one or two sentences each, with the
  year pages filled in from their list the same way as the season pages.

### Extra section per page, above the grid

Each extra section is compact, so the grid stays close to the top.

- **Season:** links to the previous and next season, each only if AniList
  has shows in it, so a link never leads to a 404. The check rides in the
  same AniList request as the list.
- **Airing:** this week's episode schedule. A day picker defaults to today,
  and each row shows time, title and episode number, with episodes already
  out marked as aired. It shows 8 rows with a "Show all" button. The served
  HTML contains every day in full, grouped by UTC day. React regroups by
  the visitor's own time zone.
- **Upcoming:** links to each upcoming season that has shows, for example
  "Winter 2027 · Spring 2027". This is how new season pages become reachable
  the day they exist.
- **Top:** year links from the current year back to 1980.
- **Year:** links to that year's season pages, each only if it has shows
  (checked in the same request).
- **Genre:** links to the other 17 genre pages, in one row that scrolls
  sideways.

From the homepage, every season page is at most three clicks away:
`/` → `/top` → `/top/2015` → `/seasons/fall-2015`.

## How a hub relates to Browse

A hub is one route rendering the existing `BrowsePage` with a preset. There
is no second grid, second filter UI or second data path. Two additions go in
their own file, `HubHeader.tsx`: the heading and intro block, and the extra
sections. The airing schedule is its own component, since nothing like it
exists today.

Interaction rules, chosen so that nothing surprises someone using Browse:

1. **Browse never sends you to a hub.** Picking Fall + 2026 on `/browse`
   stays on `/browse?season=Fall&year=2026`, exactly as today. Otherwise an
   intro would appear and vanish as you toggled filters, and the grid would
   jump each time.
2. **On a hub, changing the order or the page keeps you on the hub**
   (`/seasons/fall-2026?sort=trending`). The one exception is `/top`:
   "top rated" is the order itself, so changing it opens Browse.
3. **On a hub, changing any filter opens Browse** with the resulting filters
   and the current order carried over. On Fall 2026, adding Action goes to
   `/browse?season=Fall&year=2026&genre=Action&sort=popularity`. Moving from
   one hub to another is done with the links in the extra sections, which
   are also the links Google follows.
4. **The order never changes unless you change it.** Moving between a hub
   and Browse always carries the current order over.
5. **No jumps.** Moving between a hub and Browse does not reset scroll:
   `ScrollToTop` skips navigations the page marks with `keepScroll`. It
   does not remount the page either, so the mobile filter drawer stays open
   while you pick several filters. Back and Forward work as they do in
   Browse today.
6. **Filters on a hub show as selected.** On Fall 2026, Fall and 2026 are
   highlighted, and "Clear" leads to plain Browse.

### No flash of skeletons

As on title pages, the prerender hands React the first page of the grid
(the fields a poster card shows, with the synopsis cut to 300 characters)
and the intro data in the `rebyuu-boot` script. React paints that and
skips its first fetch, so a visitor from Google never sees the list replaced
by skeletons. `/browse` itself gets the same handoff, since it is the same
code path. Later pages and order changes fetch live, as now.

## Server HTML (`api/render.js`)

New route `hub`, reached through `vercel.json` rewrites for each URL shape.

- **List source:** the same AniList query React runs for that preset, one
  request with aliased pages (up to 150 titles for a season, 100 for the
  others, plus the next-season check). The ids are then mapped to our rows,
  and ids missing from `anime_index` are dropped so no link leads to a 404.
  The served HTML contains the whole list, so every show in a season is
  linked from its season page. Its first 50 entries are exactly React's
  first page.
- **Head:** title, description and canonical (the bare hub path, for every
  query-string variant). Robots is `max-image-preview:large` when the page
  passes its index rule and `noindex, follow` when it doesn't. Structured
  data is `ItemList` + `BreadcrumbList`. The poster of the first entry is
  preloaded.
- **Caching:** `s-maxage=3600, stale-while-revalidate=86400`. `/airing` uses
  `s-maxage=900, stale-while-revalidate=3600` so the schedule stays current.
- **Failures:**
  - AniList down or slow: the list comes from our database instead, ordered
    by rating, the same fallback `/browse` uses.
  - Database down: 503 with `Retry-After`, never a thin 200.
  - Unknown genre, invalid season, a year after the current one, or a season
    with no shows: 404.
  - Wrong case or aliases (`/seasons/Autumn-2026`, `/genres/Sci-Fi`): 301 to
    the canonical form.

## Seasons appear on their own

- **`sitemap-hubs.xml`**, listed in the sitemap index, holds `/airing`,
  `/upcoming`, `/top` and every season, year and genre page that passes its
  index rule. It is computed hourly from one database pass over the quality
  titles, counting per season, year and genre. The same counting function
  decides a page's own robots tag. Consequences:
  - the sitemap never lists a page that says `noindex`;
  - a new season enters the sitemap the day it reaches 12 quality titles.
- The **footer** gains site-wide links: This season, Next season, Airing
  schedule and Upcoming in PR 1, then Top rated in PR 2 when `/top` exists.
  "This season" follows the calendar in UTC:
  January–March is Winter, April–June Spring, July–September Summer,
  October–December Fall. It switches automatically. Showing "Next season" as
  well covers the weeks before a season starts, when people are already
  searching for it.
- **`/upcoming`** links every upcoming season that has shows, as above.

## Links pointing at the hubs

- **Homepage:**
  - Airing "View More" goes to `/airing`, Upcoming "View More" to
    `/upcoming`, and the genre tiles to `/genres/<genre>`.
  - The trending and fan-favourite "View More" links stay as they are.
  - The served homepage HTML gains a short "Seasons & charts" link list.
- **Title pages, served and React:** the season fact links to its season
  page, and genre chips link to genre pages (only for the 18 genres Browse
  offers; Hentai never).
- **Served `/browse` HTML:** the same link list as the homepage.

## Data fixes that ship first

1. **Status that never goes stale.** 198 of 355 rows marked "airing" are
   out of date, such as *Blue Orchestra Season 2* (2025) and *Shoujo Ramune*
   (2016). The nightly "fresh" sync fetches only the shows airing right
   now, so a finished show is never seen again. After its usual passes, the
   sync will re-fetch, in batches of 50 ids, every row still marked airing
   or upcoming that it didn't see that night, and write them through the
   usual change-only path. Title pages ("Is it finished?"), `/airing`, and
   the sitemap's "airing counts as quality" rule all depend on this.
2. **`season_year`.** AniList puts a December premiere in the *next* year's
   Winter season. Our `year` is the start year, so a film released in
   December 2023 is stored as Winter 2023 while AniList lists it in Winter
   2024. Its title page would then link a season page that doesn't list it.
   The fix: a new nullable column `season_year` (migration
   `supabase/season_year_migration.sql`), filled from AniList's
   `seasonYear`. Wherever `season_year` is still empty the code uses `year`.
   The column is added to the sync's detail columns, so before the
   migration runs the sync behaves as it did before the first migration.
   `year` keeps meaning the start year everywhere else, which is also what
   Browse's year filter and the year pages use.

## Edge cases and how each is handled

- **Titles with a season but no year, or the other way round:** no season
  link.
- **Titles AniList knows but our table doesn't yet:** left out of the served
  list. React pages after the first show them from AniList, as Browse does
  today.
- **Adult titles:** every hub query sets `isAdult: false` and excludes
  Hentai, the same as Browse.
- **A season with 1–11 quality titles:** served with `noindex, follow` and
  kept out of the sitemap. It gets indexed automatically once it reaches 12.
- **A season with no titles:** 404.
- **Schedule:** several episodes of one show on the same day each get a row.
  Time zones are handled as described above. Shows on hiatus stay in the
  grid, but have no schedule rows because nothing is scheduled for them.
- **The current year's page** is labelled "so far". Years after the current
  one have no page (404), and Browse's year filter covers them.
- **AniList's result totals** change from page to page, so the code never
  uses them. Intros are built from the list itself, not from counts.
- **Title tags** stay under 60 characters for every season, year and genre.
  Tests check every one.

## Deliberately not in this work

- Genre × year or genre × season pages. The URL space grows fast, and they
  come after we see which hubs get impressions.
- Index pages for all seasons or all genres. The year, footer and
  other-genre links already make every hub reachable.
- Rebyuu's own rating averages on the hub lists. There are too few ratings
  yet, and the cards already show AniList's score.
- Opening the `/browse?…` filter space to crawlers.
- The year-by-year catalogue backfill past AniList's 5,000-result cap. That
  is a separate change.

## Testing

`node:test`, in the existing style:

- **`api/_hubs.js`:**
  - path ↔ preset in both directions, including aliases and case;
  - current and next season at every month boundary;
  - titles, headings and intros for every hub type, with lengths checked;
  - index rules;
  - schedule grouping across a time-zone boundary;
  - the navigation rules above (where a filter or order change leads from a
    hub).
- **Prerender for each hub:**
  - title, canonical and robots (indexed and not);
  - `ItemList`, links and the boot data;
  - AniList-failure fallback, 503 on a database error, 404s and 301s;
  - a variant URL canonicalising to its hub.
- **`sitemap-hubs.xml`:** agrees with each page's robots tag; 503 on a
  database error.
- **Sync:** stale airing and upcoming rows are re-fetched and flipped;
  `season_year` is written, and left out before the migration.
- **Browser (Playwright, local production build):**
  - the mobile filter drawer stays open across a hub → Browse filter change;
  - no scroll jump, and the order is kept;
  - Back and Forward work;
  - no skeleton flash on a direct load;
  - no console errors.

## Rollout

1. You run `supabase/season_year_migration.sql` in Supabase. It is additive
   and safe on the live table.
2. **PR 1:** the sync fixes, the shared hub code, and the season, `/airing`
   and `/upcoming` pages with their links (homepage, footer, title-page
   season link, served Browse HTML) and `sitemap-hubs.xml`. This ships
   first because the Fall 2026 season starts this week.
3. After it deploys, run the "Sync anime catalogue" action once in full
   mode. It backfills `season_year` and corrects the stale statuses.
4. **PR 2:** `/top`, `/top/:year` and the genre pages, the genre links
   (homepage tiles, title-page chips) and the "Top rated" footer link, and
   the genre intros for you to edit.
5. Both PRs are verified on the Vercel preview and again on production with
   the same checks as the title-page work.
