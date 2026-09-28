/**
 * Turns one AniList `Media` record into an anime_index row.
 *
 * Lives outside syncAnime.ts so it can be tested: that script starts syncing
 * the moment it is imported.
 *
 * The base columns are mapped exactly as the sync always mapped them. The
 * detail columns (supabase/title_details_migration.sql) carry what a title
 * page needs to answer the searches people make with a title: every name it
 * goes by, where to stream it, when the next episode airs, its sequels and
 * prequels, and who made it.
 */

/** Added by title_details_migration.sql. Absent until that migration runs. */
export const DETAIL_COLUMNS = [
  'title_romaji', 'title_english', 'title_native', 'synonyms',
  'format', 'source', 'duration', 'studios', 'mal_id',
  'streaming', 'relations', 'next_episode', 'next_episode_at',
];

const STATUS = {
  RELEASING: 'airing',
  FINISHED: 'completed',
  NOT_YET_RELEASED: 'upcoming',
  CANCELLED: 'completed',
  HIATUS: 'airing',
};

const SEASON = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };

/**
 * Relations worth listing on a title page, in the order they are listed:
 * the watch order first, then the stories around it. Manga, novels, music
 * videos and "character appears in" links are left out.
 */
const RELATION_ORDER = ['PREQUEL', 'SEQUEL', 'PARENT', 'ALTERNATIVE', 'SPIN_OFF', 'SIDE_STORY'];

/** One Piece has ~140 side stories; a page lists the most recent few. */
const MAX_SIDE_RELATIONS = 8;
const SIDE_RELATIONS = new Set(['SPIN_OFF', 'SIDE_STORY']);

function streamingLinks(links) {
  const seen = new Set();
  const out = [];
  for (const link of links || []) {
    if (link?.type !== 'STREAMING' || !link.url || !link.site || seen.has(link.site)) continue;
    seen.add(link.site);
    out.push({ site: link.site, url: link.url });
  }
  return out;
}

function relatedEntries(relations) {
  const entries = (relations?.edges || [])
    .filter((e) => RELATION_ORDER.includes(e.relationType) && e.node?.type === 'ANIME' && e.node.format !== 'MUSIC')
    .map((e) => ({
      id: `anilist-${e.node.id}`,
      relation: e.relationType,
      title: e.node.title?.english || e.node.title?.romaji || null,
      year: e.node.startDate?.year ?? null,
      format: e.node.format ?? null,
    }));

  const main = entries.filter((e) => !SIDE_RELATIONS.has(e.relation));
  const side = entries
    .filter((e) => SIDE_RELATIONS.has(e.relation))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, MAX_SIDE_RELATIONS);

  const rank = (e) => RELATION_ORDER.indexOf(e.relation);
  return [
    ...main.sort((a, b) => rank(a) - rank(b) || (a.year ?? 0) - (b.year ?? 0)),
    ...side,
  ];
}

export function toRow(m, { details = true } = {}) {
  const row = {
    id: `anilist-${m.id}`,
    title: m.title.english || m.title.romaji,
    rating: m.averageScore ? m.averageScore / 10 : null,
    genres: m.genres,
    year: m.startDate.year,
    season: m.season ? SEASON[m.season] || null : null,
    status: STATUS[m.status] || 'completed',
    episodes: m.episodes,
    description: m.description?.replace(/<[^>]*>/g, '').substring(0, 1000) || null,
    cover_image: m.coverImage.large,
    banner_image: m.bannerImage,
    trailer: m.trailer?.site === 'youtube' && m.trailer?.id ? `https://www.youtube.com/watch?v=${m.trailer.id}` : null,
    anilist_id: m.id,
  };
  if (!details) return row;

  return {
    ...row,
    title_romaji: m.title.romaji ?? null,
    title_english: m.title.english ?? null,
    title_native: m.title.native ?? null,
    synonyms: (m.synonyms || []).filter(Boolean),
    format: m.format ?? null,
    source: m.source ?? null,
    duration: m.duration ?? null,
    studios: (m.studios?.nodes || []).map((n) => n.name).filter(Boolean),
    mal_id: m.idMal ?? null,
    streaming: streamingLinks(m.externalLinks),
    relations: relatedEntries(m.relations),
    next_episode: m.nextAiringEpisode?.episode ?? null,
    next_episode_at: m.nextAiringEpisode ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() : null,
  };
}
