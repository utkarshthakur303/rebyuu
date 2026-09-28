import { Link } from 'react-router-dom';
import { ProsePage, ProseH2 } from '@/app/components/ProsePage';
import { useSeo } from '@/utils/useSeo';
import { PAGES } from '../../../api/_pages.js';

export default function TermsPage() {
  useSeo(PAGES.terms);

  return (
    <ProsePage
      eyebrow={PAGES.terms.eyebrow}
      title={PAGES.terms.heading}
      standfirst={PAGES.terms.standfirst}
      updated={PAGES.terms.updated}
    >
      <ProseH2>What Rebyuu offers</ProseH2>
      <p>
        Rebyuu is a free anime discovery and review service. Browsing and reading require no
        account. Rating, reviewing and saving titles to collections require one.
      </p>

      <ProseH2>Your account</ProseH2>
      <p>
        You are responsible for what happens under your account and for keeping your
        credentials to yourself. Use an accurate email address — it is how you would recover
        access. One person, one account; do not impersonate anyone else.
      </p>

      <ProseH2>What you post</ProseH2>
      <p>
        Reviews and ratings you write remain yours. By posting them you give Rebyuu
        permission to display them on the site next to your username, which is the only
        thing we do with them.
      </p>
      <p>
        Do not post anything unlawful, harassing, hateful, or deliberately misleading; do
        not post other people's writing as your own; do not post spam or advertising; and do
        not use automated means to submit reviews at volume. We may remove content that
        breaks these rules and, for repeated or serious breaches, close the account behind
        it.
      </p>

      <ProseH2>Catalogue content is not ours</ProseH2>
      <p>
        Synopses, scores, genre tags and artwork come from AniList and MyAnimeList, and the
        underlying rights belong to the studios, licensors and publishers involved. Nothing
        here transfers any of those rights to you. See the{' '}
        <Link to="/about" className="underline underline-offset-2 hover:text-orange">About page</Link>{' '}
        for the full attribution.
      </p>

      <ProseH2>Acceptable use</ProseH2>
      <p>
        Do not attempt to break, overload or gain unauthorised access to the service. Do not
        scrape the site at a volume that degrades it for other people — the upstream data is
        available from AniList's own API, which is a better source for it anyway. Automated
        access should respect our{' '}
        <a href="/robots.txt" className="underline underline-offset-2 hover:text-orange">robots.txt</a>.
      </p>

      <ProseH2>No guarantees</ProseH2>
      <p>
        The service is provided as is. Catalogue data comes from third parties and may be
        incomplete, out of date or wrong, and we do not warrant its accuracy. The site may
        be unavailable, change, or stop existing. To the extent the law allows, Rebyuu is
        not liable for losses arising from your use of it.
      </p>

      <ProseH2>Ending things</ProseH2>
      <p>
        You may stop using Rebyuu and request deletion of your account at any time — see the{' '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-orange">Privacy Policy</Link>.
        We may suspend or close an account that breaks these terms.
      </p>

      <ProseH2>Changes</ProseH2>
      <p>
        These terms may change; the date at the top of this page will change with them.
        Continuing to use the site after that means accepting the revised version.
      </p>

      <p className="!mt-10 border-t border-ink/15 pt-5 text-sm text-muted-foreground">
        These terms were drafted to describe this service accurately. They have not been
        reviewed by a lawyer, and they are not legal advice.{' '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-orange">Privacy Policy</Link>
        {' · '}
        <Link to="/about" className="underline underline-offset-2 hover:text-orange">About</Link>
      </p>
    </ProsePage>
  );
}
