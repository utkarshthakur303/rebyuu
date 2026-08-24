import { useEffect } from 'react';
import { SITE_ORIGIN } from '@/utils/useCanonical';

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Per-route title, description and canonical, applied client-side.
 *
 * This is the browser half of the fix for C5, where ~22,000 URLs shared one
 * title and one description. It is enough for Googlebot, which renders
 * JavaScript — but it is NOT enough for the crawlers that do not, which is
 * every AI answer engine the site wants citations from. Those need the tags
 * present in the served HTML, which is the serverless prerender's job. The
 * two are deliberately kept consistent so a rendered page and a served page
 * never disagree.
 *
 * Titles are not suffixed automatically; callers pass the full string, so a
 * page that wants no brand suffix can say so.
 */
export function useSeo(opts: { title: string; description?: string; path?: string }) {
  const { title, description, path } = opts;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);

    if (path && path.startsWith('/')) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = `${SITE_ORIGIN}${path}`;
      upsertMeta('meta[property="og:url"]', 'property', 'og:url', `${SITE_ORIGIN}${path}`);
    }

    return () => {
      // Restore only the title. The meta tags are overwritten by whichever
      // route mounts next; removing them here would leave a window during
      // navigation where the document has no description at all.
      document.title = previousTitle;
    };
  }, [title, description, path]);
}
