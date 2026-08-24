import type { ReactNode } from 'react';

/**
 * Shared shell for the site's written pages — About, Terms, Privacy.
 *
 * These are the only pages on Rebyuu made of prose rather than catalogue
 * data, and they carry the trust signals the rest of the site cannot: who
 * runs this, where the data comes from, what happens to your account. Kept
 * in one component so the three of them cannot drift apart.
 */
export function ProsePage({
  eyebrow,
  title,
  standfirst,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  standfirst?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="hazard-stripe mb-10" />

      <p
        className="mb-4 text-[10px] uppercase tracking-[0.22em] text-orange"
        style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
      >
        {eyebrow}
      </p>

      <h1
        className="mb-5 uppercase leading-[0.95]"
        style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 'clamp(34px, 7vw, 60px)', fontWeight: 400 }}
      >
        {title}
      </h1>

      {standfirst && (
        <p
          className="mb-8 text-lg leading-relaxed text-foreground/80"
          style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif' }}
        >
          {standfirst}
        </p>
      )}

      {updated && (
        <p
          className="mb-10 border-t border-ink/15 pt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          Last updated {updated}
        </p>
      )}

      <div
        className="prose-rebyuu space-y-5 text-base leading-[1.7] text-foreground/85"
        style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif' }}
      >
        {children}
      </div>
    </article>
  );
}

/** Section heading inside a prose page. */
export function ProseH2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="!mt-12 mb-3 uppercase"
      style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 'clamp(20px, 3.4vw, 27px)', fontWeight: 400 }}
    >
      {children}
    </h2>
  );
}

/** Sub-heading inside a prose page. */
export function ProseH3({ children }: { children: ReactNode }) {
  return (
    <h3
      className="!mt-7 mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/70"
      style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
    >
      {children}
    </h3>
  );
}
