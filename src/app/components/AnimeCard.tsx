import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Anime } from '@/services/anime';

interface AnimeCardProps {
  anime: Anime;
  index: number;
}


export function AnimeCard({ anime, index }: AnimeCardProps) {
  const navigate = useNavigate();
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05 }}
        whileHover={{ y: typeof window !== 'undefined' && 'ontouchstart' in window ? 0 : -8, transition: { duration: 0.2 } }}
        className="group relative w-full"
        onMouseEnter={typeof window !== 'undefined' && 'ontouchstart' in window ? undefined : handleMouseEnter}
        onMouseLeave={typeof window !== 'undefined' && 'ontouchstart' in window ? undefined : handleMouseLeave}
      >
        <Link 
          to={`/anime/${anime.id}`} 
          onClick={handleClick}
          className="block h-full cursor-pointer"
        >
        <div className="relative h-full rounded-xl bg-card shadow-lg shadow-black/20 transition-shadow duration-300 group-hover:shadow-2xl group-hover:shadow-primary/20">
          {/* Image Container */}
          <div className="relative aspect-[2/3] w-full overflow-hidden">
            {anime.cover_image ? (
              <img
                src={anime.cover_image}
                alt={anime.title || 'Anime'}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  // Fallback to gradient if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.parentElement?.querySelector('.image-fallback') as HTMLDivElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
            ) : null}
            <div className={`image-fallback h-full w-full bg-gradient-to-br from-primary to-purple-600 ${anime.cover_image ? 'hidden' : 'block'}`} />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            
            {/* Rating Badge */}
            {anime.rating && (
              <div 
                className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium text-white">{anime.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Status Badge */}
            <div 
              className="absolute left-3 top-3"
              onClick={(e) => e.stopPropagation()}
            >
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${
                anime.status === 'airing' 
                  ? 'bg-green-500/80 text-white' 
                  : anime.status === 'upcoming'
                  ? 'bg-blue-500/80 text-white'
                  : 'bg-gray-500/80 text-white'
              }`}>
                {anime.status.toUpperCase()}
              </span>
            </div>

            {/* Hover Content */}
            {anime.description && (
              <div 
                className="absolute inset-x-0 bottom-0 translate-y-2 p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 line-clamp-3 text-sm text-white/90">
                  {anime.description}
                </p>
                {anime.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {anime.genres.slice(0, 3).map((genre) => (
                      <span
                        key={genre}
                        className="rounded-md bg-primary/80 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
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
          <div className="p-3 sm:p-4 md:p-5">
            <h3 className="mb-2 line-clamp-2 text-sm sm:text-base font-semibold text-foreground transition-colors group-hover:text-primary">
              {anime.title}
            </h3>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              {anime.year && <span>{anime.year}</span>}
              {anime.year && anime.episodes && <span>•</span>}
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
          className="hidden lg:block fixed z-[9999] w-80 rounded-xl border border-border bg-card shadow-2xl"
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
            <h3 className="mb-2 text-lg font-bold text-foreground line-clamp-2">
              {anime.title}
            </h3>
            
            {anime.genres.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {anime.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {anime.description && (
              <p className="text-sm text-muted-foreground line-clamp-4">
                {anime.description.length > 120 
                  ? `${anime.description.substring(0, 120)}...` 
                  : anime.description}
              </p>
            )}

            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {anime.year && <span>{anime.year}</span>}
              {anime.episodes && <span>{anime.episodes} episodes</span>}
              {anime.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-foreground">{anime.rating.toFixed(1)}</span>
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
