import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchTitles, type TitleSet } from '@/services/anilist';

/**
 * Site-wide EN/JP switch for anime titles.
 *
 * `anime_index.title` holds one collapsed string (`english || romaji`), so the
 * alternate spelling is fetched from AniList on demand. Every component asks
 * for a title through `useAnimeTitle`, which registers the id; the provider
 * coalesces those registrations into batched 50-id requests rather than
 * issuing one call per card.
 *
 * "JP" means romaji (Shingeki no Kyojin), not native script — that matches the
 * spelling already stored for most rows. `native` is fetched too, so switching
 * to 進撃の巨人 later is a one-line change in `pick()`.
 */

export type TitleLang = 'en' | 'jp';

const STORAGE_KEY = 'rebyuu:titleLang';

interface TitleLangValue {
  lang: TitleLang;
  toggle: () => void;
  /** Queues an id for the next batched lookup. Called from an effect, never in render. */
  register: (id: string) => void;
  /** Pure read of already-fetched titles; falls back to the stored one. */
  resolve: (id: string, stored: string) => string;
}

const TitleLangContext = createContext<TitleLangValue | null>(null);

function anilistIdOf(id: string): number | null {
  const n = Number(id.replace(/^anilist-/, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readStored(): TitleLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'jp' ? 'jp' : 'en';
  } catch {
    return 'en';
  }
}

export function TitleLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<TitleLang>(readStored);
  const [titles, setTitles] = useState<Record<number, TitleSet>>({});

  // Ids awaiting their batch, plus every id already requested. Both are refs so
  // that registering an id never re-renders or invalidates `request`.
  const queued = useRef<Set<number>>(new Set());
  const seen = useRef<Set<number>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    const batch = [...queued.current].slice(0, 50);
    if (!batch.length) return;
    batch.forEach((id) => queued.current.delete(id));

    fetchTitles(batch).then((map) => {
      if (Object.keys(map).length) {
        setTitles((prev) => ({ ...prev, ...map }));
      }
    });

    // More ids than one request allows — drain the rest on the next tick.
    if (queued.current.size) {
      timer.current = setTimeout(flush, 60);
    }
  }, []);

  const request = useCallback(
    (anilistId: number) => {
      if (seen.current.has(anilistId)) return;
      seen.current.add(anilistId);
      queued.current.add(anilistId);
      if (timer.current === null) {
        // Short debounce so a whole grid of cards mounts into one request.
        timer.current = setTimeout(flush, 60);
      }
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next: TitleLang = prev === 'en' ? 'jp' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage blocked — the switch still works for this session */
      }
      return next;
    });
  }, []);

  const register = useCallback(
    (id: string) => {
      const anilistId = anilistIdOf(id);
      if (anilistId !== null) request(anilistId);
    },
    [request]
  );

  const resolve = useCallback(
    (id: string, stored: string) => {
      const anilistId = anilistIdOf(id);
      if (anilistId === null) return stored;
      const t = titles[anilistId];
      if (!t) return stored;
      const picked = lang === 'en' ? t.english ?? t.romaji : t.romaji ?? t.english;
      return picked ?? stored;
    },
    [lang, titles]
  );

  return (
    <TitleLangContext.Provider value={{ lang, toggle, register, resolve }}>
      {children}
    </TitleLangContext.Provider>
  );
}

/**
 * Resolved title for one anime. Safe outside the provider (returns the stored
 * title), so it can't break isolated renders or tests.
 */
export function useAnimeTitle(anime: { id: string; title: string } | null | undefined): string {
  const ctx = useContext(TitleLangContext);
  const id = anime?.id;

  useEffect(() => {
    if (ctx && id) ctx.register(id);
  }, [ctx, id]);

  if (!anime) return '';
  if (!ctx) return anime.title;
  return ctx.resolve(anime.id, anime.title);
}

/**
 * Renders one anime's title. Hooks can't be called inside a `.map()` callback,
 * so list rows use this component instead of `useAnimeTitle` directly.
 */
export function AnimeTitleText({
  anime,
  fallback = '',
}: {
  anime: { id: string; title: string } | null | undefined;
  fallback?: string;
}) {
  const title = useAnimeTitle(anime);
  return <>{title || fallback}</>;
}

export function useTitleLang(): { lang: TitleLang; toggle: () => void } {
  const ctx = useContext(TitleLangContext);
  return ctx ? { lang: ctx.lang, toggle: ctx.toggle } : { lang: 'en', toggle: () => {} };
}
