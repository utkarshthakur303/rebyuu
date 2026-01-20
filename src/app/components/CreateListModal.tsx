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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl border-0 sm:border border-border/50 bg-card p-4 sm:p-6 shadow-2xl shadow-black/40 sm:my-auto"
            >
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-2xl font-bold text-transparent">
                  Create New List
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* List Name */}
                <div>
                  <label htmlFor="listName" className="mb-2 block text-sm font-medium text-foreground">
                    List Name
                  </label>
                  <input
                    id="listName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Watchlist"
                    required
                    className="w-full rounded-lg border border-border bg-input-background px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="mb-2 block text-sm font-medium text-foreground">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A collection of anime I plan to watch..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-input-background px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* Privacy Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-input-background p-4">
                  <div>
                    <p className="font-medium text-foreground">Private List</p>
                    <p className="text-sm text-muted-foreground">Only you can see this list</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      isPrivate ? 'bg-primary' : 'bg-muted'
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
                    className="flex-1 rounded-lg border border-border bg-transparent px-4 py-3 font-medium text-foreground transition-colors hover:bg-accent min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="flex-1 rounded-lg bg-gradient-to-r from-primary to-purple-600 px-4 py-3 font-medium text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    Create List
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
