import { useState, useEffect } from 'react';
import { Shield, Trash2, Check, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '@/services/supabase';

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  reported: boolean;
  user: {
    username: string;
  };
};

export default function AdminPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'reported'>('reported');

  useEffect(() => {
    loadComments();
  }, [filter]);

  const loadComments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('comments')
        .select(`
          id,
          user_id,
          content,
          created_at,
          reported,
          user:users!comments_user_id_fkey (
            username
          )
        `);
      
      if (filter === 'reported') {
        query = query.eq('reported', true);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setComments((data || []) as Comment[]);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      setComments(comments.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleIgnore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ reported: false })
        .eq('id', id);
      if (error) throw error;
      setComments(comments.map(c => 
        c.id === id ? { ...c, reported: false } : c
      ));
    } catch (error) {
      console.error('Error ignoring report:', error);
    }
  };

  const reportedCount = comments.filter(c => c.reported).length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-crimson/10 border border-crimson/15">
              <Shield className="h-6 w-6 text-crimson" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>Governance</h1>
              <p className="text-xs text-muted-foreground tracking-wider uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>Moderate comments and content</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-gold/[0.06] bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>Reported</span>
              </div>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{reportedCount}</p>
            </div>
            <div className="rounded-md border border-gold/[0.06] bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Check className="h-4 w-4 text-bamboo" />
                <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>Resolved</span>
              </div>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {comments.length - reportedCount}
              </p>
            </div>
            <div className="rounded-md border border-gold/[0.06] bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-crimson" />
                <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>Total</span>
              </div>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{comments.length}</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('reported')}
            className={`rounded-md px-4 py-2 text-xs font-medium tracking-wider uppercase transition-all min-h-[40px] ${
              filter === 'reported'
                ? 'bg-crimson text-white shadow-lg shadow-crimson/20'
                : 'border border-gold/10 bg-transparent text-foreground hover:bg-accent'
            }`}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Reported ({reportedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-4 py-2 text-xs font-medium tracking-wider uppercase transition-all min-h-[40px] ${
              filter === 'all'
                ? 'bg-crimson text-white shadow-lg shadow-crimson/20'
                : 'border border-gold/10 bg-transparent text-foreground hover:bg-accent'
            }`}
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            All ({comments.length})
          </button>
        </div>

        {/* Comments Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-md border border-gold/[0.06] bg-card"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gold/[0.06] bg-ink/30">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>User</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>Comment</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>Status</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-wider uppercase text-gold/50" style={{ fontFamily: 'Outfit, sans-serif' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gold/30 border-t-crimson" />
                    </td>
                  </tr>
                ) : comments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>No entries to display</p>
                    </td>
                  </tr>
                ) : (
                  comments.map((comment, index) => (
                    <motion.tr
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-crimson/10 text-[10px] font-bold text-crimson border border-crimson/10">
                            {comment.user?.username?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-sm text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{comment.user?.username || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-md truncate text-sm text-foreground/70" style={{ fontFamily: 'Outfit, sans-serif' }}>{comment.content}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {comment.reported ? (
                          <span className="badge-imperial badge-crimson">
                            <AlertCircle className="h-3 w-3" />
                            Reported
                          </span>
                        ) : (
                          <span className="badge-imperial badge-bamboo">
                            <Check className="h-3 w-3" />
                            Resolved
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {comment.reported && (
                            <button
                              onClick={() => handleIgnore(comment.id)}
                              className="rounded-md border border-gold/10 bg-transparent px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase text-foreground transition-all hover:bg-accent hover:border-gold/20"
                              style={{ fontFamily: 'Outfit, sans-serif' }}
                            >
                              Ignore
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="rounded-md bg-destructive/10 px-3 py-1.5 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
