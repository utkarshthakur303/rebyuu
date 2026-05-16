import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius } from '../theme/colors';
import { getTrendingAnime, getFanFavorites, getAiringNow, getUpcoming } from '../services/anime';
import { useAuth } from '../context/AuthContext';
import AnimeCard from '../components/AnimeCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_CARD_WIDTH = 150;

export default function LandingScreen({ navigation }) {
  const { user } = useAuth();
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [fanFavorites, setFanFavorites] = useState([]);
  const [airingNow, setAiringNow] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const popularGenres = ['Action', 'Fantasy', 'Comedy', 'Romance', 'Sci-Fi', 'Horror'];

  const loadAll = async () => {
    try {
      const [t, f, a, u] = await Promise.all([
        getTrendingAnime(12),
        getFanFavorites(12),
        getAiringNow(12),
        getUpcoming(12),
      ]);
      setTrendingAnime(t);
      setFanFavorites(f);
      setAiringNow(a);
      setUpcoming(u);
    } catch (error) {
      console.error('Error loading home sections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const navigateToAnime = (anime) => {
    navigation.navigate('AnimeDetail', { id: anime.id });
  };

  const HorizontalSection = ({ title, items }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('BrowseTab')}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>Nothing here yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item, index }) => (
            <AnimeCard
              anime={item}
              index={index}
              onPress={navigateToAnime}
              cardWidth={HORIZONTAL_CARD_WIDTH}
            />
          )}
        />
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Hero Section */}
      <View style={styles.hero}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=800' }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[colors.background, 'rgba(10,10,15,0.7)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroOverlayH}
        />
        <LinearGradient
          colors={['transparent', colors.background]}
          style={styles.heroOverlayV}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeIcon}>✦</Text>
            <Text style={styles.heroBadgeText}>Discover Your Next Favorite</Text>
          </View>
          <Text style={styles.heroTitle}>Explore the World of Anime</Text>
          <Text style={styles.heroSubtitle}>
            Discover, track, and share your anime journey.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('BrowseTab')}
            style={styles.heroButtonWrapper}
          >
            <LinearGradient
              colors={[colors.primary, colors.gradientPurpleEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroButton}
            >
              <Text style={styles.heroButtonText}>Explore Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Anime Sections */}
      <HorizontalSection title="Trending" items={trendingAnime} />
      <HorizontalSection title="Fan Favorites" items={fanFavorites} />
      <HorizontalSection title="Airing Now" items={airingNow} />
      <HorizontalSection title="Upcoming" items={upcoming} />

      {/* Popular Genres */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Popular Genres</Text>
        </View>
        <View style={styles.genreGrid}>
          {popularGenres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={styles.genreCard}
              onPress={() => navigation.navigate('BrowseTab', { genre: genre.toLowerCase() })}
            >
              <Text style={styles.genreText}>{genre}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* CTA for non-logged-in users */}
      {!user && (
        <View style={styles.ctaSection}>
          <LinearGradient
            colors={[colors.primaryAlpha10, 'rgba(147, 51, 234, 0.1)', colors.primaryAlpha10]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaCard}
          >
            <Text style={styles.ctaTitle}>Ready to Start Your Journey?</Text>
            <Text style={styles.ctaSubtitle}>
              Join our community and discover thousands of anime series
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.ctaButtonWrapper}
            >
              <LinearGradient
                colors={[colors.primary, colors.gradientPurpleEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaButtonText}>Sign Up Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Hero
  hero: {
    height: 340,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroOverlayH: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlayV: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  heroContent: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAlpha10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  heroBadgeIcon: { fontSize: 14, color: colors.primary },
  heroBadgeText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.foreground,
    marginBottom: 6,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    marginBottom: 16,
    lineHeight: 22,
  },
  heroButtonWrapper: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Sections
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionAccent: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  horizontalList: {
    paddingRight: 16,
    gap: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonCard: {
    width: HORIZONTAL_CARD_WIDTH,
    height: HORIZONTAL_CARD_WIDTH * 1.5 + 60,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
  },
  emptySection: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14 },
  // Genres
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genreCard: {
    width: (SCREEN_WIDTH - 16 * 2 - 10 * 2) / 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: 20,
    alignItems: 'center',
  },
  genreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  // CTA
  ctaSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  ctaCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  ctaButtonWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  ctaButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
