/**
 * Title, description and heading copy for the routes that are neither the
 * homepage nor a title page.
 *
 * Shared by the prerender (api/render.js), which serves it in the HTML, and
 * by the React pages, which set the same values with useSeo and render the
 * same headings — so a served page and a rendered page cannot disagree about
 * what they are called. The underscore keeps Vercel from deploying this file
 * as a function.
 */

export const PAGES = {
  browse: {
    path: '/browse',
    title: 'Browse anime: trending, top rated and airing now · Rebyuu',
    description:
      'Browse and search roughly 22,000 anime. Filter by genre, season, year and airing status, and sort by trending, popularity, fan favorites or score.',
    heading: 'Browse Anime',
  },
  about: {
    path: '/about',
    title: 'About Rebyuu — what this is, and where the data comes from',
    description:
      'Rebyuu is an anime discovery and review site built on AniList and MyAnimeList data. What is ours, what is theirs, and how the scores work.',
    eyebrow: 'Colophon',
    heading: 'About Rebyuu',
    standfirst:
      'An anime discovery and review site built on top of open catalogue data. This page explains exactly which parts are ours and which are borrowed, because that distinction matters more here than on most sites.',
    updated: '28 September 2026',
  },
  terms: {
    path: '/terms',
    title: 'Terms of Service — Rebyuu',
    description:
      'The terms you agree to by using Rebyuu: what you may do, what you own, and what we do not guarantee.',
    eyebrow: 'Legal',
    heading: 'Terms of Service',
    standfirst: 'Plain terms for a small site. Using Rebyuu means agreeing to these.',
    updated: '24 August 2026',
  },
  privacy: {
    path: '/privacy',
    title: 'Privacy Policy — Rebyuu',
    description:
      'What Rebyuu stores, who it is shared with, and how to delete it. Written to describe what the application actually does.',
    eyebrow: 'Legal',
    heading: 'Privacy Policy',
    standfirst:
      'Written to describe what this application actually does, rather than to cover every conceivable thing it might one day do.',
    updated: '24 August 2026',
  },
};
