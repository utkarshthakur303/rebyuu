import { SEASONS } from './_catalog.js';
import { seasonTense } from './_hubs.js';

/**
 * The words on a hub page: its title tag, heading, description and intro.
 *
 * Built here and nowhere else, so the prerender and the React app say the
 * same thing. Descriptions are fixed per page type and promise only what the
 * page shows. Intros are built from the page's own list, which is what gives
 * every season page — including the ones created on their own as seasons
 * are announced — text of its own. The underscore keeps Vercel from
 * deploying this file as a function.
 */

/** The month each season starts in, in SEASONS order. */
const FIRST_MONTH = ['January', 'April', 'July', 'October'];

const seasonName = (hub) => `${hub.season} ${hub.year}`;
const isThisYear = (hub, now) => hub.year === now.getUTCFullYear();

/** Orders that rank by merit, under which a "Best …" heading is true. */
const MERIT_ORDERS = new Set(['popularity', 'score', 'favorites', 'rating']);

/**
 * One or two sentences per genre, above its most popular shows. Written by
 * hand, not generated: the genres are a fixed set, and this is the text that
 * makes each genre page its own.
 */
const GENRE_INTROS = {
  Action: 'Fights, chases and the stakes that make them matter, from tournament battles and war stories to superpowered duels.',
  Adventure: 'Journeys into the unknown: quests, expeditions and whole worlds to explore, often with a found family along the way.',
  Comedy: 'Anime made to make you laugh, from rapid-fire gag series to easygoing comedies built on a cast you grow fond of.',
  Drama: 'Stories driven by character and consequence: loss, ambition, family and the choices that change a life.',
  Ecchi: 'Comedy and romance with deliberate fan service. Rebyuu lists ecchi titles, but not explicit ones.',
  Fantasy: 'Magic, other worlds and the rules that govern them, from sword-and-sorcery epics to isekai, where the hero wakes up somewhere new.',
  Horror: 'Dread, the uncanny and the grotesque: psychological horror, supernatural terror and survival stories that do not look away.',
  'Mahou Shoujo': 'Magical girl anime: transformations, friendship and the price of power, from monster-of-the-week classics to darker reinventions.',
  Mecha: 'Giant robots and the people who pilot them, from grounded real-robot war dramas to super-robot spectacle.',
  Music: 'Bands, idols and performers: anime about making music, with the concerts, rehearsals and rivalries that come with it.',
  Mystery: 'Puzzles solved alongside the characters: detectives, locked rooms, conspiracies and secrets revealed one clue at a time.',
  Psychological: "Anime that gets inside its characters' heads, with mind games, unreliable narrators and pressure that builds to a breaking point.",
  Romance: 'Love stories in every form, from slow-burn school romances to adult relationships and romantic comedies.',
  'Sci-Fi': 'Science fiction anime: space operas, cyberpunk cities, time travel and the questions new technology raises.',
  'Slice of Life': 'Everyday life told with care: school days, work, hobbies and friendships, where small moments carry the story.',
  Sports: 'Training, teamwork and the big match: sports anime about the athletes and what winning costs them.',
  Supernatural: 'Ghosts, spirits, curses and powers beyond the ordinary, set in a world that otherwise looks a lot like ours.',
  Thriller: 'High-tension stories where every move matters: cat-and-mouse games, survival and conspiracies closing in.',
};

/** A hub path with nothing to show — a season that can't exist, or one without shows — as the 404 names it. */
export const HUB_MISSING = { heading: 'Nothing listed here', text: 'There is no anime listed for this page yet.' };

