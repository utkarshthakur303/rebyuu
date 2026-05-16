import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, borderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { getEpisodeRatings, getEpisodeComments } from '../services/anime';
import { sanitizeComment } from '../utils/sanitize';

export default function EpisodeModal({ isOpen, onClose, animeId, episodeNumber, animeTitle }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userEpisodeRating, setUserEpisodeRating] = useState(null);

  const loadData = useCallback(async () => {
    if (!animeId || !episodeNumber) return;
    setLoading(true);
    try {
      const [commentsData, ratingsData] = await Promise.all([
        getEpisodeComments(animeId, episodeNumber),
        getEpisodeRatings(animeId, episodeNumber),
      ]);
      setComments(commentsData);
      if (user) {
        const userRating = ratingsData.find((r) => r.user_id === user.id);
        if (userRating) {
          setRating(userRating.rating);
          setUserEpisodeRating({ id: userRating.id, rating: userRating.rating });
        } else {
          setRating(0);
          setUserEpisodeRating(null);
        }
      }
    } catch (error) {
      console.error('Error loading episode data:', error);
    } finally {
      setLoading(false);
    }
  }, [animeId, episodeNumber, user]);

  useEffect(() => {
    if (isOpen && animeId && episodeNumber) {
      loadData();
    } else {
      setRating(0);
      setComment('');
      setComments([]);
      setUserEpisodeRating(null);
    }
  }, [isOpen, animeId, episodeNumber, loadData]);

  const handleSubmitRating = async () => {
    if (!user || !rating || !animeId || !episodeNumber || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('episode_ratings')
        .upsert(
          {
            user_id: user.id,
            anime_id: animeId,
            episode_number: episodeNumber,
            rating,
          },
          { onConflict: 'user_id,anime_id,episode_number' }
        )
        .select('id, rating')
        .single();
      if (error) {
        Alert.alert('Error', error.message || 'Failed to save rating');
        return;
      }
      if (data) {
        setUserEpisodeRating({ id: data.id, rating: data.rating });
        Alert.alert('Success', 'Rating saved');
      }
    } catch {
      Alert.alert('Error', 'Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !comment.trim() || !animeId || !episodeNumber || submitting) return;
    setSubmitting(true);
    try {
      const sanitizedContent = sanitizeComment(comment.trim());
      if (!sanitizedContent) {
        Alert.alert('Error', 'Comment cannot be empty');
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.from('episode_comments').insert({
        user_id: user.id,
        anime_id: animeId,
        episode_number: episodeNumber,
        content: sanitizedContent,
      });
      if (error) {
        Alert.alert('Error', error.message || 'Failed to post comment');
        return;
      }
      setComment('');
      await loadData();
      Alert.alert('Success', 'Comment posted');
    } catch {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('episode_comments')
            .delete()
            .eq('id', commentId)
            .eq('user_id', user.id);
          if (error) {
            Alert.alert('Error', 'Failed to delete comment');
            return;
          }
          setComments((prev) => prev.filter((c) => c.id !== commentId));
        },
      },
    ]);
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Episode {episodeNumber}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{animeTitle}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {user && (
            <>
              {/* Rating */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rate this episode</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRating(r)}
                      style={[
                        styles.ratingButton,
                        rating >= r ? styles.ratingButtonActive : styles.ratingButtonInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingButtonText,
                          rating >= r ? styles.ratingButtonTextActive : styles.ratingButtonTextInactive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {rating > 0 && (
                  <View style={styles.ratingActions}>
                    <TouchableOpacity
                      onPress={handleSubmitRating}
                      disabled={submitting}
                      style={[styles.saveRatingButton, submitting && styles.disabled]}
                    >
                      <Text style={styles.saveRatingText}>
                        {submitting ? 'Saving...' : 'Save Rating'}
                      </Text>
                    </TouchableOpacity>
                    {userEpisodeRating && (
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Delete Rating', 'Delete your rating?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                const { error } = await supabase
                                  .from('episode_ratings')
                                  .delete()
                                  .eq('id', userEpisodeRating.id)
                                  .eq('user_id', user.id);
                                if (!error) {
                                  setRating(0);
                                  setUserEpisodeRating(null);
                                }
                              },
                            },
                          ]);
                        }}
                        style={styles.deleteRatingButton}
                      >
                        <Text style={styles.deleteText}>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Comment Input */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add a comment</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share your thoughts..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  style={styles.commentInput}
                />
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  disabled={!comment.trim() || submitting}
                  style={[styles.postButton, (!comment.trim() || submitting) && styles.disabled]}
                >
                  <Text style={styles.postButtonText}>
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {!user && (
            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>
                Please log in to rate and comment on episodes
              </Text>
            </View>
          )}

          {/* Comments List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              💬 Comments ({comments.length})
            </Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentUser}>
                      {c.user.avatar_url ? (
                        <Image source={{ uri: c.user.avatar_url }} style={styles.commentAvatar} />
                      ) : (
                        <View style={styles.commentAvatarPlaceholder}>
                          <Text style={styles.commentAvatarText}>
                            {c.user.username.charAt(0)}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.commentUsername}>{c.user.username}</Text>
                        <Text style={styles.commentDate}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    {user && c.user_id === user.id && (
                      <TouchableOpacity onPress={() => handleDeleteComment(c.id)}>
                        <Text style={styles.deleteText}>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.commentContent}>{c.content}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  headerSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeText: { fontSize: 18, color: colors.mutedForeground },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ratingButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  ratingButtonText: { fontSize: 14, fontWeight: '600' },
  ratingButtonTextActive: { color: '#fff' },
  ratingButtonTextInactive: { color: colors.mutedForeground },
  ratingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  saveRatingButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveRatingText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteRatingButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteText: { fontSize: 16, color: colors.destructive },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  postButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  postButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  loginPrompt: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginPromptText: { fontSize: 14, color: colors.mutedForeground },
  emptyText: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: 14,
    paddingVertical: 32,
  },
  commentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  commentUsername: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  commentDate: { fontSize: 12, color: colors.mutedForeground },
  commentContent: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
});
