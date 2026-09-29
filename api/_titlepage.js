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

import { animePath } from './_paths.js';

const MAX_DESCRIPTION = 160;

/** Below this many characters, a clipped synopsis is noise rather than a preview. */
const MIN_SYNOPSIS_TAIL = 30;

const stripTags = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "a, b & c" */
const joinList = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;

/** "a, b and c" — for prose. */
const joinWords = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/**
 * The streaming links safe to put in an href: http(s) only. The sync already
 * filters them; this holds for rows written before it did, or by anything else.
 */
export const streamingLinks = (row) =>
  (Array.isArray(row.streaming) ? row.streaming : []).filter((l) => l && l.site && /^https?:\/\//i.test(String(l.url || '')));

const hasStreaming = (row) => streamingLinks(row).length > 0;

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

/** Latin letters (with diacritics), digits, punctuation, symbols and spaces. */
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u;

/**
 * The language of a name, from its script, or null when the script does not
 * settle it. Kana is Japanese and Hangul is Korean; Han characters alone could
 * be Japanese or Chinese, and Latin text is in the page's own language.
 */
export function nameLang(name) {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(name)) return 'ja';
  if (/\p{Script=Hangul}/u.test(name)) return 'ko';
  return null;
}

/** At most this many synonyms are shown; AniList lists up to ~20 translations. */
const MAX_SYNONYMS = 3;

/**
 * Every other name the title is searched by: the romaji or English title
 * (whichever is not the one displayed), the native-script title, then up to
 * three Latin-script synonyms. People search "Sousou no Frieren" as often as
 * "Frieren: Beyond Journey's End", and a page that never says the former
 * cannot match it. Empty until the name columns are synced.
 */
export function otherNames(row) {
  const seen = new Set([String(row.title || '').trim().toLowerCase()]);
  const out = [];
  const add = (name) => {
    const clean = String(name || '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return false;
    seen.add(key);
    out.push(clean);
    return true;
  };
  add(row.title_romaji);
  add(row.title_english);
  add(row.title_native);
  let synonyms = 0;
  for (const name of row.synonyms || []) {
    if (synonyms === MAX_SYNONYMS) break;
    if (LATIN.test(name) && add(name)) synonyms++;
  }
  return out;
}

export function titleTag(row, { now = new Date() } = {}) {
  const name = String(row.title || 'Untitled');
  const base = row.year ? `${name} (${row.year})` : name;
  const parts =
    row.status === 'upcoming'
      ? ['Release Date', row.trailer ? 'Trailer' : null, 'Details']
      : nextEpisode(row, now)
        // "<title> next episode" is the search an airing show gets most.
        ? ['Next Episode', 'Reviews', hasStreaming(row) ? 'Where to Watch' : 'Ratings']
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
  // The first other name in Latin script, so a search by romaji matches too.
  const alias = otherNames(row).find((n) => LATIN.test(n));
  let sentence = `${name}${alias ? ` (${alias})` : ''} is ${article(words[0])} ${words.join(' ')}`;
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
  const services = [...new Set(streamingLinks(row).map((l) => l.site))].slice(0, 3);
  // Whole sentences, in priority order, while they fit; then as much of the
  // synopsis as is worth showing. A sentence cut off mid-list ("…Netflix and
  // Hu…") reads worse than one left out.
  let text = factSentence(row);
  for (const sentence of [services.length ? `Watch it on ${joinWords(services)}.` : null, scoreSentence(row, community)]) {
    if (sentence && text.length + 1 + sentence.length <= MAX_DESCRIPTION) text += ` ${sentence}`;
  }
  const synopsis = stripTags(row.description);
  const room = MAX_DESCRIPTION - text.length - 1;
  if (synopsis && room >= MIN_SYNOPSIS_TAIL) text += ` ${clip(synopsis, room)}`;
  return clip(text, MAX_DESCRIPTION);
}

// ── Follow-up answers ──────────────────────────────────────────────────
//
// The searches a title page can win are the title plus a question: where to
// watch it, when the next episode is out, whether it is finished, whether
// there is a season 2, who made it. These build the answers from the row, so
// the prerender and the React page say exactly the same thing — and only
// what the data backs. A question the data cannot answer is left out rather
// than answered with a guess ("no sequel announced" would go stale silently).

const FORMAT_LABEL = {
  TV: 'TV series',
  TV_SHORT: 'TV short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA (web series)',
  MUSIC: 'Music video',
};

const SOURCE_LABEL = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  VISUAL_NOVEL: 'Visual novel',
  VIDEO_GAME: 'Video game',
  NOVEL: 'Novel',
  WEB_NOVEL: 'Web novel',
  DOUJINSHI: 'Doujinshi',
  ANIME: 'Anime',
  LIVE_ACTION: 'Live action',
  GAME: 'Game',
  COMIC: 'Comic',
  MULTIMEDIA_PROJECT: 'Multimedia project',
  PICTURE_BOOK: 'Picture book',
};

const RELATION_LABEL = {
  PREQUEL: ['Prequel', 'Prequels'],
  SEQUEL: ['Sequel', 'Sequels'],
  PARENT: ['Main story', 'Main stories'],
  ALTERNATIVE: ['Alternative version', 'Alternative versions'],
  SPIN_OFF: ['Spin-off', 'Spin-offs'],
  SIDE_STORY: ['Side story', 'Side stories'],
};

