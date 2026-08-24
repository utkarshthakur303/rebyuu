import { useEffect } from 'react';

/**
 * Adds <meta name="robots" content="noindex, follow"> for as long as the
 * calling component is mounted, then removes it again.
 *
 * Why this exists: vercel.json now 404s unknown *paths* at the edge, but it
 * cannot know whether a well-formed /anime/anilist-<n> URL corresponds to a
 * real row — only the app can, and only after fetching. Those URLs therefore
 * still resolve 200 with an empty view, which is the soft-404 pattern search
 * engines penalise. noindex is the signal that closes that gap.
 *
 * The removal on unmount matters: this is a single-page app, so a stale tag
 * left behind after client-side navigation would suppress a perfectly good
 * page. React runs the cleanup before the next route's effects, so a route
 * that sets the tag and one that does not can follow each other safely.
 *
 * `active` exists because callers decide this mid-render — AnimeDetailPage
 * only knows the row is missing after its fetch resolves, and it returns
 * early in that branch. Passing a flag keeps the hook call unconditional
 * and at the top level, which the rules of hooks require.
 */
export function useNoIndex(active: boolean = true) {
  useEffect(() => {
    if (!active) return;

    const existing = document.querySelector('meta[name="robots"]');
    // Something else already owns the tag — leave it alone rather than
    // fight over it, and do not remove it on the way out.
    if (existing) return;

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, follow';
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, [active]);
}
