import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubTitle, hubHeading, hubDescription, hubListHeading, hubLinksLabel, hubIntro, listNames } from '../api/_hubcopy.js';
import { SEASONS, GENRES } from '../api/_catalog.js';

const NOW = new Date('2026-09-29T12:00:00Z');
const season = (name, year) => ({ kind: 'season', season: name, year });
const item = (title, rating = null) => ({ title, rating });

test('names are joined the way a sentence lists them', () => {
  assert.equal(listNames([]), '');
  assert.equal(listNames(['A']), 'A');
  assert.equal(listNames(['A', 'B']), 'A and B');
  assert.equal(listNames(['A', 'B', 'C']), 'A, B and C');
});

test('a season title says whether the season is new or over', () => {
  assert.equal(hubTitle(season('Fall', 2026), NOW), 'Fall 2026 Anime: Every New Show This Season · Rebyuu');
  assert.equal(hubTitle(season('Summer', 2026), NOW), 'Summer 2026 Anime: Every New Show This Season · Rebyuu');
  assert.equal(hubTitle(season('Fall', 2015), NOW), 'Fall 2015 Anime: Every Show of the Season · Rebyuu');
  assert.equal(hubTitle({ kind: 'airing' }, NOW), "Anime Airing Now & This Week's Episode Schedule · Rebyuu");
  assert.equal(hubTitle({ kind: 'upcoming' }, NOW), 'Upcoming Anime: The Most Anticipated New Shows · Rebyuu');
});

test('every title fits in 60 characters and every description in 160, for every season', () => {
  const hubs = [{ kind: 'airing' }, { kind: 'upcoming' }];
  for (let year = 1900; year <= 2028; year++) for (const name of SEASONS) hubs.push(season(name, year));
  for (const hub of hubs) {
    assert.ok(hubTitle(hub, NOW).length <= 60, hubTitle(hub, NOW));
    assert.ok(hubDescription(hub, NOW).length <= 160, hubDescription(hub, NOW));
  }
});

test('headings and list headings name the page plainly', () => {
  assert.equal(hubHeading(season('Fall', 2026), { now: NOW }), 'Fall 2026 Anime');
  assert.equal(hubHeading({ kind: 'airing' }, { now: NOW }), 'Anime Airing Now');
  assert.equal(hubHeading({ kind: 'upcoming' }, { now: NOW }), 'Upcoming Anime');
  assert.equal(hubListHeading(season('Fall', 2026)), 'Every Fall 2026 anime, most popular first');
  assert.equal(hubListHeading({ kind: 'airing' }), 'Every anime airing now, trending first');
  assert.equal(hubListHeading({ kind: 'upcoming' }), 'Upcoming anime, most anticipated first');
});

test('descriptions promise only what the pages show', () => {
  assert.match(hubDescription(season('Fall', 2026), NOW), /^Every anime announced for Fall 2026, most anticipated first\./);
  assert.match(hubDescription(season('Summer', 2026), NOW), /^Every anime of the Summer 2026 season, most popular first\./);
  assert.match(hubDescription(season('Fall', 2015), NOW), /^Every anime of the Fall 2015 season, most popular first/);
  for (const hub of [season('Fall', 2026), { kind: 'airing' }, { kind: 'upcoming' }]) {
    assert.doesNotMatch(hubDescription(hub, NOW), /release date/i);
  }
});

test('the links above the grid are labelled by what they lead to', () => {
  assert.equal(hubLinksLabel(season('Fall', 2026)), 'More seasons');
  assert.equal(hubLinksLabel({ kind: 'upcoming' }), 'Upcoming seasons');
  assert.equal(hubLinksLabel({ kind: 'airing' }), null);
});

test('an upcoming season says when it starts and what is most followed', () => {
  const intro = hubIntro(season('Fall', 2026), [item('A'), item('B'), item('C'), item('D')], NOW);
  assert.equal(intro, 'The Fall 2026 anime season starts in October 2026. The most followed shows so far are A, B and C.');
});

test('a current season adds its highest rated show so far', () => {
  const intro = hubIntro(season('Summer', 2026), [item('A', 7.9), item('B', 8.7), item('C', null)], NOW);
  assert.equal(intro, 'The Summer 2026 anime season started in July 2026. The most followed shows so far are A, B and C. The highest rated so far is B, at 8.7/10 on AniList.');
});

test('a past season speaks of it as finished', () => {
  const intro = hubIntro(season('Fall', 2015), [item('A', 9), item('B', 8.1)], NOW);
  assert.equal(intro, 'The Fall 2015 anime season started in October 2015. Its most popular shows are A and B. The highest rated is A, at 9.0/10 on AniList.');
});

test('one show, no shows, or no scores still read as sentences', () => {
  assert.equal(hubIntro(season('Fall', 2015), [item('A')], NOW), 'The Fall 2015 anime season started in October 2015. Its most popular show is A.');
  assert.equal(hubIntro(season('Fall', 2026), [item('A')], NOW), 'The Fall 2026 anime season starts in October 2026. The most followed show so far is A.');
  assert.equal(hubIntro(season('Fall', 2026), [], NOW), 'The Fall 2026 anime season starts in October 2026.');
});