/** "A", "A and B", "A, B and C". */
export function listNames(names) {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function hubTitle(hub, now = new Date()) {
  switch (hub.kind) {
    case 'season':
      return seasonTense(hub, now) === 'past'
        ? `${seasonName(hub)} Anime: Every Show of the Season · Rebyuu`
        : `${seasonName(hub)} Anime: Every New Show This Season · Rebyuu`;
    case 'airing':
      return "Anime Airing Now & This Week's Episode Schedule · Rebyuu";
    case 'upcoming':
      return 'Upcoming Anime: The Most Anticipated New Shows · Rebyuu';
    case 'top':
      return 'Top Rated Anime of All Time · Rebyuu';
    case 'year':
      return isThisYear(hub, now)
        ? `Best Anime of ${hub.year} So Far · Rebyuu`
        : `Best Anime of ${hub.year}, Top Rated First · Rebyuu`;
    case 'genre':
      return `Best ${hub.genre} Anime, Most Popular First · Rebyuu`;
    default:
      throw new Error(`hubTitle: unknown hub kind ${hub.kind}`);
  }
}

/**
 * The page's H1. `sort` is the order the grid is showing: a year's or a
 * genre's "Best …" holds only while that is an order by merit, so a heading
 * never claims a ranking the grid isn't showing.
 */
export function hubHeading(hub, { sort, now = new Date() } = {}) {
  const best = MERIT_ORDERS.has(sort);
  switch (hub.kind) {
    case 'season':
      return `${seasonName(hub)} Anime`;
    case 'airing':
      return 'Anime Airing Now';
    case 'upcoming':
      return 'Upcoming Anime';
    case 'top':
      return 'Top Rated Anime';
    case 'year':
      if (!best) return `Anime of ${hub.year}`;
      return isThisYear(hub, now) ? `Best Anime of ${hub.year} So Far` : `Best Anime of ${hub.year}`;
    case 'genre':
      return best ? `Best ${hub.genre} Anime` : `${hub.genre} Anime`;
    default:
      throw new Error(`hubHeading: unknown hub kind ${hub.kind}`);
  }
}

export function hubDescription(hub, now = new Date()) {
  switch (hub.kind) {
    case 'season': {
      const tense = seasonTense(hub, now);
      if (tense === 'upcoming') {
        return `Every anime announced for ${seasonName(hub)}, most anticipated first. Open any show for its trailer, studio and where to watch. Updated daily.`;
      }
      if (tense === 'current') {
        return `Every anime of the ${seasonName(hub)} season, most popular first. Open any show for ratings, reviews and where to watch. Updated daily.`;
      }
      return `Every anime of the ${seasonName(hub)} season, most popular first, with ratings and reviews for each show.`;
    }
    case 'airing':
      return "Every anime airing now, with this week's episode schedule and what's trending. Open any show for ratings, reviews and where to watch.";
    case 'upcoming':
      return 'The most anticipated upcoming anime and the seasons they are announced for. Open any show for its trailer and studio. Updated daily.';
    case 'top':
      return 'The top rated anime of all time, by AniList score. Open any show for ratings, reviews and where to watch.';
    case 'year':
      return isThisYear(hub, now)
        ? `The best anime of ${hub.year} so far, top rated first. Updated daily, with ratings, reviews and where to watch.`
        : `The best anime of ${hub.year}, top rated first. Open any show for ratings, reviews and where to watch.`;
    case 'genre':
      return `The most popular ${hub.genre.toLowerCase()} anime of all time, ranked. Open any show for ratings, reviews and where to watch.`;
    default:
      throw new Error(`hubDescription: unknown hub kind ${hub.kind}`);
  }
}

/** The heading over the served list of titles. */
export function hubListHeading(hub) {
  switch (hub.kind) {
    case 'season':
      return `Every ${seasonName(hub)} anime, most popular first`;
    case 'airing':
      return 'Every anime airing now, trending first';
    case 'upcoming':
      return 'Upcoming anime, most anticipated first';
    case 'top':
      return 'Top rated anime of all time';
    case 'year':
      return `Top rated anime of ${hub.year}`;
    case 'genre':
      return `The most popular ${hub.genre.toLowerCase()} anime`;
    default:
      throw new Error(`hubListHeading: unknown hub kind ${hub.kind}`);
  }
}

/** What the row of links above the grid leads to; null for a hub with none. */
export function hubLinksLabel(hub) {
  if (hub.kind === 'season') return 'More seasons';
  if (hub.kind === 'upcoming') return 'Upcoming seasons';
  if (hub.kind === 'top') return 'By year';
  if (hub.kind === 'year') return `Seasons of ${hub.year}`;
  if (hub.kind === 'genre') return 'Other genres';
  return null;
}

/**
 * One to three sentences above the grid, from `items`: the hub's list in its
 * default order ({ title, rating } at least).
 */
export function hubIntro(hub, items = [], now = new Date()) {
  const top = items.slice(0, 3).map((i) => i.title).filter(Boolean);
  const one = top.length === 1;
  switch (hub.kind) {
    case 'season': {
      const tense = seasonTense(hub, now);
      const month = `${FIRST_MONTH[SEASONS.indexOf(hub.season)]} ${hub.year}`;
      const sentences = [`The ${seasonName(hub)} anime season ${tense === 'upcoming' ? 'starts' : 'started'} in ${month}.`];
      if (top.length) {
        sentences.push(
          tense === 'past'
            ? `Its most popular ${one ? 'show is' : 'shows are'} ${listNames(top)}.`
            : `The most followed ${one ? 'show' : 'shows'} so far ${one ? 'is' : 'are'} ${listNames(top)}.`
        );
      }
      if (tense !== 'upcoming') {
        const best = items
          .filter((i) => i.title && i.rating != null)
          .reduce((a, b) => (b.rating > (a?.rating ?? -Infinity) ? b : a), null);
        if (best) {
          sentences.push(`The highest rated${tense === 'current' ? ' so far' : ''} is ${best.title}, at ${Number(best.rating).toFixed(1)}/10 on AniList.`);
        }
      }
      return sentences.join(' ');
    }
    case 'airing':
      return `Every anime airing right now, with this week's new episodes by day.${top.length ? ` Trending this week: ${listNames(top)}.` : ''}`;
    case 'upcoming':
      return `Anime that have been announced but haven't started yet, most anticipated first.${top.length ? ` The most awaited ${one ? 'is' : 'are'} ${listNames(top)}.` : ''}`;
    case 'top':
      return `The highest rated anime of all time, by the average score of AniList's users.${top.length ? ` At the top: ${listNames(top)}.` : ''}`;
    case 'year':
      return isThisYear(hub, now)
        ? `The best anime of ${hub.year} so far, by AniList score.${top.length ? ` Leading the year: ${listNames(top)}.` : ''}`
        : `The best anime of ${hub.year} by AniList score.${top.length ? ` ${one ? 'The top show is' : `The top ${top.length === 2 ? 'two' : 'three'} are`} ${listNames(top)}.` : ''}`;
    case 'genre':
      return `${GENRE_INTROS[hub.genre]}${top.length ? ` The most popular ${one ? 'is' : 'are'} ${listNames(top)}.` : ''}`;
    default:
      throw new Error(`hubIntro: unknown hub kind ${hub.kind}`);
  }
}
