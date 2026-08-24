import { useEffect } from 'react';

/** Absolute origin for canonical URLs. The apex redirects here permanently. */
export const SITE_ORIGIN = 'https://www.rebyuu.app';

/**
 * Maintains a single <link rel="canonical"> for the mounted route.
 *
 * `path` must be a root-relative path ("/browse", "/anime/anilist-21"); it is
 * resolved against SITE_ORIGIN so the tag is always absolute, which is what
 * Google expects and what makes it survive being read on a staging host.
 *
 * The tag is reused rather than recreated across route changes: this is a
 * single-page app, so appending a second one on every navigation would leave
 * the document with conflicting canonicals, which Google resolves by ignoring
 * all of them. On unmount the tag is removed only if this hook created it.
 */
export function useCanonical(path: string) {
  useEffect(() => {
    if (!path.startsWith('/')) return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const created = !link;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `${SITE_ORIGIN}${path}`;

    return () => {
      if (created) link?.remove();
    };
  }, [path]);
}
