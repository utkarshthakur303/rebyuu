import { SHELL } from './_shell.js';
import { ORIGIN, escapeHtml, truncate, renderTitleList, injectHead, injectBody } from './_html.js';
import { sb, anilist } from './_upstream.js';
import { animePath } from './_paths.js';
import { hubPath, hubPreset, hubNavLinks, genrePath } from './_hubs.js';
import { GENRES } from './_catalog.js';
import { hubTitle, hubHeading, hubDescription, hubListHeading, hubLinksLabel, hubIntro } from './_hubcopy.js';
import {
  HUB_PAGE_SIZE, servedLimit, hubQuery, readHubIds, readHubHasMore, readHubLinks,
  scheduleRange, scheduleQuery, readSchedule, scheduleTime, groupSchedule,
} from './_hubdata.js';
import { hubCountPath, isIndexable, hubFallbackPath } from './_hubdb.js';

/**
 * A hub page as served: its data (loadHub) and its HTML (renderHub). The
 * route itself — 404s, redirects, caching — is in render.js. The underscore
 * keeps Vercel from deploying this file as a function.
 */

/** The columns a poster card shows: what the served list reads and React is handed. */
export const LIST_COLUMNS = 'id,title,year,rating,genres,status,episodes,cover_image,description';

/** A row as React's first render needs it: the synopsis cut to what a card can show. */
export const bootItem = (row) => ({ ...row, description: row.description ? truncate(row.description, 300) : null });

/** The catalogue could not be read. The route answers 503. */
export class HubDataError extends Error {}

