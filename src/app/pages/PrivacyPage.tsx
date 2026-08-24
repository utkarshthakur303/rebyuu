import { Link } from 'react-router-dom';
import { ProsePage, ProseH2 } from '@/app/components/ProsePage';
import { useSeo } from '@/utils/useSeo';

export default function PrivacyPage() {
  useSeo({
    title: 'Privacy Policy — Rebyuu',
    description:
      'What Rebyuu stores, who it is shared with, and how to delete it. Written to describe what the application actually does.',
    path: '/privacy',
  });

  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy Policy"
      standfirst="Written to describe what this application actually does, rather than to cover every conceivable thing it might one day do."
      updated="24 August 2026"
    >
      <ProseH2>The short version</ProseH2>
      <p>
        You can browse, search and read this entire site without an account and without
        telling us anything about yourself. If you create an account we store your email
        address, a username, and whatever you choose to rate, review or save. We do not sell
        it, and there is no advertising or cross-site tracking on this site.
      </p>

      <ProseH2>What is stored if you create an account</ProseH2>
      <p>
        Accounts are handled by Supabase, which stores your email address and either a
        hashed password or, if you sign in with Google, a reference to that Google account.
        We never see your password, and we do not receive your Google password at any point.
      </p>
      <p>
        Alongside that we store the username you pick, an optional avatar image URL, any
        ratings you give, the text of any review you post, and the contents of any
        collections you build. Reviews and ratings are public by design — that is the point
        of posting one — and appear next to your username on the relevant title page.
      </p>

      <ProseH2>What is stored if you do not</ProseH2>
      <p>
        No account, no profile. Our hosting provider, Vercel, keeps standard server logs
        including IP address and user agent, as essentially every web server does, for
        delivery and abuse prevention. We do not combine those with anything else or use
        them to build a profile of you.
      </p>

      <ProseH2>Third parties that see something</ProseH2>
      <p>
        <strong>AniList and Jikan.</strong> Your browser requests catalogue data and images
        directly from AniList, and score data from Jikan. Those requests carry your IP
        address, as any request to any server does. They do not carry your identity, your
        account, or what you have saved — we never send them anything about you.
      </p>
      <p>
        <strong>YouTube.</strong> Trailers are embedded from YouTube's privacy-enhanced
        domain, youtube-nocookie.com, which does not set YouTube's tracking cookies unless
        you actually play a video. If you press play, YouTube's own privacy policy applies
        to what happens next.
      </p>
      <p>
        <strong>Google Fonts.</strong> Typefaces are served from Google's font CDN, which
        receives your IP address when your browser fetches them.
      </p>
      <p>
        <strong>Supabase and Vercel.</strong> Our database and our host respectively. Both
        process data on our behalf in order to run the service.
      </p>

      <ProseH2>Cookies</ProseH2>
      <p>
        The only cookies and local storage this site sets itself are the ones that keep you
        signed in and remember your title-language preference. There are no advertising
        cookies and no analytics cookies that identify you personally.
      </p>

      <ProseH2>Deleting your data</ProseH2>
      <p>
        You can delete any individual review from the page it appears on. To delete your
        account and everything attached to it, contact us through the{' '}
        <a href="https://github.com/utkarshthakur303/rebyuu" rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-orange">
          project repository
        </a>{' '}
        and it will be removed. We do not keep backups of deleted accounts beyond our
        provider's own short retention window.
      </p>

      <ProseH2>Children</ProseH2>
      <p>
        This site is not directed at children under 13, and accounts should not be created
        by them. The catalogue includes titles with adult content ratings, which are drawn
        from AniList's own classifications.
      </p>

      <ProseH2>Changes</ProseH2>
      <p>
        If this policy changes materially, the date at the top of this page changes with it.
      </p>

      <p className="!mt-10 border-t border-ink/15 pt-5 text-sm text-muted-foreground">
        This policy was drafted to describe the application accurately. It has not been
        reviewed by a lawyer, and it is not legal advice.{' '}
        <Link to="/terms" className="underline underline-offset-2 hover:text-orange">Terms of Service</Link>
        {' · '}
        <Link to="/about" className="underline underline-offset-2 hover:text-orange">About</Link>
      </p>
    </ProsePage>
  );
}
