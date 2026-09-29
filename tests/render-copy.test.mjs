import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHandler, installFetch, render } from './helpers.mjs';

const handler = await loadHandler();

const titleOf = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1];
const descriptionOf = (html) => html.match(/<meta name="description" content="([^"]*)"/)?.[1];

// The queries the homepage and the shell are meant to answer: someone looking
// for an anime tracker, for ratings and reviews, or for what is airing now.

test('the homepage title says what the site is in the words people search for', async () => {
  installFetch();

  const { body } = await render(handler, 'route=home');

  assert.match(titleOf(body), /anime tracker/i);
  assert.match(titleOf(body), /ratings/i);
  assert.match(titleOf(body), /reviews/i);
});

test('the homepage description covers tracking, reviews, lists and what is airing', async () => {
  installFetch();

  const description = descriptionOf((await render(handler, 'route=home')).body);

  for (const term of [/track/i, /review/i, /lists/i, /airing/i]) assert.match(description, term);
  assert.ok(description.length <= 160, `description is ${description.length} chars`);
});

test('the fallback shell carries the same plain copy, not the old tagline prose', async () => {
  // A Supabase outage on a title route serves the bare shell — as do /login,
  // /profile and /lists — so its copy is what a crawler sees then.
  installFetch({ tables: null });

  const { body } = await render(handler, 'route=anime&ref=1');

  assert.match(titleOf(body), /anime tracker/i);
  assert.doesNotMatch(body, /samurai|sacred|cinematic luxury/i);
});
