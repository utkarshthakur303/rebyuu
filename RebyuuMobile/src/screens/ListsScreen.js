import React, { useEffect, useMemo, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

export default function ListsScreen({ navigation }) {
  const { user } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [listItems, setListItems] = useState({});

  const canCreate = useMemo(() => name.trim().length > 0 && !saving, [name, saving]);

  useEffect(() => {
    if (!user) { setLists([]); setListItems({}); setLoading(false); return; }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('lists')
          .select('id,name,description,is_private,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (err) { setError(err.message); setLists([]); return; }
        const listsData = data || [];
        setLists(listsData);
        const itemsMap = {};
        await Promise.all(
          listsData.map(async (list) => {
            const { data: itemsData } = await supabase
              .from('list_items')
              .select('id,anime_id,anime:anime_index!list_items_anime_id_fkey(id,title,cover_image)')
              .eq('list_id', list.id);
            if (itemsData) itemsMap[list.id] = itemsData;
          })
        );
        if (!cancelled) setListItems(itemsMap);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load lists'); setLists([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  const createList = async () => {
    if (!user || !canCreate) return;
    setSaving(true);
    setError(null);
    const { data: newList, error: err } = await supabase
      .from('lists')
      .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null, is_private: isPrivate })
      .select('id,name,description,is_private,created_at')
      .single();
    if (err) {
      setSaving(false);
      setError(err.message);
      Alert.alert('Error', err.message || 'Failed to create list');
      return;
    }
    setName('');
    setDescription('');
    setIsPrivate(false);
    setLists((prev) => [newList, ...prev]);
    setListItems((prev) => ({ ...prev, [newList.id]: [] }));
    setSaving(false);
    Alert.alert('Success', 'List created');
  };

  const deleteList = async (listId) => {
    if (!user || deleting) return;
    Alert.alert('Delete List', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeleting(listId);
          const { error } = await supabase.from('lists').delete().eq('id', listId).eq('user_id', user.id);
          if (error) { Alert.alert('Error', 'Failed to delete'); setDeleting(null); return; }
          setLists((p) => p.filter((l) => l.id !== listId));
          setListItems((p) => { const n = { ...p }; delete n[listId]; return n; });
          setDeleting(null);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Lists</Text>
          <Text style={styles.headerSubtitle}>Create and manage your personal anime lists</Text>
        </View>

        {/* Create Form */}
        <View style={styles.createForm}>
          <View style={styles.createFormHeader}>
            <Text style={styles.createFormTitle}>Create a list</Text>
            <TouchableOpacity
              onPress={createList}
              disabled={!canCreate}
              style={[styles.createBtn, !canCreate && styles.disabled]}
            >
              <Text style={styles.createBtnText}>+ Create</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.formInput}
                placeholderTextColor={colors.mutedForeground}
                placeholder="My Watchlist"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Privacy</Text>
              <TouchableOpacity
                onPress={() => setIsPrivate((v) => !v)}
                style={styles.privacyButton}
              >
                <Text style={styles.privacyText}>{isPrivate ? '🔒 Private' : '🌐 Public'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder="A collection of anime..."
            />
          </View>
        </View>

        {/* Lists */}
        {loading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : lists.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No lists yet</Text>
          </View>
        ) : (
          lists.map((list) => {
            const items = listItems[list.id] || [];
            return (
              <View key={list.id} style={styles.listCard}>
                <View style={styles.listCardHeader}>
                  <View style={styles.listCardInfo}>
                    <Text style={styles.listName}>{list.name}</Text>
                    {list.description && <Text style={styles.listDesc}>{list.description}</Text>}
                    <Text style={styles.listMeta}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
                  </View>
                  <View style={styles.listCardActions}>
                    <View style={styles.privacyBadge}>
                      <Text style={styles.privacyBadgeText}>
                        {list.is_private ? '🔒 Private' : '🌐 Public'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteList(list.id)}
                      disabled={deleting === list.id}
                      style={[styles.deleteBtn, deleting === list.id && styles.disabled]}
                    >
                      {deleting === list.id ? (
                        <ActivityIndicator size="small" color={colors.destructive} />
                      ) : (
                        <Text style={{ fontSize: 14, color: colors.destructive }}>🗑</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* List items preview */}
                {items.length > 0 && (
                  <View style={styles.listItemsPreview}>
                    {items.slice(0, 4).map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => navigation.navigate('AnimeDetail', { id: item.anime_id })}
                        style={styles.listItemRow}
                      >
                        {item.anime?.cover_image ? (
                          <Image source={{ uri: item.anime.cover_image }} style={styles.listItemImage} />
                        ) : (
                          <View style={[styles.listItemImage, { backgroundColor: colors.primary }]} />
                        )}
                        <Text style={styles.listItemTitle} numberOfLines={1}>
                          {item.anime?.title || 'Unknown'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {items.length > 4 && (
                      <Text style={styles.moreText}>+{items.length - 4} more</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: 16 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground },
  headerSubtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  createForm: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    padding: 18, marginBottom: 20,
  },
  createFormHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  createFormTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground },
  createBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  errorText: { fontSize: 13, color: colors.destructive },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  formField: { flex: 1, marginBottom: 8 },
  formLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
  formInput: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.foreground,
  },
  privacyButton: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12,
  },
  privacyText: { fontSize: 14, color: colors.foreground },
  loadingSection: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, borderRadius: 16,
    padding: 40, alignItems: 'center',
  },
  emptySection: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
    borderRadius: 16, padding: 40, alignItems: 'center',
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14 },
  listCard: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    padding: 18, marginBottom: 12,
  },
  listCardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  listCardInfo: { flex: 1 },
  listName: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  listDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  listMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 6 },
  listCardActions: { alignItems: 'flex-end', gap: 6 },
  privacyBadge: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.muted, borderRadius: borderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  privacyBadgeText: { fontSize: 11, color: colors.foreground },
  deleteBtn: { padding: 4 },
  listItemsPreview: {
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: 8,
  },
  listItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, borderRadius: 10,
    padding: 10,
  },
  listItemImage: { width: 36, height: 48, borderRadius: 6 },
  listItemTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.foreground },
  moreText: { textAlign: 'center', fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
});
