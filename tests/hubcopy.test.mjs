import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubTitle, hubHeading, hubDescription, hubListHeading, hubLinksLabel, hubIntro, listNames } from '../api/_hubcopy.js';
import { SEASONS } from '../api/_catalog.js';

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
