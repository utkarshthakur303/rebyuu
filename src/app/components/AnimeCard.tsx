import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Anime } from '@/services/anime';
import { useAnimeTitle } from '@/context/TitleLangContext';

interface AnimeCardProps {
  anime: Anime;
  index: number;
}


export function AnimeCard({ anime, index }: AnimeCardProps) {
  const navigate = useNavigate();
  const displayTitle = useAnimeTitle(anime);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showPreview && cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const previewWidth = 320;
      const spaceOnRight = window.innerWidth - cardRect.right;
      const spaceOnLeft = cardRect.left;
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      let left: number;
      if (spaceOnRight < previewWidth && spaceOnLeft > spaceOnRight) {
        left = cardRect.left + scrollX - previewWidth - 16;
      } else {
        left = cardRect.right + scrollX + 16;
      }
      
      const top = cardRect.top + scrollY;
      
      setPreviewPosition({ top, left });
    }
  }, [showPreview]);

  const handleMouseEnter = useCallback(() => {
    if (window.innerWidth >= 1024) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShowPreview(true);
      }, 300);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowPreview(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/anime/${anime.id}`, { replace: false });
  }, [navigate, anime.id]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
        whileHover={{ y: typeof window !== 'undefined' && 'ontouchstart' in window ? 0 : -6, transition: { duration: 0.3 } }}
        className="group relative w-full"
        onMouseEnter={typeof window !== 'undefined' && 'ontouchstart' in window ? undefined : handleMouseEnter}
        onMouseLeave={typeof window !== 'undefined' && 'ontouchstart' in window ? undefined : handleMouseLeave}
      >
        <Link 
          to={`/anime/${anime.id}`} 
          onClick={handleClick}
          className="block h-full cursor-pointer"
        >
        <div className="relative h-full overflow-hidden bg-card border-2 border-ink transition-all duration-300 group-hover:shadow-[6px_6px_0_var(--orange)]">
          {/* Image Container */}
          <div className="relative aspect-[2/3] w-full overflow-hidden">
            {anime.cover_image ? (
              <img
                src={anime.cover_image}
                alt={displayTitle || 'Anime'}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.parentElement?.querySelector('.image-fallback') as HTMLDivElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
            ) : null}
            <div className={`image-fallback h-full w-full bg-gradient-to-br from-crimson/60 via-crimson-dark/40 to-ink ${anime.cover_image ? 'hidden' : 'block'}`} />
            
            {/* Cinematic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            
            {/* Top border glow on hover */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Rating Badge */}
            {anime.rating && (
              <div 
                className="absolute right-2 top-2 flex items-center gap-1 bg-ink px-2 py-1 border-2 border-ink"
                onClick={(e) => e.stopPropagation()}
              >
                <Star className="h-3 w-3 star-gold" />
                {/* Vivid orange, not --gold: the deep burnt orange is tuned for
                    paper and drops to ~2.5:1 against this ink chip. */}
                <span className="text-xs font-bold text-orange" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{anime.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Status Badge */}
            <div 
              className="absolute left-2 top-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Opaque blocks, not translucent tints: this badge sits over
                  arbitrary key art, so a tinted background would take its
                  contrast from whatever poster happens to be behind it.
                  Mint mirrors the hero's LIVE_NOW badge. */}
              <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border-2 border-ink ${
                anime.status === 'airing'
                  ? 'bg-mint text-ink'
                  : anime.status === 'upcoming'
                  ? 'bg-orange text-ink'
                  : 'bg-paper text-ink'
              }`} style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                {anime.status.toUpperCase()}
              </span>
            </div>

            {/* Hover Content */}
            {anime.description && (
              <div 
                className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 line-clamp-3 text-xs text-white/80 leading-relaxed" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {anime.description}
                </p>
                {anime.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {anime.genres.slice(0, 3).map((genre) => (
                      <span
                        key={genre}
                        className="bg-orange px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-ink"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title and Info */}
          <div className="p-3 sm:p-3.5">
            <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-gold" style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif', fontSize: '15px', lineHeight: '1.3' }}>
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {anime.year && <span>{anime.year}</span>}
              {anime.year && anime.episodes && <span className="text-gold/20">◆</span>}
              {anime.episodes && <span>{anime.episodes} eps</span>}
            </div>
          </div>
        </div>
      </Link>
      </motion.div>

      {showPreview && previewPosition && typeof window !== 'undefined' && createPortal(
        <motion.div
          ref={previewRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="hidden lg:block fixed z-[9999] w-80 rounded-lg border border-ink/35 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/50"
          style={{ 
            pointerEvents: 'none',
            top: `${previewPosition.top}px`,
            left: `${previewPosition.left}px`,
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'absolute',
            zIndex: 9999
          }}
        >
          <div className="p-4">
            {/* Gold accent line */}
            <div className="mb-3 h-[1px] bg-gradient-to-r from-crimson via-gold/30 to-transparent" />
            
            <h3 className="mb-2 text-lg font-bold text-foreground line-clamp-2" style={{ fontFamily: 'Outfit, ui-sans-serif, sans-serif' }}>
              {displayTitle}
            </h3>
            
            {anime.genres.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {anime.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-sm border border-ink/35 bg-gold/5 px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase text-gold/70"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {anime.description && (
              <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {anime.description.length > 120 
                  ? `${anime.description.substring(0, 120)}...` 
                  : anime.description}
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-4 text-[11px] text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {anime.year && <span>{anime.year}</span>}
              {anime.episodes && <span>{anime.episodes} episodes</span>}
              {anime.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 star-gold" />
                  <span className="font-semibold text-gold">{anime.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>,
        document.body
      )}
    </>
  );
}
