import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function UserDropdown() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    setOpen(false);
  };

  const displayName = user.email?.split('@')[0] || 'User';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-all hover:bg-accent group"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-crimson to-crimson-dark text-[10px] font-bold text-white border border-gold/10 group-hover:border-gold/20 transition-colors">
          {initials}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-gold/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-gold/10 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40"
          >
            {/* Decorative top line */}
            <div className="h-[1px] bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
            
            <div className="p-1.5">
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-xs tracking-wider text-foreground/70 transition-all hover:bg-accent hover:text-foreground"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <User className="h-3.5 w-3.5 text-gold/40" />
                Profile
              </Link>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-xs tracking-wider text-foreground/70 transition-all hover:bg-accent hover:text-foreground"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <Settings className="h-3.5 w-3.5 text-gold/40" />
                Settings
              </Link>
              <div className="my-1 h-px bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs tracking-wider text-foreground/70 transition-all hover:bg-destructive/10 hover:text-destructive"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
