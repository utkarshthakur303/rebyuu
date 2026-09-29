import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFetch, anime, SUPABASE_URL } from './helpers.mjs';
import { qualityFilter, MIN_SYNOPSIS_CHARS } from '../api/_quality.js';

const NOW = new Date('2026-09-29T12:00:00Z');
const LONG = 'x'.repeat(MIN_SYNOPSIS_CHARS);

/** Ids of the anime_index rows a filter matches, evaluated by the PostgREST fake. */
async function matching(filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/anime_index?select=id&${filter}`);
  return (await res.json()).map((row) => row.id);
}

test('quality titles have a real synopsis and are rated, airing, or announced for this year on', async () => {
  installFetch({
    tables: {
      anime_index: [
        anime(1, 'Rated', { description: LONG, rating: 7, status: 'completed' }),
        anime(2, 'Low', { description: LONG, rating: 5, status: 'completed' }),
        anime(3, 'Short', { description: 'Too short.', rating: 9, status: 'completed' }),
        anime(4, 'Airing', { description: LONG, rating: null, status: 'airing' }),
        anime(5, 'Soon', { description: LONG, status: 'upcoming', year: 2027 }),
        anime(6, 'Stale', { description: LONG, status: 'upcoming', year: 2019 }),
      ],
    },
  });

  assert.deepEqual(await matching(qualityFilter([], NOW)), ['anilist-1', 'anilist-4', 'anilist-5']);
});

test('extra terms narrow the quality titles', async () => {
  installFetch({
    tables: {
      anime_index: [
        anime(1, 'Fall', { description: LONG, rating: 7, season: 'Fall' }),
        anime(2, 'Spring', { description: LONG, rating: 7, season: 'Spring' }),
      ],
    },
  });

  assert.deepEqual(await matching(qualityFilter(['season.eq.Fall'], NOW)), ['anilist-1']);
});
