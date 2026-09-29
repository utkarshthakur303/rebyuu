import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, animePath, animeRef, parseAnimeRef } from '../api/_paths.js';

test('a title becomes a lowercase, hyphenated slug; apostrophes vanish rather than split words', () => {
  assert.equal(slugify('Frieren: Beyond Journey’s End'), 'frieren-beyond-journeys-end');
  assert.equal(slugify("JoJo's Bizarre Adventure"), 'jojos-bizarre-adventure');
  assert.equal(slugify('Re:ZERO -Starting Life in Another World- Season 3'), 're-zero-starting-life-in-another-world-season-3');
});

test('diacritics are folded to plain letters', () => {
  assert.equal(slugify('Sōsō no Furīren'), 'soso-no-furiren');
  assert.equal(slugify('Pokémon'), 'pokemon');
});

test('a title with no Latin letters has no slug', () => {
  assert.equal(slugify('葬送のフリーレン'), '');
  assert.equal(slugify(''), '');
  assert.equal(slugify(null), '');
});

test('a long slug is cut at a word boundary', () => {
  const slug = slugify('Hello, I Am a Witch and My Crush Wants Me to Make a Love Potion! Special Edition Collection');
  assert.ok(slug.length <= 60, slug);
  assert.doesNotMatch(slug, /-$/);
  assert.equal(slug, 'hello-i-am-a-witch-and-my-crush-wants-me-to-make-a-love');
});

test('a title page URL is its AniList number and its slug', () => {
  assert.equal(animePath({ id: 'anilist-154587', title: 'Frieren: Beyond Journey’s End' }), '/anime/154587-frieren-beyond-journeys-end');
  assert.equal(animeRef({ id: 'anilist-154587', title: 'Frieren: Beyond Journey’s End' }), '154587-frieren-beyond-journeys-end');
  assert.equal(animePath({ id: 'anilist-9', title: '葬送' }), '/anime/9');
});

test('the id is read back from any form the URL has taken', () => {
  assert.deepEqual(parseAnimeRef('154587-frieren-beyond-journeys-end'), { id: 'anilist-154587' });
  assert.deepEqual(parseAnimeRef('154587'), { id: 'anilist-154587' });
  assert.deepEqual(parseAnimeRef('anilist-21'), { id: 'anilist-21' });
  assert.deepEqual(parseAnimeRef('154587-Old-Slug'), { id: 'anilist-154587' });
  assert.equal(parseAnimeRef('frieren'), null);
  assert.equal(parseAnimeRef('0'), null);
  assert.equal(parseAnimeRef(''), null);
});
