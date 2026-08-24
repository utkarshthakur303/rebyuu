import { Link } from 'react-router-dom';
import { useNoIndex } from '@/utils/useNoIndex';

/**
 * Client-side 404.
 *
 * Direct hits on an unknown URL never reach this component: vercel.json only
 * rewrites the seven real routes to index.html, so anything else is served
 * public/404.html with a genuine 404 status. This handles the other path in
 * — navigating to a bad route from inside the app, where no request is made
 * and the router is the only thing that can respond.
 *
 * Kept visually in step with public/404.html so the two read as one page.
 */
export default function NotFoundPage() {
  useNoIndex();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-16 text-center">
      <p
        className="text-ink leading-[0.85] tracking-tight"
        style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 'clamp(84px, 22vw, 200px)' }}
      >
        404
      </p>

      <div className="my-7 h-1 w-16 bg-orange" />

      <h1
        className="mb-3.5 uppercase"
        style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 'clamp(22px, 4.4vw, 34px)', fontWeight: 400 }}
      >
        Not in the archive
      </h1>

      <p
        className="max-w-[46ch] text-base leading-relaxed opacity-75"
        style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif' }}
      >
        This page does not exist. The title you were looking for may have moved,
        or the link that brought you here may have been mistyped.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link
          to="/browse"
          className="border-2 border-ink bg-ink px-[22px] py-[13px] text-paper uppercase tracking-[0.14em] shadow-[4px_4px_0_var(--orange)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
          style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: '12px', fontWeight: 500 }}
        >
          Browse the catalogue
        </Link>
        <Link
          to="/"
          className="border-2 border-ink px-[22px] py-[13px] uppercase tracking-[0.14em] shadow-[4px_4px_0_var(--orange)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
          style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: '12px', fontWeight: 500 }}
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