/** `ids`' rows in that order; titles the catalogue doesn't have are left out. Null if it can't be read. */
async function rowsInOrder(ids) {
  if (!ids.length) return [];
  const rows = await sb(`anime_index?id=in.(${ids.join(',')})&select=${LIST_COLUMNS}`);
  if (!Array.isArray(rows)) return null;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Everything a hub page shows. The list is AniList's ranking for the hub —
 * the one Browse fetches — hydrated from the catalogue; without AniList, the
 * catalogue's own. Throws HubDataError when the catalogue can't be read; an
 * empty `items` means the hub has nothing to show.
 */
export async function loadHub(hub, now = new Date()) {
  const [ranked, scheduleData] = await Promise.all([
    anilist(hubQuery(hub)),
    hub.kind === 'airing' ? anilist(scheduleQuery(scheduleRange(now))) : Promise.resolve(null),
  ]);
  const scheduled = scheduleData ? readSchedule(scheduleData) : [];
  const countPath = hubCountPath(hub, now);

  const [items, counted, scheduledRows] = await Promise.all([
    ranked
      ? rowsInOrder(readHubIds(ranked))
      : sb(hubFallbackPath(hub, { columns: LIST_COLUMNS, limit: servedLimit(hub) })),
    countPath ? sb(countPath) : Promise.resolve([]),
    scheduled.length
      ? sb(`anime_index?id=in.(${[...new Set(scheduled.map((e) => e.id))].join(',')})&select=id,title`)
      : Promise.resolve([]),
  ]);
  if (!Array.isArray(items) || !Array.isArray(counted)) throw new HubDataError('anime_index could not be read');

  // Episodes of titles the catalogue has, named as it names them: a link to
  // any other would be a link to a 404.
  const titles = new Map((Array.isArray(scheduledRows) ? scheduledRows : []).map((row) => [row.id, row.title]));
  return {
    items,
    hasMore: ranked ? readHubHasMore(ranked) : items.length > HUB_PAGE_SIZE,
    live: Boolean(ranked),
    indexable: isIndexable(hub, counted.length),
    links: readHubLinks(hub, ranked, now),
    schedule: scheduled.filter((e) => titles.has(e.id)).map((e) => ({ ...e, title: titles.get(e.id) })),
  };
}

/**
 * The hub pages every served page links — this season, next season, airing,
 * upcoming, top rated, and every genre — so a crawler that doesn't run the
 * app can reach each from any.
 */
export function renderHubLinks(now = new Date()) {
  const links = (list) => list.map((l) => `<a href="${escapeHtml(l.path)}">${escapeHtml(l.label)}</a>`).join(' · ');
  return `
      <section style="margin-top:36px">
        <h2 style="font-family:Anton,Impact,sans-serif;font-size:26px;line-height:1.1">Seasons and charts</h2>
        <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.9;margin-top:10px">${links(hubNavLinks(now))}</p>
        <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.9;margin-top:6px">Genres: ${links(GENRES.map((g) => ({ label: g, path: genrePath(g) })))}</p>
      </section>`;
}

const H2 = 'style="font-family:Anton,Impact,sans-serif;font-size:22px;margin-top:28px"';
const H3 = 'style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;font-weight:600;margin-top:14px"';
const P = 'style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:16px;line-height:1.7"';

function renderLinks(hub, links) {
  if (!links.length) return '';
  const label = hubLinksLabel(hub);
  return `
      <p ${P}>${escapeHtml(label)}: ${links.map((l) => `<a href="${escapeHtml(l.path)}">${escapeHtml(l.label)}</a>`).join(' · ')}</p>`;
}

/** The week's episodes by UTC day; React regroups them by the reader's own days. */
function renderSchedule(entries, now) {
  const days = groupSchedule(entries, { now, timeZone: 'UTC' }).filter((day) => day.entries.length);
  if (!days.length) return '';
  const row = (e) =>
    `<li><time datetime="${new Date(e.at).toISOString()}">${scheduleTime(e.at, 'UTC')} UTC</time> <a href="${escapeHtml(animePath(e))}">${escapeHtml(e.title)}</a> · Episode ${e.episode}</li>`;
  return `
      <section>
        <h2 ${H2}>This week's episodes</h2>
        ${days.map((day) => `<h3 ${H3}>${escapeHtml(day.label)}</h3>
        <ul ${P}>${day.entries.map(row).join('')}</ul>`).join('\n        ')}
      </section>`;
}

export function renderHub(hub, data, now = new Date()) {
  const { items, links, schedule, indexable } = data;
  const path = hubPath(hub);
  const url = `${ORIGIN}${path}`;
  const heading = hubHeading(hub, { sort: hubPreset(hub).sort, now });

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': `${url}#list`,
        url,
        name: heading,
        numberOfItems: items.length,
        itemListElement: items.map((row, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}${animePath(row)}`, name: row.title })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Rebyuu', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Browse', item: `${ORIGIN}/browse` },
          { '@type': 'ListItem', position: 3, name: heading, item: url },
        ],
      },
    ],
  };

  const content = `
    <main class="mx-auto max-w-3xl px-4 py-16">
      <h1 style="font-family:Anton,Impact,sans-serif;font-size:clamp(28px,6vw,44px);line-height:1">${escapeHtml(heading)}</h1>
      <p style="font-family:Outfit,ui-sans-serif,sans-serif;font-size:17px;line-height:1.7;margin-top:14px">${escapeHtml(hubIntro(hub, items, now))}</p>
      ${renderLinks(hub, links)}
      ${renderSchedule(schedule, now)}
      ${renderTitleList({ heading: hubListHeading(hub), items })}
      ${renderHubLinks(now)}
      <p ${P}><a href="/browse">Browse all anime</a> · <a href="/">Home</a></p>
    </main>`;

  const html = injectHead(SHELL, {
    title: hubTitle(hub, now),
    description: hubDescription(hub, now),
    canonical: url,
    // The first poster is the first card React paints: its LCP.
    image: items[0]?.cover_image || null,
    ld,
    robots: indexable ? null : 'noindex, follow',
  });
  // React's first render uses this instead of fetching the same page again
  // (readBootList in services/anime.ts): no skeletons between the served
  // page and React's.
  return injectBody(html, content, {
    list: {
      path,
      // Only AniList's ranking is the list React would show; without it, React fetches its own.
      items: data.live ? items.slice(0, HUB_PAGE_SIZE).map(bootItem) : null,
      hasMore: data.hasMore,
      live: data.live,
      indexable,
      links,
      schedule,
    },
  });
}
