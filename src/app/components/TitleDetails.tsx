import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CalendarClock, ExternalLink } from 'lucide-react';
import type { Anime } from '@/services/anime';
import {
  titleFacts,
  nextEpisode,
  formatAiring,
  relationGroups,
  quickAnswers,
  streamingLinks,
} from '../../../api/_titlepage.js';

/**
 * The follow-up answers on a title page: where to stream it, when the next
 * episode airs, the quick answers, and its seasons and related titles.
 *
 * Every word comes from api/_titlepage.js — the same functions the prerender
 * uses — so what a visitor reads here is what the served HTML already said.
 * Each section renders nothing until the row carries the data it needs (the
 * detail columns arrive with supabase/title_details_migration.sql).
 */

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
} as const;

const heading = 'mb-3 sm:mb-4 text-xl sm:text-2xl text-foreground';
const anton = { fontFamily: 'Anton, Impact, sans-serif' };
const outfit = { fontFamily: 'Outfit, ui-sans-serif, sans-serif' };
const mono = { fontFamily: 'JetBrains Mono, ui-monospace, monospace' };

/** Format, season, studio, source and length, as chips beside year and episodes. */
export function ExtraFacts({ anime }: { anime: Anime }) {
  const facts = titleFacts(anime);
  if (!facts.length) return null;
  return (
    <>
      {facts.map((fact: { label: string; value: string; path?: string }) => (
        <span
          key={fact.label}
          title={fact.label}
          className="text-xs text-muted-foreground border-l border-ink/20 pl-2 sm:pl-3"
          style={outfit}
        >
          {/* The season links its season's page, as the served page does. */}
          {fact.path ? (
            <Link to={fact.path} className="underline decoration-ink/30 underline-offset-2 hover:text-crimson">
              {fact.value}
            </Link>
          ) : (
            fact.value
          )}
        </span>
      ))}
    </>
  );
}

export function WhereToWatch({ anime }: { anime: Anime }) {
  const links: { site: string; url: string }[] = streamingLinks(anime);
  if (!links.length) return null;
  return (
    <motion.section {...reveal} className="rounded-lg border border-ink/20 bg-card p-4 sm:p-6">
      <h2 className={heading} style={anton}>Where to watch {anime.title}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.site}
            href={link.url}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-2 border-2 border-ink bg-background px-4 py-2 text-sm font-medium text-foreground transition-shadow hover:shadow-[4px_4px_0_var(--orange)]"
            style={outfit}
          >
            {link.site}
            <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground" style={outfit}>
        Availability varies by country. Services as listed on AniList.
      </p>
    </motion.section>
  );
}

export function NextEpisode({ anime }: { anime: Anime }) {
  const next = anime.status === 'airing' ? nextEpisode(anime) : null;
  if (!next) return null;
  return (
    <motion.section {...reveal} className="rounded-lg border border-ink/20 bg-card p-4 sm:p-6">
      <h2 className={heading} style={anton}>When is the next episode of {anime.title}?</h2>
      <p className="flex items-start gap-2 text-base text-foreground/85" style={outfit}>
        <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
        <span>
          Episode {next.episode} airs on{' '}
          {/* The reader's own time zone; the served HTML says UTC. */}
          <time dateTime={next.at.toISOString()} className="font-semibold">{formatAiring(next.at)}</time>.
        </span>
      </p>
    </motion.section>
  );
}

export function QuickAnswers({ anime }: { anime: Anime }) {
  const answers = quickAnswers(anime);
  if (!answers.length) return null;
  return (
    <motion.section {...reveal} className="rounded-lg border border-ink/20 bg-card p-4 sm:p-6">
      <h2 className={heading} style={anton}>{anime.title}: quick answers</h2>
      <div className="space-y-4">
        {answers.map((qa: { question: string; answer: string }) => (
          <div key={qa.question}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/80" style={mono}>
              {qa.question}
            </h3>
            <p className="mt-1 text-base leading-relaxed text-foreground/85" style={outfit}>{qa.answer}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

type KnownTitle = { id: string; title: string; year: number | null };

/**
 * `known` holds the related ids that exist in the catalogue; only those are
 * links, since the others' pages would be 404s.
 */
export function RelatedSeasons({ anime, known }: { anime: Anime; known: Map<string, KnownTitle> }) {
  const groups = relationGroups(anime, known);
  if (!groups.length) return null;
  return (
    <motion.section {...reveal} className="rounded-lg border border-ink/20 bg-card p-4 sm:p-6">
      <h2 className={heading} style={anton}>{anime.title} seasons and related anime</h2>
      <dl className="space-y-3">
        {groups.map((group: { relation: string; label: string; items: { id: string; title: string; year: number | null; path: string | null }[] }) => (
          <div key={group.relation} className="sm:flex sm:gap-4">
            <dt className="w-40 shrink-0 text-[11px] uppercase tracking-[0.14em] text-muted-foreground" style={mono}>
              {group.label}
            </dt>
            <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1 sm:mt-0" style={outfit}>
              {group.items.map((item) => (
                <span key={item.id} className="text-base">
                  {item.path ? (
                    <Link to={item.path} className="underline underline-offset-2 hover:text-orange">{item.title}</Link>
                  ) : (
                    item.title
                  )}
                  {item.year ? <span className="text-muted-foreground"> ({item.year})</span> : null}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}