test('airing and upcoming intros name the lead shows when there are any', () => {
  assert.equal(
    hubIntro({ kind: 'airing' }, [item('A'), item('B')], NOW),
    "Every anime airing right now, with this week's new episodes by day. Trending this week: A and B."
  );
  assert.equal(hubIntro({ kind: 'airing' }, [], NOW), "Every anime airing right now, with this week's new episodes by day.");
  assert.equal(
    hubIntro({ kind: 'upcoming' }, [item('A')], NOW),
    "Anime that have been announced but haven't started yet, most anticipated first. The most awaited is A."
  );
});

const top = { kind: 'top' };
const year = (y) => ({ kind: 'year', year: y });
const genre = (g) => ({ kind: 'genre', genre: g });

test('top, year and genre titles', () => {
  assert.equal(hubTitle(top, NOW), 'Top Rated Anime of All Time · Rebyuu');
  assert.equal(hubTitle(year(2025), NOW), 'Best Anime of 2025, Top Rated First · Rebyuu');
  assert.equal(hubTitle(year(2026), NOW), 'Best Anime of 2026 So Far · Rebyuu');
  assert.equal(hubTitle(genre('Romance'), NOW), 'Best Romance Anime, Most Popular First · Rebyuu');
});

test('every year and genre title fits 60 characters and description 160', () => {
  const hubs = [top, ...GENRES.map(genre)];
  for (let y = 1900; y <= 2026; y++) hubs.push(year(y));
  for (const hub of hubs) {
    assert.ok(hubTitle(hub, NOW).length <= 60, hubTitle(hub, NOW));
    assert.ok(hubDescription(hub, NOW).length <= 160, hubDescription(hub, NOW));
  }
});

test('a "best" heading holds only while the grid is ranked by merit', () => {
  assert.equal(hubHeading(top, { sort: 'score', now: NOW }), 'Top Rated Anime');
  assert.equal(hubHeading(year(2025), { sort: 'score', now: NOW }), 'Best Anime of 2025');
  assert.equal(hubHeading(year(2026), { sort: 'score', now: NOW }), 'Best Anime of 2026 So Far');
  assert.equal(hubHeading(year(2025), { sort: 'trending', now: NOW }), 'Anime of 2025');
  assert.equal(hubHeading(year(2025), { sort: 'newest', now: NOW }), 'Anime of 2025');
  assert.equal(hubHeading(genre('Romance'), { sort: 'popularity', now: NOW }), 'Best Romance Anime');
  assert.equal(hubHeading(genre('Romance'), { sort: 'favorites', now: NOW }), 'Best Romance Anime');
  assert.equal(hubHeading(genre('Romance'), { sort: 'trending', now: NOW }), 'Romance Anime');
});

test('top, year and genre list headings, links labels and descriptions', () => {
  assert.equal(hubListHeading(top), 'Top rated anime of all time');
  assert.equal(hubListHeading(year(2025)), 'Top rated anime of 2025');
  assert.equal(hubListHeading(genre('Slice of Life')), 'The most popular slice of life anime');
  assert.equal(hubLinksLabel(top), 'By year');
  assert.equal(hubLinksLabel(year(2025)), 'Seasons of 2025');
  assert.equal(hubLinksLabel(genre('Romance')), 'Other genres');
  assert.match(hubDescription(genre('Sci-Fi'), NOW), /^The most popular sci-fi anime of all time, ranked\./);
  assert.match(hubDescription(year(2026), NOW), /^The best anime of 2026 so far, top rated first\./);
});

test('top and year intros name what leads the ranking', () => {
  const lead = [item('A', 9.1), item('B', 9), item('C', 8.9), item('D', 8.8)];
  assert.equal(hubIntro(top, lead, NOW), "The highest rated anime of all time, by the average score of AniList's users. At the top: A, B and C.");
  assert.equal(hubIntro(year(2025), lead, NOW), 'The best anime of 2025 by AniList score. The top three are A, B and C.');
  assert.equal(hubIntro(year(2026), lead, NOW), 'The best anime of 2026 so far, by AniList score. Leading the year: A, B and C.');
  assert.equal(hubIntro(year(2025), [], NOW), 'The best anime of 2025 by AniList score.');
});

test('every genre has an intro of its own, followed by its most popular shows', () => {
  const intros = new Set();
  for (const g of GENRES) {
    const intro = hubIntro(genre(g), [], NOW);
    assert.match(intro, /^[A-Z].{40,240}\.$/, g);
    intros.add(intro);
  }
  assert.equal(intros.size, GENRES.length);
  assert.match(hubIntro(genre('Romance'), [item('A'), item('B')], NOW), /\. The most popular are A and B\.$/);
});
