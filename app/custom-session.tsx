import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore, CustomExercise } from '@/lib/store';
import { getAllPickableExercises, ExerciseTemplate, ExerciseCategory } from '@/lib/exercise-db';

const CATEGORY_LABELS: Record<string, string> = {
  main: 'Main Lift',
  accessory: 'Accessory',
  prehab: 'Prehab',
};

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'main', label: 'Main Lifts' },
  { key: 'accessory', label: 'Accessories' },
  { key: 'prehab', label: 'Prehab' },
];

interface SelectedExercise {
  template: ExerciseTemplate;
  sets: number;
  reps: string;
}

export default function CustomSessionScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { getEffectiveTier, setPendingCustomExercises } = useAppStore();
  const tier = getEffectiveTier();

  const allExercises = useMemo(() => getAllPickableExercises(tier), [tier]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [editingExercise, setEditingExercise] = useState<SelectedExercise | null>(null);
  const [editSets, setEditSets] = useState(3);
  const [editReps, setEditReps] = useState('');

  const filtered = useMemo(() => {
    let list = allExercises;
    if (categoryFilter !== 'all') {
      list = list.filter((e) => e.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [allExercises, categoryFilter, search]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.template.id)), [selected]);

  const toggleExercise = useCallback((template: ExerciseTemplate) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const alreadyIn = prev.find((s) => s.template.id === template.id);
      if (alreadyIn) {
        return prev.filter((s) => s.template.id !== template.id);
      }
      return [...prev, { template, sets: template.sets, reps: template.reps }];
    });
  }, []);

  const openEditModal = useCallback((sel: SelectedExercise) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingExercise(sel);
    setEditSets(sel.sets);
    setEditReps(sel.reps);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingExercise) return;
    setSelected((prev) =>
      prev.map((s) =>
        s.template.id === editingExercise.template.id
          ? { ...s, sets: editSets, reps: editReps.trim() || s.reps }
          : s
      )
    );
    setEditingExercise(null);
  }, [editingExercise, editSets, editReps]);

  const removeFromTray = useCallback((id: string) => {
    setSelected((prev) => prev.filter((s) => s.template.id !== id));
  }, []);

  const handleStart = useCallback(() => {
    if (selected.length === 0) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const customExercises: CustomExercise[] = selected.map((s) => ({
      id: s.template.id,
      name: s.template.name,
      sets: s.sets,
      reps: s.reps,
      cue: s.template.cue,
      suggestedLoad: s.template.suggestedLoad,
      category: s.template.category,
    }));
    setPendingCustomExercises(customExercises);
    router.push({
      pathname: '/session',
      params: {
        sessionType: 'custom',
        hasAches: 'false',
        painRegion: '',
        energy: 'normal',
        timeAvailable: '60',
        isTestWeek: 'false',
        equipment: tier,
      },
    });
  }, [selected, setPendingCustomExercises, tier]);

  const getCategoryColor = (cat: ExerciseCategory | string): string => {
    switch (cat) {
      case 'main': return C.primary;
      case 'accessory': return C.badgeVolumeText;
      case 'prehab': return C.categoryPrehabText;
      default: return C.textSecondary;
    }
  };

  const getCategoryBg = (cat: ExerciseCategory | string): string => {
    switch (cat) {
      case 'main': return C.primaryMuted;
      case 'accessory': return C.badgeVolume;
      case 'prehab': return C.categoryPrehab;
      default: return C.surfaceSecondary;
    }
  };

  const renderExercise = ({ item, index }: { item: ExerciseTemplate; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    const selEntry = selected.find((s) => s.template.id === item.id);

    return (
      <Animated.View entering={FadeInDown.delay(index * 18).duration(280)}>
        <Pressable
          onPress={() => toggleExercise(item)}
          onLongPress={() => isSelected && selEntry ? openEditModal(selEntry) : undefined}
          style={({ pressed }) => [
            styles.exerciseCard,
            isSelected && styles.exerciseCardSelected,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          testID={`custom-exercise-${item.id}`}
        >
          <View style={styles.exerciseCardLeft}>
            <View style={[styles.categoryPill, { backgroundColor: getCategoryBg(item.category) }]}>
              <Text style={[styles.categoryPillText, { color: getCategoryColor(item.category) }]}>
                {CATEGORY_LABELS[item.category] ?? item.category}
              </Text>
            </View>
            <Text style={styles.exerciseName}>{item.name}</Text>
            <Text style={styles.exerciseMeta}>
              {selEntry ? `${selEntry.sets} sets · ${selEntry.reps}` : `${item.sets} sets · ${item.reps}`}
              {' · '}{item.suggestedLoad}
            </Text>
          </View>
          <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          testID="custom-session-back"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Custom Session</Text>
          <Text style={styles.headerSub}>Pick your exercises</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={C.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises…"
          placeholderTextColor={C.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          testID="custom-session-search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORY_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setCategoryFilter(f.key)}
            style={({ pressed }) => [
              styles.filterChip,
              categoryFilter === f.key && styles.filterChipActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.filterChipText, categoryFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: selected.length > 0 ? 160 + insets.bottom : 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={32} color={C.textTertiary} />
            <Text style={styles.emptyText}>No exercises found</Text>
            <Text style={styles.emptySubText}>Try a different search or category</Text>
          </View>
        }
      />

      {selected.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.tray, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 }]}
        >
          <View style={styles.trayTop}>
            <Text style={styles.trayCount}>{selected.length} exercise{selected.length !== 1 ? 's' : ''} selected</Text>
            <Text style={styles.trayHint}>Long-press to adjust sets / reps</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trayChips}
          >
            {selected.map((s) => (
              <View key={s.template.id} style={styles.trayChip}>
                <Text style={styles.trayChipName} numberOfLines={1}>{s.template.name}</Text>
                <Text style={styles.trayChipMeta}>{s.sets}×{s.reps}</Text>
                <Pressable
                  onPress={() => removeFromTray(s.template.id)}
                  hitSlop={8}
                  style={styles.trayChipRemove}
                >
                  <Ionicons name="close" size={13} color={C.textSecondary} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
            testID="custom-session-start"
          >
            <Ionicons name="play" size={18} color={C.textInverse} />
            <Text style={styles.startBtnText}>Start Session</Text>
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={!!editingExercise} transparent animationType="fade" onRequestClose={() => setEditingExercise(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditingExercise(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingExercise?.template.name}</Text>
            <Text style={styles.modalSub}>Adjust for this session</Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Sets</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setEditSets((v) => Math.max(1, v - 1))}
                  style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="remove" size={20} color={C.text} />
                </Pressable>
                <Text style={styles.stepperValue}>{editSets}</Text>
                <Pressable
                  onPress={() => setEditSets((v) => Math.min(5, v + 1))}
                  style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="add" size={20} color={C.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Reps / Duration</Text>
              <TextInput
                style={styles.modalRepsInput}
                value={editReps}
                onChangeText={setEditReps}
                placeholder={editingExercise?.template.reps ?? '10'}
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
                onSubmitEditing={saveEdit}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditingExercise(null)}
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.88 }]}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 12,
    },
    backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },

    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 16, marginBottom: 10,
      backgroundColor: C.surface, borderRadius: 12,
      borderWidth: 1, borderColor: C.borderLight,
      paddingHorizontal: 12, height: 42,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular',
      color: C.text, height: 42,
    },

    filterRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.borderLight,
    },
    filterChipActive: {
      backgroundColor: C.primaryMuted, borderColor: C.primary,
    },
    filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    filterChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

    listContent: { paddingHorizontal: 16, paddingTop: 4 },

    exerciseCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 14,
      borderWidth: 1, borderColor: C.borderLight,
      padding: 14, marginBottom: 8,
    },
    exerciseCardSelected: {
      borderColor: C.primary, backgroundColor: C.primaryMuted,
    },
    exerciseCardLeft: { flex: 1, marginRight: 10 },
    categoryPill: {
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 8, marginBottom: 6,
    },
    categoryPillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4 },
    exerciseName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 3 },
    exerciseMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    checkCircle: {
      width: 26, height: 26, borderRadius: 13,
      borderWidth: 2, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    checkCircleSelected: {
      backgroundColor: C.primary, borderColor: C.primary,
    },

    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
    emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text, marginTop: 12, marginBottom: 4 },
    emptySubText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center' },

    tray: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: C.surface,
      borderTopWidth: 1, borderTopColor: C.borderLight,
      paddingTop: 14, paddingHorizontal: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
    },
    trayTop: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
    },
    trayCount: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
    trayHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    trayChips: { gap: 8, paddingRight: 4, marginBottom: 12 },
    trayChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.surfaceSecondary, borderRadius: 10,
      paddingHorizontal: 10, paddingVertical: 6,
      borderWidth: 1, borderColor: C.borderLight,
    },
    trayChipName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text, maxWidth: 100 },
    trayChipMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    trayChipRemove: { padding: 2 },

    startBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, gap: 8,
    },
    startBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    modalCard: {
      backgroundColor: C.surface, borderRadius: 20,
      padding: 22, width: '100%', maxWidth: 380,
    },
    modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 2 },
    modalSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 20 },
    modalSection: { marginBottom: 18 },
    modalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 10 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    stepperBtn: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.borderLight,
      alignItems: 'center', justifyContent: 'center',
    },
    stepperValue: {
      flex: 1, textAlign: 'center',
      fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text,
    },
    modalRepsInput: {
      backgroundColor: C.surfaceSecondary, borderRadius: 12,
      borderWidth: 1, borderColor: C.borderLight,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalCancelBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 12,
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.borderLight,
      alignItems: 'center',
    },
    modalCancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    modalSaveBtn: {
      flex: 2, paddingVertical: 13, borderRadius: 12,
      backgroundColor: C.primary, alignItems: 'center',
    },
    modalSaveText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.textInverse },
  });
}
