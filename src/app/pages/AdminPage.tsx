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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5824cb17-eaa4-4a83-9afc-c5dcf49adef7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminPage.tsx:22',message:'loadComments effect',data:{filter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    loadComments();
  }, [filter]);

  const loadComments = async () => {
    setLoading(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5824cb17-eaa4-4a83-9afc-c5dcf49adef7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminPage.tsx:26',message:'loadComments called',data:{filter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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

      if (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5824cb17-eaa4-4a83-9afc-c5dcf49adef7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminPage.tsx:48',message:'loadComments error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw error;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5824cb17-eaa4-4a83-9afc-c5dcf49adef7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminPage.tsx:51',message:'loadComments success',data:{count:data?.length||0,filter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/20">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground">Moderate user comments and content</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm font-medium text-muted-foreground">Reported</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{reportedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">Resolved</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {comments.length - reportedCount}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Total Comments</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{comments.length}</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('reported')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === 'reported'
                ? 'bg-primary text-white'
                : 'border border-border bg-transparent text-foreground hover:bg-accent'
            }`}
          >
            Reported ({reportedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary text-white'
                : 'border border-border bg-transparent text-foreground hover:bg-accent'
            }`}
          >
            All Comments ({comments.length})
          </button>
        </div>

        {/* Comments Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">User</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Comment</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-muted-foreground">Loading...</p>
                    </td>
                  </tr>
                ) : comments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-muted-foreground">No comments to display</p>
                    </td>
                  </tr>
                ) : (
                  comments.map((comment, index) => (
                    <motion.tr
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {comment.user?.username?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-foreground">{comment.user?.username || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="max-w-md truncate text-sm text-foreground">{comment.content}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {comment.reported ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Reported
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500">
                            <Check className="h-3 w-3" />
                            Resolved
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {comment.reported && (
                            <button
                              onClick={() => handleIgnore(comment.id)}
                              className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                            >
                              Ignore
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                          >
                            <Trash2 className="h-4 w-4" />
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
