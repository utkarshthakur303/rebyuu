# Attributions

Rebyuu is a discovery and review interface built on top of anime metadata it
does not own. Nearly every synopsis, score, genre tag and piece of cover art
in the catalogue of roughly 22,000 titles comes from a third party. This file
records who, and under what terms.

## Catalogue data

### AniList
Source of the catalogue itself: titles, synopses, genre tags, season and year,
airing status, episode counts, cover art and banner art. Fetched through the
[AniList GraphQL API](https://anilist.co/graphiql) at `graphql.anilist.co`,
both at build time (`scripts/syncAnime.ts`, which populates `anime_index`)
and live in the browser for the trending, popular, airing and upcoming rails.

Synopsis text is AniList's, reproduced with HTML stripped and otherwise
unaltered. Where AniList's own text carries an embedded source note — for
example `(Source: Crunchyroll)` or `(Source: VIZ Media)` — that note is part
of the reproduced text and refers to AniList's upstream, not to Rebyuu.

Cover and banner images are served directly from AniList's CDN
(`s4.anilist.co`). They are not copied, mirrored or re-hosted.

### MyAnimeList, via Jikan
Source of the numeric score shown on title pages. Read through the
[Jikan API](https://jikan.moe) at `api.jikan.moe`, an unofficial, community-
maintained read-only wrapper around MyAnimeList. Jikan is not affiliated with
MyAnimeList, and neither is Rebyuu.

A score displayed on a Rebyuu page is MyAnimeList's aggregate of MyAnimeList
users' votes. It is not Rebyuu's rating of the title and is deliberately not
marked up as this page's `aggregateRating` in structured data — doing so
would present another platform's community verdict as our own.

### Underlying rights
Cover art, promotional art and trailers remain the property of their
respective studios, licensors and publishers. Trailers are embedded from
YouTube and play from YouTube's servers.

## What is Rebyuu's own

To be clear about the boundary, the following is first-party: the interface
and its design system, the discovery and filtering logic, the live-updated
trending and airing rails, and any rating or review submitted by a Rebyuu
account holder. User-submitted reviews belong to the accounts that wrote them.

## Software

- [shadcn/ui](https://ui.shadcn.com/) — component primitives, under the
  [MIT licence](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
- [Radix UI](https://www.radix-ui.com/) — unstyled accessible primitives
  underneath shadcn/ui, MIT licence.
- [Lucide](https://lucide.dev/) — icon set, ISC licence.
- Typefaces served by Google Fonts: [Anton](https://fonts.google.com/specimen/Anton),
  [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) and
  [Outfit](https://fonts.google.com/specimen/Outfit), all under the
  SIL Open Font Licence 1.1.

## Corrections

If you hold rights to something surfaced here and want it credited
differently or removed, open an issue on this repository.

---

Previous versions of this file credited Unsplash and Figma. Neither supplies
anything the site actually serves — they were boilerplate left over from the
original Figma Make export, while the three sources the catalogue genuinely
depends on went uncredited.
