import { animePath } from './_paths.js';

/**
 * Building blocks of every served page: escaping, the head tags a route
 * injects into the shell, the markup it puts in #root, and the plain title
 * lists crawlers follow. The underscore keeps Vercel from deploying this
 * file as a function.
 */

export const ORIGIN = 'https://www.rebyuu.app';

export const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** AniList synopses carry HTML. Strip it, collapse whitespace, keep the words. */
export const stripTags = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const truncate = (s, n) => {
  const t = stripTags(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
};

/**
 * JSON-LD is injected inside a <script> tag, so the one character that must
 * never survive is the sequence that could close it early.
 */
export const jsonLd = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** A heading plus a plain ordered list of title links. Empty rails render nothing. */
export function renderTitleList({ heading, subtitle, items }) {
  if (!items.length) return '';
  const lis = items
    .map((row) =>
      `<li><a href="${escapeHtml(animePath(row))}">${escapeHtml(row.title || 'Untitled')}</a>${row.year ? ` <span style="opacity:.6">(${escapeHtml(String(row.year))})</span>` : ''}</li>`
    )
    .join('\n          ');
  return `
      <section style="margin-top:36px">
        <h2 style="font-family:Anton,Impact,sans-serif;font-size:26px;line-height:1.1">${escapeHtml(heading)}</h2>
        ${subtitle ? `<p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase;opacity:.6;margin-top:4px">${escapeHtml(subtitle)}</p>` : ''}
        <ol style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.9;margin-top:10px;padding-left:1.4em">
          ${lis}
        </ol>
      </section>`;
}

/**
 * Every indexable page allows large image previews: without this directive
 * Google shows at most a thumbnail, and in Discover — a large source of anime
 * traffic — a thumbnail-only card barely gets shown at all. Pages that set
 * their own robots value (noindex) replace it.
 */
export const DEFAULT_ROBOTS = 'max-image-preview:large';

/** Replaces the shell's single shared title/description with this route's. */
export function injectHead(html, { title, description, canonical, image, preload = image, ld, robots }) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Rebyuu" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  // Lets the browser start the LCP fetch during head parse, before the
  // bundle has run — impossible while the URL was only knowable in JS.
  // `preload` is the image the page paints first, which is not always the
  // share image: a title page shares its poster but paints its banner.
  if (preload) tags.push(`<link rel="preload" as="image" href="${escapeHtml(preload)}" fetchpriority="high" />`);
  tags.push(`<meta name="robots" content="${escapeHtml(robots || DEFAULT_ROBOTS)}" />`);
  if (ld) tags.push(`<script type="application/ld+json">${jsonLd(ld)}</script>`);

  // Drop the shell's generic tags so the document never carries two of any.
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:title"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:description"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:title"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:description"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:card"[^>]*>/gi, '');

  return out.replace('</head>', `${tags.join('\n    ')}\n  </head>`);
}

/**
 * Injected into #root. React clears this on mount. `boot` is data the page
 * was built from, handed to React after #root so its first render can use it
 * instead of fetching it again (see takeBoot in services/anime.ts).
 */
export function injectBody(html, content, boot = null) {
  const data = boot ? `\n    <script id="rebyuu-boot" type="application/json">${jsonLd(boot)}</script>` : '';
  return html
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`)
    .replace('</body>', `${data}\n  </body>`);
}
