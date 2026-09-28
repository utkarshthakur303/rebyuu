/**
 * The <title> and meta description of a title page, built from its data.
 *
 * Shared by the prerender (api/render.js) and the React detail page, so the
 * served head and the one React sets on client-side navigation agree. The
 * underscore keeps Vercel from deploying this file as a function.
 *
 * Why build them rather than reuse the synopsis: the queries a title page can
 * realistically win are the title plus a modifier — "review", "rating",
 * "where to watch", "release date" — so the title names the ones the page
 * really answers, and only those. And the synopsis is AniList's text, word
 * for word on hundreds of sites; a description that opens with its own
 * sentence of facts is the one line in a result that is Rebyuu's.
 */

const MAX_DESCRIPTION = 160;

const stripTags = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "a, b & c" */
const joinList = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const hasStreaming = (row) => Array.isArray(row.streaming) && row.streaming.length > 0;

/** What the title is, in words: film, special, series, or just anime. */
function kindOf(row) {
  switch (row.format) {
    case 'MOVIE': return 'anime film';
    case 'OVA': return 'OVA';
    case 'SPECIAL': return 'anime special';
    case 'MUSIC': return 'anime music video';
    case 'TV':
    case 'TV_SHORT':
    case 'ONA': return 'anime series';
    default:
      return row.episodes > 1 || row.status === 'airing' ? 'anime series' : 'anime';
  }
}

export function titleTag(row) {
  const name = String(row.title || 'Untitled');
  const base = row.year ? `${name} (${row.year})` : name;
  const parts =
    row.status === 'upcoming'
      ? ['Release Date', row.trailer ? 'Trailer' : null, 'Details']
      : ['Reviews', 'Ratings', hasStreaming(row) ? 'Where to Watch' : null];
  return `${base} — ${joinList(parts.filter(Boolean))} · Rebyuu`;
}

/** "Frieren is a 2023 adventure and drama anime series with 28 episodes." */
function factSentence(row) {
  const name = String(row.title || 'Untitled');
  const genres = (row.genres || []).slice(0, 2).map((g) => g.toLowerCase()).join(' and ');
  const words = [
    row.status === 'upcoming' ? 'upcoming' : null,
    row.year ? String(row.year) : null,
    genres || null,
    kindOf(row),
  ].filter(Boolean);
  let sentence = `${name} is ${article(words[0])} ${words.join(' ')}`;
  if (row.episodes > 1) sentence += ` with ${row.episodes} episodes`;
  if (row.status === 'airing') sentence += ', currently airing';
  return `${sentence}.`;
}

/** The first-party score when there is one, else AniList's, else nothing. */
function scoreSentence(row, community) {
  if (community) return `Rebyuu users rate it ${Number(community.average).toFixed(1)}/10.`;
  if (row.rating != null) return `Rated ${Number(row.rating).toFixed(1)}/10 by AniList users.`;
  return null;
}

function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
}

/**
 * `community` is Rebyuu's own score, passed only once it has enough ratings
 * to publish (MIN_RATINGS_FOR_SCORE in render.js).
 */
export function metaDescription(row, { community = null } = {}) {
  const parts = [factSentence(row), scoreSentence(row, community), stripTags(row.description) || null];
  return clip(parts.filter(Boolean).join(' '), MAX_DESCRIPTION);
}
