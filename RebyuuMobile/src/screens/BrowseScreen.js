import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, borderRadius } from '../theme/colors';
import { getAnimeListPaginated, genres, years, seasons, statuses } from '../services/anime';
import { sanitizeSearchQuery } from '../utils/sanitize';
import AnimeCard from '../components/AnimeCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - CARD_GAP) / 2;

export default function BrowseScreen({ navigation, route }) {
  const genreParam = route?.params?.genre || '';

  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (genreParam) {
      const g = genreParam.charAt(0).toUpperCase() + genreParam.slice(1);
      if (genres.includes(g)) {
        setSelectedGenres([g]);
      }
    }
  }, []);

  const loadAnime = useCallback(
    async (pageNum, isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const sanitizedQuery = searchQuery.trim() ? sanitizeSearchQuery(searchQuery.trim()) : undefined;
        const { data, totalCount: count, totalPages: pages } = await getAnimeListPaginated(
          {
            genres: selectedGenres.length > 0 ? selectedGenres : undefined,
            year: selectedYear || undefined,
            season: selectedSeason || undefined,
            status: selectedStatus !== 'all' ? selectedStatus : undefined,
            query: sanitizedQuery,
          },
          pageNum,
          24
        );
        setAnimeList(data);
        setTotalCount(count || 0);
        setTotalPages(pages || 1);
      } catch (error) {
        console.error('Error loading anime:', error);
        setAnimeList([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedGenres, selectedYear, selectedSeason, selectedStatus, searchQuery]
  );

  useEffect(() => {
    setPage(1);
    loadAnime(1);
  }, [selectedGenres, selectedYear, selectedSeason, selectedStatus, searchQuery, loadAnime]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnime(page, true);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      loadAnime(newPage);
    }
  };

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
    setSelectedSeason(null);
    setSelectedStatus('all');
  };

  const hasActiveFilters =
    selectedGenres.length > 0 || selectedYear || selectedSeason || selectedStatus !== 'all';

  const navigateToAnime = (anime) => {
    navigation.navigate('AnimeDetail', { id: anime.id });
  };

  const renderItem = ({ item, index }) => (
    <AnimeCard
      anime={item}
      index={index}
      onPress={navigateToAnime}
      cardWidth={CARD_WIDTH}
    />
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search anime..."
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={styles.filterButton}
        >
          <Text style={styles.filterIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Browse Anime</Text>
          <Text style={styles.headerSubtitle}>
            {loading
              ? 'Loading...'
              : searchQuery
              ? `Results for "${searchQuery}"`
              : totalCount > 0
              ? `${totalCount} anime found`
              : 'No anime found'}
          </Text>
        </View>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {selectedGenres.map((g) => (
            <TouchableOpacity key={g} onPress={() => toggleGenre(g)} style={styles.activeChip}>
              <Text style={styles.activeChipText}>{g} ✕</Text>
            </TouchableOpacity>
          ))}
          {selectedStatus !== 'all' && (
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>{selectedStatus}</Text>
            </View>
          )}
          {selectedYear && (
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>{selectedYear}</Text>
            </View>
          )}
          {selectedSeason && (
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>{selectedSeason}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Anime Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : animeList.length > 0 ? (
        <FlatList
          data={animeList}
          numColumns={2}
          keyExtractor={(item, idx) => `${item.id}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  style={[styles.pageButton, page === 1 && styles.disabled]}
                >
                  <Text style={styles.pageButtonText}>‹ Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {page} / {totalPages}
                </Text>
                <TouchableOpacity
                  onPress={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  style={[styles.pageButton, page === totalPages && styles.disabled]}
                >
                  <Text style={styles.pageButtonText}>Next ›</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No anime found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different search' : 'Try adjusting your filters'}
          </Text>
        </View>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.filterModal}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.filterModalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.filterModalContent}>
            {/* Status */}
            <Text style={styles.filterSectionTitle}>Status</Text>
            <View style={styles.filterGroup}>
              {statuses.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setSelectedStatus(status)}
                  style={[
                    styles.filterOption,
                    selectedStatus === status && styles.filterOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedStatus === status && styles.filterOptionTextActive,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Genres */}
            <Text style={styles.filterSectionTitle}>Genres</Text>
            <View style={styles.genreChips}>
              {genres.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  onPress={() => toggleGenre(genre)}
                  style={[
                    styles.genreChip,
                    selectedGenres.includes(genre) && styles.genreChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.genreChipText,
                      selectedGenres.includes(genre) && styles.genreChipTextActive,
                    ]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Season */}
            <Text style={styles.filterSectionTitle}>Season</Text>
            <View style={styles.seasonGrid}>
              {seasons.map((season) => (
                <TouchableOpacity
                  key={season}
                  onPress={() =>
                    setSelectedSeason(selectedSeason === season ? null : season)
                  }
                  style={[
                    styles.seasonButton,
                    selectedSeason === season && styles.seasonButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.seasonText,
                      selectedSeason === season && styles.seasonTextActive,
                    ]}
                  >
                    {season}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Year */}
            <Text style={styles.filterSectionTitle}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => setSelectedYear(null)}
                style={[
                  styles.yearChip,
                  !selectedYear && styles.yearChipActive,
                ]}
              >
                <Text style={[styles.yearChipText, !selectedYear && styles.yearChipTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  onPress={() => setSelectedYear(year)}
                  style={[
                    styles.yearChip,
                    selectedYear === year && styles.yearChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.yearChipText,
                      selectedYear === year && styles.yearChipTextActive,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Apply button */}
          <View style={styles.filterApply}>
            <TouchableOpacity
              onPress={() => setShowFilters(false)}
              style={styles.applyButton}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  clearSearch: { padding: 4 },
  clearSearchText: { fontSize: 16, color: colors.mutedForeground },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: { fontSize: 18, color: '#fff' },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  // Chips
  chipRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
    maxHeight: 40,
  },
  activeChip: {
    backgroundColor: colors.primaryAlpha20,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  // Grid
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: colors.mutedForeground },
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  pageButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pageButtonText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  pageInfo: { fontSize: 14, color: colors.mutedForeground },
  disabled: { opacity: 0.4 },
  // Filter Modal
  filterModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterModalTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  filterModalClose: { fontSize: 20, color: colors.mutedForeground, padding: 4 },
  filterModalContent: { flex: 1, padding: 20 },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
    marginTop: 8,
  },
  filterGroup: { marginBottom: 20 },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  filterOptionActive: { backgroundColor: colors.primary },
  filterOptionText: { fontSize: 14, color: colors.foreground },
  filterOptionTextActive: { color: '#fff', fontWeight: '600' },
  genreChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  genreChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  genreChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genreChipText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  genreChipTextActive: { color: '#fff' },
  seasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  seasonButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '48%',
    alignItems: 'center',
  },
  seasonButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  seasonText: { fontSize: 14, color: colors.foreground },
  seasonTextActive: { color: '#fff', fontWeight: '600' },
  yearChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  yearChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  yearChipText: { fontSize: 13, color: colors.foreground },
  yearChipTextActive: { color: '#fff', fontWeight: '600' },
  filterApply: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
