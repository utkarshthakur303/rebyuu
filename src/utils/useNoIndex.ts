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
 *
 * The served HTML now always carries a robots tag (the prerender's default is
 * max-image-preview:large), so this sets the existing tag rather than
 * deferring to it, and puts its previous value back on unmount. Deferring —
 * what this hook once did — meant a visitor who opened an indexable page and
 * then navigated to a noindex one kept the indexable value.
 */
export function useNoIndex(active: boolean = true) {
  useEffect(() => {
    if (!active) return;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !meta;
    const previous = meta?.content ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, follow';

    return () => {
      if (created) meta?.remove();
      else if (meta && previous != null) meta.content = previous;
    };
  }, [active]);
}
