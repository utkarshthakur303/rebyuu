import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius } from '../theme/colors';
import { getAnimeById, getAnimeReviews } from '../services/anime';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { sanitizeComment } from '../utils/sanitize';
import EpisodeModal from '../components/EpisodeModal';
import ListPickerModal from '../components/ListPickerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AnimeDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [anime, setAnime] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showListPicker, setShowListPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadAnime = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAnimeById(id);
      setAnime(data);
    } catch (error) {
      console.error('Error loading anime:', error);
      setAnime(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getAnimeReviews(id);
      setReviews(data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }, [id]);

  useEffect(() => {
    loadAnime().then(() => loadReviews());
  }, [id]);

  const handleSubmitReview = async () => {
    if (!user || !id || !userRating || !review.trim() || submitting) return;
    setSubmitting(true);
    try {
      const sanitizedContent = sanitizeComment(review.trim());
      if (!sanitizedContent) {
        Alert.alert('Error', 'Review cannot be empty');
        setSubmitting(false);
        return;
      }
      // Save rating
      if (userRating > 0) {
        const { error: ratingErr } = await supabase.from('ratings').upsert({
          user_id: user.id,
          anime_id: id,
          rating: userRating,
        });
        if (ratingErr) {
          Alert.alert('Error', ratingErr.message || 'Failed to save rating');
        }
      }
      // Save comment
      const { error: commentErr } = await supabase.from('comments').insert({
        user_id: user.id,
        anime_id: id,
        content: sanitizedContent,
      });
      if (commentErr) {
        Alert.alert('Error', commentErr.message || 'Failed to post review');
        setSubmitting(false);
        return;
      }
      setReview('');
      setUserRating(0);
      await loadReviews();
      Alert.alert('Success', 'Review posted');
    } catch {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    Alert.alert('Delete Review', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', reviewId)
            .eq('user_id', user.id);
          if (error) {
            Alert.alert('Error', 'Failed to delete review');
          } else {
            setReviews((prev) => prev.filter((r) => r.id !== reviewId));
          }
        },
      },
    ]);
  };

  if (loading && !anime) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!anime) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Anime not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        {/* Banner */}
        <View style={styles.banner}>
          {(anime.banner_image || anime.cover_image) ? (
            <Image
              source={{ uri: anime.banner_image || anime.cover_image }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.primary, colors.gradientPurpleEnd]}
              style={styles.bannerImage}
            />
          )}
          <LinearGradient
            colors={['transparent', colors.background]}
            style={styles.bannerOverlay}
          />
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Poster + Info Row */}
          <View style={styles.infoRow}>
            {/* Poster */}
            <View style={styles.posterContainer}>
              {anime.cover_image ? (
                <Image
                  source={{ uri: anime.cover_image }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={[colors.primary, colors.gradientPurpleEnd]}
                  style={styles.poster}
                />
              )}
            </View>

            {/* Info */}
            <View style={styles.infoText}>
              <Text style={styles.title} numberOfLines={3}>{anime.title}</Text>

              <View style={styles.metaRow}>
                {anime.rating != null && (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.starIcon}>★</Text>
                    <Text style={styles.ratingValue}>{anime.rating.toFixed(1)}</Text>
                    <Text style={styles.ratingMax}>/10</Text>
                  </View>
                )}
                <View style={[
                  styles.statusBadge,
                  anime.status === 'airing'
                    ? { backgroundColor: colors.statusAiringBg }
                    : anime.status === 'upcoming'
                    ? { backgroundColor: colors.statusUpcomingBg }
                    : { backgroundColor: colors.statusCompletedBg },
                ]}>
                  <Text style={[
                    styles.statusText,
                    anime.status === 'airing'
                      ? { color: colors.statusAiring }
                      : anime.status === 'upcoming'
                      ? { color: colors.statusUpcoming }
                      : { color: colors.statusCompleted },
                  ]}>
                    {anime.status?.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                {anime.year && <Text style={styles.metaText}>📅 {anime.year}</Text>}
                {anime.episodes && <Text style={styles.metaText}>🎬 {anime.episodes} Eps</Text>}
              </View>
            </View>
          </View>

          {/* Genres */}
          {anime.genres && anime.genres.length > 0 && (
            <View style={styles.genreRow}>
              {anime.genres.map((genre) => (
                <View key={genre} style={styles.genreTag}>
                  <Text style={styles.genreTagText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {anime.description && (
            <Text style={styles.description}>{anime.description}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {anime.trailer && (
              <TouchableOpacity
                onPress={() => Linking.openURL(anime.trailer)}
                style={styles.trailerButtonWrapper}
              >
                <LinearGradient
                  colors={[colors.primary, colors.gradientPurpleEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.trailerButton}
                >
                  <Text style={styles.trailerButtonText}>▶ Watch Trailer</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowListPicker(true)}
              style={styles.addListButton}
            >
              <Text style={styles.addListText}>+ Add to List</Text>
            </TouchableOpacity>
          </View>

          {/* Episodes */}
          {anime.episodes && anime.episodes > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Episodes</Text>
              <View style={styles.episodeGrid}>
                {Array.from({ length: anime.episodes }, (_, i) => i + 1).map((epNum) => (
                  <TouchableOpacity
                    key={epNum}
                    onPress={() => setSelectedEpisode(epNum)}
                    style={styles.episodeCard}
                  >
                    <View style={styles.episodeNumber}>
                      <Text style={styles.episodeNumberText}>{epNum}</Text>
                    </View>
                    <View style={styles.episodeInfo}>
                      <Text style={styles.episodeTitle}>Episode {epNum}</Text>
                      <Text style={styles.episodeDuration}>24 min</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Reviews Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Reviews</Text>

            {user && (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormTitle}>Write a Review</Text>

                {/* Rating */}
                <Text style={styles.reviewLabel}>Your Rating</Text>
                <View style={styles.ratingButtons}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setUserRating(r)}
                      style={[
                        styles.ratingBtn,
                        userRating >= r ? styles.ratingBtnActive : styles.ratingBtnInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingBtnText,
                          userRating >= r ? { color: '#fff' } : { color: colors.mutedForeground },
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Review Text */}
                <Text style={styles.reviewLabel}>Your Review</Text>
                <TextInput
                  value={review}
                  onChangeText={setReview}
                  placeholder="Share your thoughts..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                  style={styles.reviewInput}
                />

                <TouchableOpacity
                  onPress={handleSubmitReview}
                  disabled={!userRating || !review.trim() || submitting}
                  style={[
                    styles.submitReviewBtn,
                    (!userRating || !review.trim() || submitting) && styles.disabled,
                  ]}
                >
                  <Text style={styles.submitReviewText}>
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!user && (
              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>Please log in to write a review</Text>
              </View>
            )}

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
              </View>
            ) : (
              reviews.map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUser}>
                      {r.user.avatar_url ? (
                        <Image source={{ uri: r.user.avatar_url }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={styles.reviewAvatarPlaceholder}>
                          <Text style={styles.reviewAvatarText}>
                            {r.user.username.charAt(0)}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.reviewUsername}>{r.user.username}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reviewHeaderRight}>
                      {r.rating > 0 && (
                        <View style={styles.reviewRatingBadge}>
                          <Text style={styles.reviewRatingStar}>★</Text>
                          <Text style={styles.reviewRatingValue}>{r.rating}</Text>
                        </View>
                      )}
                      {user && r.user_id === user.id && (
                        <TouchableOpacity onPress={() => handleDeleteReview(r.id)}>
                          <Text style={{ fontSize: 16, color: colors.destructive }}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={styles.reviewContent}>{r.content}</Text>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Modals */}
      {selectedEpisode && (
        <EpisodeModal
          isOpen={!!selectedEpisode}
          onClose={() => setSelectedEpisode(null)}
          animeId={anime?.id || ''}
          episodeNumber={selectedEpisode || 0}
          animeTitle={anime?.title || ''}
        />
      )}
      <ListPickerModal
        isOpen={showListPicker}
        onClose={() => setShowListPicker(false)}
        animeId={anime?.id || ''}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  notFoundText: { color: colors.mutedForeground, fontSize: 16 },
  // Banner
  banner: {
    height: 280,
    position: 'relative',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  backButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: colors.blackAlpha50,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  posterContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  poster: {
    width: 130,
    height: 195,
    borderRadius: borderRadius.lg,
    borderWidth: 3,
    borderColor: colors.background,
  },
  infoText: {
    flex: 1,
    paddingTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 10,
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIcon: { fontSize: 16, color: colors.starYellow },
  ratingValue: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  ratingMax: { fontSize: 13, color: colors.mutedForeground },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaText: { fontSize: 13, color: colors.mutedForeground },
  // Genres
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  genreTag: {
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primaryAlpha10,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreTagText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  // Description
  description: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: 16,
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  trailerButtonWrapper: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  trailerButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  trailerButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  addListButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addListText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  // Episodes
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 14,
  },
  episodeGrid: { gap: 10 },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    gap: 14,
  },
  episodeNumber: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeNumberText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  episodeInfo: { flex: 1 },
  episodeTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  episodeDuration: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  // Reviews
  reviewForm: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewFormTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  reviewLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 },
  ratingButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  ratingBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ratingBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ratingBtnInactive: { backgroundColor: 'transparent', borderColor: colors.border },
  ratingBtnText: { fontSize: 14, fontWeight: '600' },
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitReviewBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitReviewText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.5 },
  loginPrompt: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginPromptText: { fontSize: 14, color: colors.mutedForeground },
  emptyReviews: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14 },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  reviewUsername: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  reviewDate: { fontSize: 12, color: colors.mutedForeground },
  reviewHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  reviewRatingStar: { fontSize: 12, color: colors.primary },
  reviewRatingValue: { fontSize: 13, fontWeight: '700', color: colors.primary },
  reviewContent: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
});
