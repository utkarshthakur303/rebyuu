import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, borderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import CreateListModal from './CreateListModal';

export default function ListPickerModal({ isOpen, onClose, animeId }) {
  const { user } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [added, setAdded] = useState({});
  const [showCreate, setShowCreate] = useState(false);

  const canInteract = useMemo(() => !!user && !!animeId && !saving, [user, animeId, saving]);

  useEffect(() => {
    if (!isOpen || !user) {
      if (!isOpen) {
        setLists([]);
        setAdded({});
      }
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('lists')
        .select('id,name,description,is_private')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        Alert.alert('Error', 'Failed to load lists');
        setLists([]);
        setLoading(false);
        return;
      }
      setLists(data || []);
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [isOpen, user]);

  const addToList = async (listId) => {
    if (!user || saving) return;
    setSaving(listId);
    setAdded((prev) => ({ ...prev, [listId]: true }));
    const { error } = await supabase.from('list_items').insert({
      list_id: listId,
      anime_id: animeId,
    });
    if (error) {
      setAdded((prev) => ({ ...prev, [listId]: false }));
      Alert.alert('Error', error.message || 'Failed to add to list');
      setSaving(null);
      return;
    }
    Alert.alert('Success', 'Added to list');
    setSaving(null);
  };

  const createList = async (listData) => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('lists')
      .insert({
        user_id: user.id,
        name: listData.name.trim(),
        description: listData.description.trim() || null,
        is_private: listData.isPrivate,
      })
      .select('id,name,description,is_private')
      .single();
    if (error) {
      Alert.alert('Error', error.message || 'Failed to create list');
      setLoading(false);
      return;
    }
    if (data) {
      setLists((prev) => [data, ...prev]);
    }
    setLoading(false);
  };

  return (
    <>
      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add to List</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!user ? (
              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>Log in to manage lists</Text>
              </View>
            ) : (
              <>
                <View style={styles.subHeader}>
                  <Text style={styles.subHeaderText}>Choose a list</Text>
                  <TouchableOpacity
                    onPress={() => setShowCreate(true)}
                    style={styles.newListButton}
                  >
                    <Text style={styles.newListButtonText}>+ New List</Text>
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                ) : lists.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No lists yet</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.listContainer}>
                    {lists.map((l) => {
                      const isAdded = !!added[l.id];
                      const isBusy = saving === l.id;
                      return (
                        <TouchableOpacity
                          key={l.id}
                          disabled={!canInteract || isBusy}
                          onPress={() => addToList(l.id)}
                          style={[styles.listItem, (!canInteract || isBusy) && styles.disabled]}
                        >
                          <View style={styles.listItemInfo}>
                            <Text style={styles.listName} numberOfLines={1}>{l.name}</Text>
                            {l.description && (
                              <Text style={styles.listDesc} numberOfLines={1}>
                                {l.description}
                              </Text>
                            )}
                          </View>
                          <View>
                            {isBusy ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : isAdded ? (
                              <View style={styles.addedBadge}>
                                <Text style={styles.addedText}>✓ Added</Text>
                              </View>
                            ) : (
                              <Text style={styles.addText}>Add</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <CreateListModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={createList}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.blackAlpha60,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  closeButton: { padding: 8 },
  closeText: { fontSize: 18, color: colors.mutedForeground },
  loginPrompt: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  loginPromptText: { fontSize: 14, color: colors.mutedForeground },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subHeaderText: { fontSize: 13, color: colors.mutedForeground },
  newListButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newListButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listContainer: { maxHeight: 300 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  listItemInfo: { flex: 1, marginRight: 12 },
  listName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  listDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  addedBadge: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addedText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  addText: { fontSize: 12, color: colors.mutedForeground },
  disabled: { opacity: 0.5 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14 },
});
