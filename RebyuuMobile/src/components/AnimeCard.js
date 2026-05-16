import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - CARD_GAP) / 2;

export default function AnimeCard({ anime, index, onPress, cardWidth }) {
  const width = cardWidth || CARD_WIDTH;
  const imageHeight = width * 1.5;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(anime)}
      style={[styles.container, { width }]}
    >
      <View style={[styles.card, { width }]}>
        {/* Image */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          {anime.cover_image ? (
            <Image
              source={{ uri: anime.cover_image }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.primary, colors.gradientPurpleEnd]}
              style={styles.image}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          {/* Rating Badge */}
          {anime.rating != null && (
            <View style={styles.ratingBadge}>
              <Text style={styles.starIcon}>★</Text>
              <Text style={styles.ratingText}>{anime.rating.toFixed(1)}</Text>
            </View>
          )}

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              anime.status === 'airing'
                ? styles.statusAiring
                : anime.status === 'upcoming'
                ? styles.statusUpcoming
                : styles.statusCompleted,
            ]}
          >
            <Text style={styles.statusText}>
              {anime.status?.toUpperCase() || 'N/A'}
            </Text>
          </View>

          {/* Bottom gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.imageOverlay}
          />
        </View>

        {/* Title and info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {anime.title}
          </Text>
          <View style={styles.meta}>
            {anime.year && <Text style={styles.metaText}>{anime.year}</Text>}
            {anime.year && anime.episodes && (
              <Text style={styles.metaDot}>•</Text>
            )}
            {anime.episodes && (
              <Text style={styles.metaText}>{anime.episodes} eps</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blackAlpha70,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  starIcon: {
    fontSize: 12,
    color: colors.starYellow,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusAiring: {
    backgroundColor: 'rgba(34, 197, 94, 0.85)',
  },
  statusUpcoming: {
    backgroundColor: 'rgba(59, 130, 246, 0.85)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(107, 114, 128, 0.85)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  metaDot: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
});
