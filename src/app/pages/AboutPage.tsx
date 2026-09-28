import { Link } from 'react-router-dom';
import { ProsePage, ProseH2, ProseH3 } from '@/app/components/ProsePage';
import { useSeo } from '@/utils/useSeo';
import { PAGES } from '../../../api/_pages.js';

/**
 * The site's only page that says who is behind it and where the data comes
 * from. ATTRIBUTIONS.md said some of this already, but it is a repo file
 * with no route — correct attribution that reaches no reader is not
 * attribution. This is the routed version, and the trust signal the audit
 * scored 3/100 on.
 */
export default function AboutPage() {
  useSeo(PAGES.about);

  return (
    <ProsePage
      eyebrow={PAGES.about.eyebrow}
      title={PAGES.about.heading}
      standfirst={PAGES.about.standfirst}
      updated={PAGES.about.updated}
    >
      <ProseH2>What Rebyuu is</ProseH2>
      <p>
        Rebyuu is a way to find anime worth watching and keep track of what you have seen.
        It covers roughly 22,000 titles, filterable by genre, format, season, year and airing
        status, with live trending and currently-airing rankings on the homepage. Browsing,
        searching and reading are open to everyone. An account is needed only to rate a
        title, write a review, or save something to a collection.
      </p>

      <ProseH2>Where the data comes from</ProseH2>
      <p>
        Almost none of the catalogue text is ours, and it would be misleading to present it
        as though it were.
      </p>

      <ProseH3>AniList</ProseH3>
      <p>
        Titles, synopses, genre tags, season and year, airing status, episode counts and
        artwork all come from{' '}
        <a href="https://anilist.co" rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-orange">
          AniList
        </a>
        , through its public GraphQL API. Synopsis text is reproduced with HTML stripped and
        otherwise unchanged. Where a synopsis carries its own source note — you will see
        things like <em>(Source: Crunchyroll)</em> — that note is part of AniList's text and
        refers to AniList's upstream, not to us. Cover and banner images are served directly
        from AniList's servers rather than copied onto ours.
      </p>

      <ProseH3>MyAnimeList, via Jikan</ProseH3>
      <p>
        The numeric score on a title page comes from{' '}
        <a href="https://myanimelist.net" rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-orange">
          MyAnimeList
        </a>
        , read through{' '}
        <a href="https://jikan.moe" rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-orange">
          Jikan
        </a>
        , an unofficial community-maintained API. Jikan is not affiliated with MyAnimeList,
        and neither are we.
      </p>

      <ProseH2>How to read the scores</ProseH2>
      <p>
        There are two different numbers on this site and they measure different things.
      </p>
      <p>
        The <strong>MAL score</strong> is MyAnimeList's community aggregate — tens of
        thousands of votes from their users, not ours. We show it because it is genuinely
        useful, but it is their verdict, not Rebyuu's. For that reason we deliberately do
        not mark it up as this page's own rating in structured data: presenting another
        platform's aggregate as our own is exactly the kind of thing that makes review
        snippets untrustworthy across the whole web.
      </p>
      <p>
        The <strong>Rebyuu community score</strong> is ours: the mean of ratings left by
        Rebyuu accounts on that title. It appears only once a title has enough ratings to
        mean anything, and it says how many it is based on. Early on, most titles will not
        have one. An empty number is more honest than a fabricated one.
      </p>

      <ProseH2>What is actually ours</ProseH2>
      <p>
        The interface and its design, the discovery and filtering logic, the live-updated
        trending and airing rails, and every rating and review written by a Rebyuu account
        holder. Reviews belong to the people who wrote them.
      </p>

      <ProseH2>Editorial policy</ProseH2>
      <p>
        We do not write synopses and we do not paraphrase other people's. If a title page
        has original writing on it, it will be visibly labelled as ours. We do not generate
        descriptions automatically to fill space — a page with nothing of its own to say
        shows the source material and stops there.
      </p>
      <p>
        Nothing on this site is paid placement. Rankings come from AniList's public
        popularity and trending data or from Rebyuu users' own ratings, and nobody can buy a
        position in them.
      </p>

      <ProseH2>Corrections and contact</ProseH2>
      <p>
        If something here is wrong, or you hold rights to something surfaced on this site
        and want it credited differently or removed, raise it on the{' '}
        <a href="https://github.com/utkarshthakur303/rebyuu" rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-orange">
          project repository
        </a>
        . Corrections to catalogue data itself are usually best made at AniList, since that
        is where it originates and where a fix will propagate from.
      </p>

      <ProseH2>Related</ProseH2>
      <p>
        <Link to="/privacy" className="underline underline-offset-2 hover:text-orange">Privacy Policy</Link>
        {' · '}
        <Link to="/terms" className="underline underline-offset-2 hover:text-orange">Terms of Service</Link>
        {' · '}
        <Link to="/browse" className="underline underline-offset-2 hover:text-orange">Browse the catalogue</Link>
      </p>
    </ProsePage>
  );
}