/** Facts beyond year, status, episodes and genres, which the page already shows. */
export function titleFacts(row) {
  const facts = [];
  if (FORMAT_LABEL[row.format]) facts.push({ label: 'Format', value: FORMAT_LABEL[row.format] });
  if (row.season && row.year) facts.push({ label: 'Season', value: `${row.season} ${row.year}` });
  if (row.studios?.length) facts.push({ label: row.studios.length > 1 ? 'Studios' : 'Studio', value: row.studios.join(', ') });
  if (SOURCE_LABEL[row.source]) facts.push({ label: 'Source', value: SOURCE_LABEL[row.source] });
  if (row.duration) facts.push({ label: 'Episode length', value: `${row.duration} min` });
  return facts;
}

/** The next scheduled episode, or null once it has aired (the row lags a day). */
export function nextEpisode(row, now = new Date()) {
  if (!row.next_episode || !row.next_episode_at) return null;
  const at = new Date(row.next_episode_at);
  return Number.isFinite(at.getTime()) && at > now ? { episode: row.next_episode, at } : null;
}

/**
 * "Saturday 3 October 2026, 15:00 UTC". The prerender passes UTC; the browser
 * passes nothing and gets the reader's own zone.
 */
export function formatAiring(at, { timeZone } = {}) {
  const zone = timeZone ? { timeZone } : {};
  const date = new Intl.DateTimeFormat('en-GB', { ...zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(at)
    .replace(',', '');
  const time = new Intl.DateTimeFormat('en-GB', { ...zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  const name = timeZone === 'UTC'
    ? 'UTC'
    : new Intl.DateTimeFormat('en-GB', { ...zone, timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
  return `${date}, ${time}${name ? ` ${name}` : ''}`;
}

/**
 * Relations grouped under readable labels, in the order the sync stored them
 * (the watch order first). `known` maps ids in anime_index to their rows;
 * only those become links — the others are named but not linked, since their
 * page would be a 404.
 */
export function relationGroups(row, known = new Map()) {
  const groups = [];
  for (const rel of row.relations || []) {
    if (!RELATION_LABEL[rel.relation]) continue;
    let group = groups.find((g) => g.relation === rel.relation);
    if (!group) groups.push((group = { relation: rel.relation, items: [] }));
    const hit = known.get(rel.id);
    group.items.push({
      id: rel.id,
      title: hit?.title || rel.title || 'Untitled',
      year: rel.year ?? hit?.year ?? null,
      format: rel.format ?? null,
      path: hit ? animePath(hit) : null,
    });
  }
  return groups.map((g) => ({ ...g, label: RELATION_LABEL[g.relation][g.items.length > 1 ? 1 : 0] }));
}

/** Question-and-answer pairs the row can back. See the section comment above. */
export function quickAnswers(row, { now = new Date(), timeZone } = {}) {
  const name = String(row.title || 'Untitled');
  const next = nextEpisode(row, now);
  const out = [];

  if (row.status === 'airing') {
    if (next && next.episode > 1) {
      const aired = next.episode - 1;
      const verb = aired === 1 ? 'is' : 'are';
      const count = row.episodes ? `${aired} of ${row.episodes} episodes ${verb}` : `${aired} episode${aired === 1 ? '' : 's'} ${verb}`;
      out.push({ question: `How many episodes does ${name} have?`, answer: `${name} is still airing: ${count} out so far.` });
    }
  } else if (row.status !== 'upcoming' && row.episodes > 1) {
    const length = row.duration ? `, each about ${row.duration} minutes long` : '';
    out.push({ question: `How many episodes does ${name} have?`, answer: `${name} has ${row.episodes} episodes${length}.` });
  }

  if (row.status === 'completed') {
    out.push({ question: `Is ${name} finished?`, answer: `Yes. ${name} has finished airing.` });
  } else if (row.status === 'airing') {
    out.push({
      question: `Is ${name} finished?`,
      answer: next
        ? `No, it is still airing. Episode ${next.episode} airs on ${formatAiring(next.at, { timeZone })}.`
        : 'No, it is still airing.',
    });
  } else if (row.status === 'upcoming') {
    const when = next && next.episode === 1
      ? `${name} premieres on ${formatAiring(next.at, { timeZone })}.`
      : row.season && row.year
        ? `${name} is scheduled for ${row.season} ${row.year}.`
        : row.year
          ? `${name} is expected in ${row.year}.`
          : `${name} has not started airing.`;
    out.push({ question: `Is ${name} out yet?`, answer: `Not yet. ${when}` });
  }

  if (row.studios?.length) {
    const source = row.source === 'ORIGINAL'
      ? ', as an original story'
      : SOURCE_LABEL[row.source] && row.source !== 'OTHER'
        ? `, adapted from the ${SOURCE_LABEL[row.source].toLowerCase()}`
        : '';
    out.push({ question: `Who made ${name}?`, answer: `${name} was animated by ${joinWords(row.studios)}${source}.` });
  }

  const sequels = (row.relations || []).filter((r) => r.relation === 'SEQUEL' && r.title);
  if (sequels.length) {
    out.push({
      question: `Is there a sequel to ${name}?`,
      answer: `Yes: ${joinWords(sequels.map((r) => (r.year ? `${r.title} (${r.year})` : r.title)))}.`,
    });
  }

  return out;
}
