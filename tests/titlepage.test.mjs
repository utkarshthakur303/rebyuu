import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleTag, metaDescription } from '../api/_titlepage.js';
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
