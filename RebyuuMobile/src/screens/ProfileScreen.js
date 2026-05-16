import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
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
import CreateListModal from '../components/CreateListModal';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('lists');
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [lists, setLists] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [episodeRatings, setEpisodeRatings] = useState([]);
  const [episodeComments, setEpisodeComments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const unifiedRatings = useMemo(() => {
    const ar = ratings.map((r) => ({ ...r, type: 'anime' }));
    const er = episodeRatings.map((r) => ({ ...r, type: 'episode' }));
    return [...ar, ...er].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [ratings, episodeRatings]);

  const unifiedComments = useMemo(() => {
    const ac = reviews.map((c) => ({ ...c, type: 'anime' }));
    const ec = episodeComments.map((c) => ({ ...c, type: 'episode' }));
    return [...ac, ...ec].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [reviews, episodeComments]);

  const stats = useMemo(
    () => [
      { label: 'Lists', value: lists.length },
      { label: 'Ratings', value: ratings.length + episodeRatings.length },
      { label: 'Reviews', value: reviews.length + episodeComments.length },
    ],
    [lists.length, ratings.length, episodeRatings.length, reviews.length, episodeComments.length]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = async () => {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('users')
        .select('id,username,bio,avatar_url')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      if (error) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      setProfile(data);
      setEditBio(data?.bio || '');
      setEditAvatarUrl(data?.avatar_url || '');
      setLoadingProfile(false);
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const LIMIT = 100;
    const run = async () => {
      setLoadingData(true);
      try {
        const [listsRes, ratingsRes, commentsRes, epRatingsRes, epCommentsRes] = await Promise.all([
          supabase.from('lists').select('id,name,description,is_private,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
          supabase.from('ratings').select('id,rating,created_at,anime:anime_index!ratings_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
          supabase.from('comments').select('id,content,created_at,anime:anime_index!comments_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
          supabase.from('episode_ratings').select('id,rating,episode_number,created_at,anime:anime_index!episode_ratings_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
          supabase.from('episode_comments').select('id,content,episode_number,created_at,anime:anime_index!episode_comments_anime_id_fkey(id,title,cover_image)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
        ]);
        if (cancelled) return;
        setLists(listsRes.data || []);
        setRatings(ratingsRes.data || []);
        setReviews(commentsRes.data || []);
        setEpisodeRatings(epRatingsRes.data || []);
        setEpisodeComments(epCommentsRes.data || []);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  const saveProfile = async () => {
    if (!user || !profile) return;
    const { error } = await supabase
      .from('users')
      .update({ bio: editBio.trim() || null, avatar_url: editAvatarUrl.trim() || null })
      .eq('id', user.id);
    if (error) {
      Alert.alert('Error', 'Failed to save profile');
      return;
    }
    setProfile({ ...profile, bio: editBio.trim() || null, avatar_url: editAvatarUrl.trim() || null });
    setEditing(false);
    Alert.alert('Success', 'Profile updated');
  };

  const createList = async (listData) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('lists')
      .insert({ user_id: user.id, name: listData.name.trim(), description: listData.description.trim() || null, is_private: listData.isPrivate })
      .select('id,name,description,is_private,created_at')
      .single();
    if (error) {
      Alert.alert('Error', 'Failed to create list');
      return;
    }
    if (data) setLists((prev) => [data, ...prev]);
  };

  const deleteRating = async (ratingId, type) => {
    Alert.alert('Delete Rating', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const table = type === 'anime' ? 'ratings' : 'episode_ratings';
          const { error } = await supabase.from(table).delete().eq('id', ratingId).eq('user_id', user.id);
          if (error) { Alert.alert('Error', 'Failed to delete'); return; }
          if (type === 'anime') setRatings((p) => p.filter((r) => r.id !== ratingId));
          else setEpisodeRatings((p) => p.filter((r) => r.id !== ratingId));
        },
      },
    ]);
  };

  const deleteComment = async (commentId, type) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const table = type === 'anime' ? 'comments' : 'episode_comments';
          const { error } = await supabase.from(table).delete().eq('id', commentId).eq('user_id', user.id);
          if (error) { Alert.alert('Error', 'Failed to delete'); return; }
          if (type === 'anime') setReviews((p) => p.filter((c) => c.id !== commentId));
          else setEpisodeComments((p) => p.filter((c) => c.id !== commentId));
        },
      },
    ]);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          try { await logout(); } catch { Alert.alert('Error', 'Failed to log out'); }
        },
      },
    ]);
  };

  if (loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Profile not found</Text>
      </View>
    );
  }

  const displayName = profile.username || user?.email?.split('@')[0] || 'User';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Profile Header */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{displayName}</Text>
                {!editing && (
                  <TouchableOpacity onPress={() => setEditing(true)} style={styles.editButton}>
                    <Text style={styles.editIcon}>✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editing ? (
                <View style={styles.editForm}>
                  <TextInput
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Bio..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    style={styles.editInput}
                  />
                  <TextInput
                    value={editAvatarUrl}
                    onChangeText={setEditAvatarUrl}
                    placeholder="Avatar URL..."
                    placeholderTextColor={colors.mutedForeground}
                    style={styles.editInput}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={saveProfile} style={styles.saveBtn}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditing(false); setEditBio(profile.bio || ''); setEditAvatarUrl(profile.avatar_url || ''); }} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.bio}>{profile.bio || 'No bio yet'}</Text>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabs}>
          {[{ id: 'lists', label: 'Lists' }, { id: 'ratings', label: 'Ratings' }, { id: 'reviews', label: 'Reviews' }].map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, activeTab === t.id && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loadingData ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {activeTab === 'lists' && (
              <View style={styles.tabContent}>
                <View style={styles.tabContentHeader}>
                  <Text style={styles.tabContentTitle}>Your Lists</Text>
                  <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createBtn}>
                    <Text style={styles.createBtnText}>+ Create</Text>
                  </TouchableOpacity>
                </View>
                {lists.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptyText}>No lists yet</Text>
                  </View>
                ) : (
                  lists.map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      onPress={() => navigation.navigate('ListsTab')}
                      style={styles.listItem}
                    >
                      <Text style={styles.listName}>{l.name}</Text>
                      {l.description && <Text style={styles.listDesc}>{l.description}</Text>}
                      <Text style={styles.listMeta}>
                        {l.is_private ? '🔒 Private' : '🌐 Public'} · {new Date(l.created_at).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {activeTab === 'ratings' && (
              <View style={styles.tabContent}>
                <Text style={styles.tabContentTitle}>Ratings</Text>
                {unifiedRatings.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptyText}>No ratings yet</Text>
                  </View>
                ) : (
                  unifiedRatings.map((r) => (
                    <View key={`rating-${r.type}-${r.id}`} style={styles.ratingItem}>
                      <TouchableOpacity
                        onPress={() => r.anime && navigation.navigate('AnimeDetail', { id: r.anime.id })}
                        style={styles.ratingItemContent}
                      >
                        {r.anime?.cover_image ? (
                          <Image source={{ uri: r.anime.cover_image }} style={styles.ratingImage} />
                        ) : (
                          <View style={[styles.ratingImage, { backgroundColor: colors.primary }]} />
                        )}
                        <View style={styles.ratingInfo}>
                          <Text style={styles.ratingTitle} numberOfLines={1}>
                            {r.anime?.title || 'Unknown'}
                            {r.type === 'episode' && r.episode_number ? ` – Ep ${r.episode_number}` : ''}
                          </Text>
                          <Text style={styles.ratingDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.ratingBadge2}>
                          <Text style={styles.ratingBadgeText}>{r.rating}/10</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteRating(r.id, r.type)}>
                        <Text style={{ fontSize: 14, color: colors.destructive }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'reviews' && (
              <View style={styles.tabContent}>
                <Text style={styles.tabContentTitle}>Reviews & Comments</Text>
                {unifiedComments.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptyText}>No reviews yet</Text>
                  </View>
                ) : (
                  unifiedComments.map((c) => (
                    <View key={`comment-${c.type}-${c.id}`} style={styles.ratingItem}>
                      <TouchableOpacity
                        onPress={() => c.anime && navigation.navigate('AnimeDetail', { id: c.anime.id })}
                        style={styles.ratingItemContent}
                      >
                        {c.anime?.cover_image ? (
                          <Image source={{ uri: c.anime.cover_image }} style={styles.ratingImage} />
                        ) : (
                          <View style={[styles.ratingImage, { backgroundColor: colors.primary }]} />
                        )}
                        <View style={styles.ratingInfo}>
                          <Text style={styles.ratingTitle} numberOfLines={1}>
                            {c.anime?.title || 'Unknown'}
                            {c.type === 'episode' && c.episode_number ? ` – Ep ${c.episode_number}` : ''}
                          </Text>
                          <Text style={styles.commentPreview} numberOfLines={2}>{c.content}</Text>
                          <Text style={styles.ratingDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteComment(c.id, c.type)}>
                        <Text style={{ fontSize: 14, color: colors.destructive }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      <CreateListModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSave={createList} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  notFoundText: { color: colors.mutedForeground, fontSize: 16 },
  // Profile card
  profileCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 12,
  },
  profileRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  editButton: { padding: 4 },
  editIcon: { fontSize: 16 },
  bio: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20 },
  editForm: { gap: 8 },
  editInput: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    borderRadius: 8, padding: 10,
    fontSize: 14, color: colors.foreground,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  cancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  cancelBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  statLabel: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  // Logout
  logoutButton: {
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    marginBottom: 16,
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: colors.destructive },
  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  tabTextActive: { color: colors.primary },
  loadingSection: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, borderRadius: 16,
    padding: 40, alignItems: 'center',
  },
  tabContent: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
  },
  tabContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tabContentTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  createBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptySection: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
    borderRadius: 12, padding: 32, alignItems: 'center',
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14 },
  listItem: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, borderRadius: 12,
    padding: 14, marginBottom: 8,
  },
  listName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  listDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  listMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 8 },
  ratingItem: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, borderRadius: 12,
    padding: 12, marginBottom: 8, gap: 8,
  },
  ratingItemContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingImage: { width: 40, height: 56, borderRadius: 6 },
  ratingInfo: { flex: 1 },
  ratingTitle: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  ratingDate: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  ratingBadge2: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  ratingBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  commentPreview: { fontSize: 12, color: colors.foreground, marginTop: 2 },
});
