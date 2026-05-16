import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="relative border-t border-border/30 bg-obsidian pb-20 md:pb-0">
      {/* Atmospheric gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-crimson/[0.02] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <img
                src="/rebyuu-logo.png"
                alt="Rebyuu"
                className="h-14 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>
              A sacred digital archive for anime culture. Discover, track, and review your favorite anime in a premium cinematic experience inspired by the elegance of imperial Japan.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-gold/40" style={{ fontFamily: 'Outfit, sans-serif' }}>
                武士道 · The Way of the Warrior
              </span>
            </div>
          </div>

          {/* Navigation Column */}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-gold/60 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Navigate
            </h4>
            <nav className="space-y-2.5">
              {[
                { to: '/', label: 'Discover' },
                { to: '/browse', label: 'Browse' },
                { to: '/login', label: 'Join Archive' },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block text-sm text-muted-foreground hover:text-gold transition-colors duration-300"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Info Column */}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-gold/60 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Archive
            </h4>
            <nav className="space-y-2.5">
              {[
                { to: '/profile', label: 'Profile' },
                { to: '/lists', label: 'Collections' },
                { to: '/admin', label: 'Governance' },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block text-sm text-muted-foreground hover:text-gold transition-colors duration-300"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-border/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground/50" style={{ fontFamily: 'Outfit, sans-serif' }}>
              © {new Date().getFullYear()} Rebyuu. All rights reserved.
            </p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground/30 tracking-widest uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Built with honor
              </span>
              <span className="text-crimson/40 text-xs">◆</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
