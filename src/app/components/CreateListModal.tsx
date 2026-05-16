import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (listData: { name: string; description: string; isPrivate: boolean }) => void;
}

export function CreateListModal({ isOpen, onClose, onSave }: CreateListModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, isPrivate });
    setName('');
    setDescription('');
    setIsPrivate(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full h-full sm:h-auto sm:max-w-md sm:rounded-lg border-0 sm:border border-gold/10 bg-card p-5 sm:p-6 shadow-2xl shadow-black/50 sm:my-auto"
            >
              {/* Decorative top line */}
              <div className="mb-5 h-[1px] bg-gradient-to-r from-transparent via-gold/15 to-transparent" />

              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>
                  Create Collection
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* List Name */}
                <div>
                  <label htmlFor="listName" className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Name
                  </label>
                  <input
                    id="listName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Watchlist"
                    required
                    className="input-imperial min-h-[44px]"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/60" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A collection of anime I plan to watch..."
                    rows={3}
                    className="input-imperial resize-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* Privacy Toggle */}
                <div className="flex items-center justify-between rounded-md border border-gold/10 bg-input-background p-4">
                  <div>
                    <p className="font-medium text-sm text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>Private Collection</p>
                    <p className="text-xs text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>Only you can see this</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      isPrivate ? 'bg-crimson' : 'bg-charcoal'
                    }`}
                  >
                    <motion.div
                      animate={{ x: isPrivate ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-imperial-outline flex-1 min-h-[48px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="btn-imperial flex-1 min-h-[48px] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Create Collection
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
