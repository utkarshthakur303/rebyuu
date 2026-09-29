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
    default:
      throw new Error(`hubTitle: unknown hub kind ${hub.kind}`);
  }
}

/**
 * The page's H1. `sort` is the order the grid is showing, for the hubs whose
 * heading names one; none of these do.
 */
export function hubHeading(hub, { sort, now = new Date() } = {}) {
  switch (hub.kind) {
    case 'season':
      return `${seasonName(hub)} Anime`;
    case 'airing':
      return 'Anime Airing Now';
    case 'upcoming':
      return 'Upcoming Anime';
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
    default:
      throw new Error(`hubListHeading: unknown hub kind ${hub.kind}`);
  }
}

/** What the row of links above the grid leads to; null for a hub with none. */
export function hubLinksLabel(hub) {
  if (hub.kind === 'season') return 'More seasons';
  if (hub.kind === 'upcoming') return 'Upcoming seasons';
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
    default:
      throw new Error(`hubIntro: unknown hub kind ${hub.kind}`);
  }
}
