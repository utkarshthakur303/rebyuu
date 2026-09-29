import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleTag, metaDescription, otherNames, nameLang, titleFacts, nextEpisode, formatAiring, relationGroups, quickAnswers } from '../api/_titlepage.js';
import { anime } from './helpers.mjs';

const frieren = anime(154587, "Frieren: Beyond Journey's End", {
  year: 2023,
  genres: ['Adventure', 'Drama', 'Fantasy'],
  episodes: 28,
  status: 'completed',
  rating: 9.1,
  description: 'After the party of heroes defeated the Demon King, they restored peace to the land and returned to lives of solitude.',
});

// ── <title> ────────────────────────────────────────────────────────────

test('a released title is billed for its reviews and ratings', () => {
  assert.equal(titleTag(frieren), "Frieren: Beyond Journey's End (2023) — Reviews & Ratings · Rebyuu");
});

test('where to watch is claimed only when the page lists streaming services', () => {
  const streaming = [{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQX4' }];
  assert.equal(titleTag({ ...frieren, streaming }), "Frieren: Beyond Journey's End (2023) — Reviews, Ratings & Where to Watch · Rebyuu");
  assert.equal(titleTag({ ...frieren, streaming: [] }), "Frieren: Beyond Journey's End (2023) — Reviews & Ratings · Rebyuu");
});

test('an announced title is billed for its release date, and its trailer when it has one', () => {
  const upcoming = anime(1, 'Fool Night', { status: 'upcoming', year: 2026 });
  assert.equal(titleTag(upcoming), 'Fool Night (2026) — Release Date & Details · Rebyuu');
  assert.equal(titleTag({ ...upcoming, trailer: 'https://www.youtube.com/watch?v=x' }), 'Fool Night (2026) — Release Date, Trailer & Details · Rebyuu');
});

test('a title with no year has no empty brackets', () => {
  assert.equal(titleTag(anime(1, 'Mystery Show')), 'Mystery Show — Reviews & Ratings · Rebyuu');
});

// ── meta description ───────────────────────────────────────────────────

test('the description opens with a sentence of facts, then the score, then the synopsis', () => {
  const d = metaDescription(frieren);

  assert.match(d, /^Frieren: Beyond Journey's End is a 2023 adventure and drama anime series with 28 episodes\. /);
  assert.match(d, /Rated 9\.1\/10 by AniList users\./);
  assert.match(d, /After the party of heroes/);
});

test('the description stays within 160 characters', () => {
  const d = metaDescription({ ...frieren, description: 'word '.repeat(200) });
  assert.ok(d.length <= 160, `${d.length} chars`);
  assert.match(d, /…$/);
});

test('an airing title says so, and a film is not called a series', () => {
  assert.match(metaDescription({ ...frieren, status: 'airing', episodes: null }), /^Frieren: Beyond Journey's End is a 2023 adventure and drama anime series, currently airing\./);
  assert.match(metaDescription({ ...frieren, episodes: 1, format: 'MOVIE' }), /is a 2023 adventure and drama anime film\./);
});

test('an announced title is described as upcoming, with the right article', () => {
  assert.match(metaDescription(anime(1, 'Fool Night', { status: 'upcoming', year: 2026, genres: ['Sci-Fi'], episodes: null })), /^Fool Night is an upcoming 2026 sci-fi anime\./);
  assert.match(metaDescription(anime(1, 'Undated', { genres: ['Action'], episodes: null })), /^Undated is an action anime\./);
});

test('without a score or synopsis the description is just the facts', () => {
  assert.equal(metaDescription(anime(1, 'Bare', { year: 2020, genres: [], episodes: 12 })), 'Bare is a 2020 anime series with 12 episodes.');
});

test('the Rebyuu community score is preferred to AniList\'s once it exists', () => {
  const d = metaDescription(frieren, { community: { average: 8.4, count: 12 } });
  assert.match(d, /Rebyuu users rate it 8\.4\/10\./);
  assert.doesNotMatch(d, /AniList/);
});

// ── other names ────────────────────────────────────────────────────────

const named = {
  ...frieren,
  title_english: "Frieren: Beyond Journey's End",
  title_romaji: 'Sousou no Frieren',
  title_native: '葬送のフリーレン',
  synonyms: ['Frieren at the Funeral', '장송의 프리렌', 'Sōsō no Furīren', 'sousou no frieren', 'Frieren - Oltre la Fine del Viaggio', 'Frieren: Tras finalizar el viaje'],
};

test('other names: romaji, then native script, then up to three Latin-script synonyms', () => {
  assert.deepEqual(otherNames(named), [
    'Sousou no Frieren',
    '葬送のフリーレン',
    'Frieren at the Funeral',
    'Sōsō no Furīren',
    'Frieren - Oltre la Fine del Viaggio',
  ]);
});

test('a name identical to the display title, in any case, is not repeated', () => {
  const onePiece = anime(21, 'ONE PIECE', { title_english: 'ONE PIECE', title_romaji: 'ONE PIECE', title_native: 'ONE PIECE', synonyms: ['One Piece', 'OP'] });
  assert.deepEqual(otherNames(onePiece), ['OP']);
});

test('a title synced before the name columns existed has no other names', () => {
  assert.deepEqual(otherNames(frieren), []);
});

test('the description names the romaji title people also search by', () => {
  assert.match(metaDescription(named), /^Frieren: Beyond Journey's End \(Sousou no Frieren\) is a 2023 /);
});

test('a name is tagged with a language only when its script says which', () => {
  assert.equal(nameLang('葬送のフリーレン'), 'ja'); // kana
  assert.equal(nameLang('장송의 프리렌'), 'ko');
  assert.equal(nameLang('天官赐福'), null); // Han only: Japanese or Chinese
  assert.equal(nameLang('Sousou no Frieren'), null); // the page's own language
});

// ── follow-up answers ─────────────────────────────────────────────────

const NOW = new Date('2026-09-28T12:00:00Z');

const detailed = {
  ...named,
  format: 'TV',
  source: 'MANGA',
  duration: 24,
  studios: ['MADHOUSE'],
  mal_id: 52991,
  season: 'Fall',
  streaming: [
    { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQX4' },
    { site: 'Netflix', url: 'https://www.netflix.com/title/81726714' },
    { site: 'Hulu', url: 'https://www.hulu.com/series/frieren' },
    { site: 'YouTube', url: 'https://www.youtube.com/playlist?list=x' },
  ],
  relations: [
    { id: 'anilist-182255', relation: 'SEQUEL', title: "Frieren: Beyond Journey's End Season 2", year: 2026, format: 'TV' },
    { id: 'anilist-170068', relation: 'SIDE_STORY', title: 'Sousou no Frieren: no Mahou', year: 2023, format: 'ONA' },
    { id: 'anilist-189513', relation: 'SIDE_STORY', title: 'Sousou no Frieren: no Mahou Part 2', year: 2025, format: 'ONA' },
  ],
};

const airing = { ...detailed, status: 'airing', episodes: 12, next_episode: 5, next_episode_at: '2026-10-03T15:00:00+00:00' };

test('extra facts: format, season, studio, source and episode length, when known', () => {
  assert.deepEqual(titleFacts(detailed), [
    { label: 'Format', value: 'TV series' },
    { label: 'Season', value: 'Fall 2023' },
    { label: 'Studio', value: 'MADHOUSE' },
    { label: 'Source', value: 'Manga' },
    { label: 'Episode length', value: '24 min' },
  ]);
  // Synced before the migration: nothing beyond what the page already shows.
  assert.deepEqual(titleFacts(frieren), []);
});

test('the next episode is shown only while it is still in the future', () => {
  assert.deepEqual(nextEpisode(airing, NOW), { episode: 5, at: new Date('2026-10-03T15:00:00Z') });
  assert.equal(nextEpisode(airing, new Date('2026-10-04T00:00:00Z')), null, 'stale once it has aired');
  assert.equal(nextEpisode(detailed, NOW), null);
});

test('airing times are written out in full, in the requested time zone', () => {
  assert.equal(formatAiring(new Date('2026-10-03T15:00:00Z'), { timeZone: 'UTC' }), 'Saturday 3 October 2026, 15:00 UTC');
});

test('relations are grouped under readable labels, linked when the title is in the catalogue', () => {
  const known = new Map([['anilist-182255', { id: 'anilist-182255', title: "Frieren: Beyond Journey's End Season 2", year: 2026 }]]);

  const groups = relationGroups(detailed, known);

  assert.deepEqual(groups.map((g) => [g.label, g.items.length]), [['Sequel', 1], ['Side stories', 2]]);
  assert.equal(groups[0].items[0].path, '/anime/182255-frieren-beyond-journeys-end-season-2');
  assert.equal(groups[1].items[0].path, null, 'not in the catalogue, so not a link');
});

test('quick answers for a finished series: episode count, finished, who made it, sequel', () => {
  const answers = quickAnswers(detailed, { now: NOW, timeZone: 'UTC' });

  assert.deepEqual(answers, [
    { question: "How many episodes does Frieren: Beyond Journey's End have?", answer: "Frieren: Beyond Journey's End has 28 episodes, each about 24 minutes long." },
    { question: "Is Frieren: Beyond Journey's End finished?", answer: "Yes. Frieren: Beyond Journey's End has finished airing." },
    { question: "Who made Frieren: Beyond Journey's End?", answer: "Frieren: Beyond Journey's End was animated by MADHOUSE, adapted from the manga." },
    { question: "Is there a sequel to Frieren: Beyond Journey's End?", answer: "Yes: Frieren: Beyond Journey's End Season 2 (2026)." },
  ]);
});

test('quick answers for an airing series count what has aired and give the next date', () => {
  const answers = quickAnswers(airing, { now: NOW, timeZone: 'UTC' });

  assert.equal(answers[0].answer, "Frieren: Beyond Journey's End is still airing: 4 of 12 episodes are out so far.");
  assert.equal(answers[1].answer, "No, it is still airing. Episode 5 airs on Saturday 3 October 2026, 15:00 UTC.");
});

test('quick answers for an announced title say when it is expected, and nothing it cannot back', () => {
  const upcoming = anime(1, 'Fool Night', { status: 'upcoming', year: 2026, season: 'Fall', episodes: null });

  assert.deepEqual(quickAnswers(upcoming, { now: NOW }), [
    { question: 'Is Fool Night out yet?', answer: 'Not yet. Fool Night is scheduled for Fall 2026.' },
  ]);
});

test('with no detail data, the answers are only what the base columns support', () => {
  const answers = quickAnswers(frieren, { now: NOW });
  assert.deepEqual(answers.map((a) => a.question), ["How many episodes does Frieren: Beyond Journey's End have?", "Is Frieren: Beyond Journey's End finished?"]);
  assert.equal(answers[0].answer, "Frieren: Beyond Journey's End has 28 episodes.");
});

test('the title tag leads with the next episode while one is scheduled', () => {
  const tag = titleTag(airing, { now: NOW });
  assert.equal(tag, "Frieren: Beyond Journey's End (2023) — Next Episode, Reviews & Where to Watch · Rebyuu");
});

test('the description names up to three services the title streams on', () => {
  assert.match(metaDescription(detailed), /anime series with 28 episodes\. Watch it on Crunchyroll, Netflix and Hulu\./);
});

test('sentences are added whole or not at all; only the synopsis is ever clipped', () => {
  // With the romaji name in brackets there is no room for the score sentence
  // after the streaming one: it is left out rather than cut in half.
  const d = metaDescription(detailed);
  assert.ok(d.length <= 160, `${d.length} chars`);
  assert.match(d, /Hulu\.$/);

  // A short title leaves room for the score and some synopsis.
  const short = metaDescription({ ...detailed, title: 'Frieren', title_romaji: null, title_english: null, synonyms: [] });
  assert.match(short, /^Frieren is a 2023 adventure and drama anime series with 28 episodes\. Watch it on Crunchyroll, Netflix and Hulu\. Rated 9\.1\/10 by AniList users\./);
});
