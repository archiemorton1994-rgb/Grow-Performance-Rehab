import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  Alert,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { EmptyState } from '@/components/EmptyState';
import { useAppStore, CustomExercise, CustomTemplate } from '@/lib/store';
import {
  getAllPickableExercises,
  toInternalTier,
  ExerciseTemplate,
  ExerciseCategory,
  InternalTier,
} from '@/lib/exercise-db';
import { daysSince } from '@/lib/utils';

// An exercise logged within this many days is considered "recently done".
const RECENT_WINDOW_DAYS = 7;

/** Short relative label for a recent date, or null if outside the recent window. */
function recentLabel(iso: string): string | null {
  const d = daysSince(iso);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d <= RECENT_WINDOW_DAYS) return `${d}d ago`;
  return null;
}

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
  { key: 'cardio', label: 'Cardio' },
];

interface CardioOption {
  id: string;
  name: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  cue: string;
}

const CARDIO_OPTIONS: CardioOption[] = [
  {
    id: 'cardio-treadmill',
    name: 'Treadmill',
    icon: 'walk-outline',
    cue: 'Run, walk, or jog at your chosen pace. Log duration and optional speed.',
  },
  {
    id: 'cardio-bike',
    name: 'Stationary Bike',
    icon: 'bicycle-outline',
    cue: 'Steady or interval cycling. Log duration and optional speed.',
  },
  {
    id: 'cardio-rowing',
    name: 'Rowing Machine',
    icon: 'boat-outline',
    cue: 'Drive with legs, then pull. Log duration and optional distance.',
  },
  {
    id: 'cardio-ski-erg',
    name: 'Ski Erg',
    icon: 'body-outline',
    cue: 'Pull down with arms, hinge from hips. Log duration and optional distance.',
  },
  {
    id: 'cardio-other',
    name: 'Other Cardio',
    icon: 'fitness-outline',
    cue: 'Any time-based cardio. Log duration and optional speed or distance.',
  },
];

interface SelectedCardioExercise {
  id: string;
  name: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  cue: string;
}

// Movement-pattern & difficulty filters for the picker (multi-select).
// Only chips whose value is present in the current equipment tier's pool are shown.
const PATTERN_FILTERS: { key: string; label: string }[] = [
  { key: 'squat', label: 'Squat' },
  { key: 'hinge', label: 'Hinge' },
  { key: 'push', label: 'Push' },
  { key: 'pull', label: 'Pull' },
  { key: 'lunge', label: 'Lunge' },
  { key: 'carry', label: 'Carry' },
  { key: 'isometric', label: 'Isometric' },
];

const DIFFICULTY_FILTERS: { key: string; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
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
  const {
    getEffectiveTier,
    setPendingCustomExercises,
    savedTemplates,
    saveTemplate,
    deleteTemplate,
    updateTemplate,
    completedSessions,
  } = useAppStore();
  const tier = getEffectiveTier();

  const pickable = useMemo(() => getAllPickableExercises(), []);
  const allExercises = useMemo(() => pickable.map((p) => p.template), [pickable]);
  const tiersByName = useMemo(
    () => new Map(pickable.map((p) => [p.template.name, p.tiers])),
    [pickable]
  );

  // Equipment tiers are cumulative: a Full Gym user owns dumbbells and their own
  // bodyweight too. Defaulting to everything at or below their tier is what
  // makes dumbbell work visible to a Full Gym user — previously their tier
  // collapsed to `fullgym` alone and those exercises were unreachable.
  const ownedTiers = useMemo(() => {
    const rank: Record<InternalTier, number> = { bodyweight: 0, dumbbells: 1, fullgym: 2 };
    const own = rank[toInternalTier(tier)];
    return (['bodyweight', 'dumbbells', 'fullgym'] as InternalTier[]).filter(
      (t) => rank[t] <= own
    );
  }, [tier]);

  // Empty set = no narrowing, i.e. everything the user owns.
  const [equipmentFilters, setEquipmentFilters] = useState<Set<InternalTier>>(new Set());

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  // Multi-select movement-pattern / difficulty filters. Local state only — must NOT persist between sessions.
  const [patternFilters, setPatternFilters] = useState<Set<string>>(new Set());
  const [difficultyFilters, setDifficultyFilters] = useState<Set<string>>(new Set());
  // When on, exercises not done in the last week sort to the top. Local state only — must NOT persist.
  const [freshFirst, setFreshFirst] = useState(false);
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [selectedCardio, setSelectedCardio] = useState<SelectedCardioExercise[]>([]);
  const [otherCardioName, setOtherCardioName] = useState('');
  const [editingExercise, setEditingExercise] = useState<SelectedExercise | null>(null);
  const [editSets, setEditSets] = useState(3);
  const [editReps, setEditReps] = useState('');

  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const [renamingTemplate, setRenamingTemplate] = useState<CustomTemplate | null>(null);
  const [renameText, setRenameText] = useState('');
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);

  const [undoToast, setUndoToast] = useState<{
    templateId: string;
    templateName: string;
    previousExercises: SelectedExercise[];
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissUndoToast = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoToast(null);
  }, []);

  const showUndoToast = useCallback(
    (templateId: string, templateName: string, previousExercises: SelectedExercise[]) => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoToast({ templateId, templateName, previousExercises });
      undoTimerRef.current = setTimeout(() => {
        setUndoToast(null);
        undoTimerRef.current = null;
      }, 4500);
    },
    []
  );

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (!undoToast) return;
    const { templateId, previousExercises } = undoToast;
    dismissUndoToast();
    const restoredExercises = previousExercises.map((s) => ({
      id: s.template.id,
      name: s.template.name,
      sets: s.sets,
      reps: s.reps,
      cue: s.template.cue,
      suggestedLoad: s.template.suggestedLoad,
      category: s.template.category,
    }));
    updateTemplate(templateId, { exercises: restoredExercises });
    setSelected(previousExercises);
    setLoadedTemplateId(templateId);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [undoToast, dismissUndoToast, updateTemplate]);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [insertAtIdx, setInsertAtIdx] = useState<number | null>(null);
  const draggingIdxRef = useRef<number | null>(null);
  const insertAtIdxRef = useRef<number | null>(null);
  const chipLayoutsRef = useRef<{ x: number; width: number }[]>([]);
  const trayScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const [trayContentWidth, setTrayContentWidth] = useState(0);
  const [trayContainerWidth, setTrayContainerWidth] = useState(0);
  const [trayScrollX, setTrayScrollX] = useState(0);
  const prevSelectedLengthRef = useRef(0);

  // Auto-scroll to end when a new chip is added
  useEffect(() => {
    const prev = prevSelectedLengthRef.current;
    prevSelectedLengthRef.current = selected.length;
    if (selected.length > prev) {
      setTimeout(() => trayScrollRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [selected.length]);

  const captureGsMoveXRef = useRef(0);
  const captureChipCenterXRef = useRef(0);
  const containerOwnedRef = useRef(false);

  // Only surface pattern/difficulty chips that actually exist in the current tier's pool.
  const { availablePatterns, availableDifficulties } = useMemo(() => {
    const patSet = new Set<string>();
    const diffSet = new Set<string>();
    for (const e of allExercises) {
      if (e.movementPattern) patSet.add(e.movementPattern);
      if (e.difficulty) diffSet.add(e.difficulty);
    }
    return {
      availablePatterns: PATTERN_FILTERS.filter((p) => patSet.has(p.key)),
      availableDifficulties: DIFFICULTY_FILTERS.filter((d) => diffSet.has(d.key)),
    };
  }, [allExercises]);

  const attrFiltersActive = patternFilters.size > 0 || difficultyFilters.size > 0;

  const filtered = useMemo(() => {
    // Equipment gate first: never offer a movement the user has no kit for.
    const active = equipmentFilters.size > 0 ? equipmentFilters : new Set(ownedTiers);
    let list = allExercises.filter((e) => {
      const t = tiersByName.get(e.name);
      // No tier recorded means the movement needs no equipment — always allow.
      return !t || t.length === 0 || t.some((x) => active.has(x));
    });
    if (categoryFilter !== 'all') {
      list = list.filter((e) => e.category === categoryFilter);
    }
    if (patternFilters.size > 0) {
      list = list.filter((e) => !!e.movementPattern && patternFilters.has(e.movementPattern));
    }
    if (difficultyFilters.size > 0) {
      list = list.filter((e) => !!e.difficulty && difficultyFilters.has(e.difficulty));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [
    allExercises,
    tiersByName,
    ownedTiers,
    equipmentFilters,
    categoryFilter,
    patternFilters,
    difficultyFilters,
    search,
  ]);

  // Most-recent completion date per exercise, keyed by both id and name (either can match).
  // completedSessions is stored newest-first, so the first occurrence seen is the most recent.
  const { recentById, recentByName } = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const s of completedSessions) {
      for (const log of s.exerciseLogs) {
        if (!byId.has(log.exerciseId)) byId.set(log.exerciseId, s.date);
        if (!byName.has(log.exerciseName)) byName.set(log.exerciseName, s.date);
      }
    }
    return { recentById: byId, recentByName: byName };
  }, [completedSessions]);

  const hasHistory = recentById.size > 0 || recentByName.size > 0;

  // Latest logged date for an exercise (max of id-match and name-match), or null if never done.
  const getLastDone = useCallback(
    (ex: ExerciseTemplate): string | null => {
      const a = recentById.get(ex.id);
      const b = recentByName.get(ex.name);
      if (a && b) return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
      return a ?? b ?? null;
    },
    [recentById, recentByName]
  );

  // When "Fresh first" is on, bucket recently-done exercises to the bottom while
  // preserving the existing category/name ordering within each bucket.
  const displayList = useMemo(() => {
    if (!freshFirst) return filtered;
    const fresh: ExerciseTemplate[] = [];
    const recent: ExerciseTemplate[] = [];
    for (const e of filtered) {
      const last = getLastDone(e);
      if (last !== null && daysSince(last) <= RECENT_WINDOW_DAYS) recent.push(e);
      else fresh.push(e);
    }
    return [...fresh, ...recent];
  }, [filtered, freshFirst, getLastDone]);

  const toggleFreshFirst = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setFreshFirst((v) => !v);
  }, []);

  const togglePatternFilter = useCallback((key: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setPatternFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleDifficultyFilter = useCallback((key: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setDifficultyFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearAttrFilters = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setPatternFilters(new Set());
    setDifficultyFilters(new Set());
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.template.id)), [selected]);

  const [hasEverSelected, setHasEverSelected] = useState(false);

  const toggleExercise = useCallback((template: ExerciseTemplate) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const alreadyIn = prev.find((s) => s.template.id === template.id);
      if (alreadyIn) {
        return prev.filter((s) => s.template.id !== template.id);
      }
      return [...prev, { template, sets: template.sets, reps: template.reps }];
    });
    setHasEverSelected(true);
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

  const [emptiedToastVisible, setEmptiedToastVisible] = useState(false);
  const emptiedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeFromTray = useCallback((id: string) => {
    setSelected((prev) => {
      const next = prev.filter((s) => s.template.id !== id);
      if (prev.length > 0 && next.length === 0) {
        if (emptiedToastTimerRef.current) clearTimeout(emptiedToastTimerRef.current);
        setEmptiedToastVisible(true);
        emptiedToastTimerRef.current = setTimeout(() => setEmptiedToastVisible(false), 2800);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (emptiedToastTimerRef.current) clearTimeout(emptiedToastTimerRef.current);
    };
  }, []);

  const cancelDrag = useCallback(() => {
    draggingIdxRef.current = null;
    insertAtIdxRef.current = null;
    setDraggingIdx(null);
    setInsertAtIdx(null);
  }, []);

  const chipsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => draggingIdxRef.current !== null,
      onPanResponderGrant: (_, gs) => {
        const idx = draggingIdxRef.current;
        if (idx === null) return;
        containerOwnedRef.current = true;
        captureGsMoveXRef.current = gs.moveX;
        const layout = chipLayoutsRef.current[idx];
        captureChipCenterXRef.current = (layout?.x ?? 0) + (layout?.width ?? 0) / 2;
        insertAtIdxRef.current = idx;
        setInsertAtIdx(idx);
      },
      onPanResponderMove: (_, gs) => {
        if (draggingIdxRef.current === null) return;
        const layouts = chipLayoutsRef.current;
        if (!layouts.length) return;
        const fingerX = captureChipCenterXRef.current + (gs.moveX - captureGsMoveXRef.current);
        let newIdx = layouts.length;
        for (let i = 0; i < layouts.length; i++) {
          const midX = (layouts[i]?.x ?? 0) + (layouts[i]?.width ?? 0) / 2;
          if (fingerX < midX) {
            newIdx = i;
            break;
          }
        }
        insertAtIdxRef.current = newIdx;
        setInsertAtIdx(newIdx);
      },
      onPanResponderRelease: () => {
        containerOwnedRef.current = false;
        const from = draggingIdxRef.current;
        const to = insertAtIdxRef.current;
        if (from !== null && to !== null && from !== to) {
          const finalTo = from < to ? to - 1 : to;
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelected((prev) => {
            const next = [...prev];
            const [item] = next.splice(from, 1);
            next.splice(finalTo, 0, item);
            return next;
          });
        }
        draggingIdxRef.current = null;
        insertAtIdxRef.current = null;
        setDraggingIdx(null);
        setInsertAtIdx(null);
      },
      onPanResponderTerminate: () => {
        containerOwnedRef.current = false;
        draggingIdxRef.current = null;
        insertAtIdxRef.current = null;
        setDraggingIdx(null);
        setInsertAtIdx(null);
      },
    })
  ).current;

  const handleStart = useCallback(() => {
    if (selected.length === 0 && selectedCardio.length === 0) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined')
          window.alert('Select at least one exercise to start your session.');
      } else {
        Alert.alert(
          'No Exercises Selected',
          'Tap at least one exercise to add it to your session before starting.',
          [{ text: 'Got it', style: 'default' }]
        );
      }
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const strengthExercises: CustomExercise[] = selected.map((s) => ({
      id: s.template.id,
      name: s.template.name,
      sets: s.sets,
      reps: s.reps,
      cue: s.template.cue,
      suggestedLoad: s.template.suggestedLoad,
      category: s.template.category,
    }));
    const cardioExercises: CustomExercise[] = selectedCardio.map((c) => ({
      id: c.id,
      name: c.name,
      sets: 1,
      reps: '',
      cue: c.cue,
      suggestedLoad: 'Cardio',
      category: 'accessory' as const,
      type: 'cardio' as const,
    }));
    setPendingCustomExercises([...strengthExercises, ...cardioExercises]);
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
  }, [selected, selectedCardio, setPendingCustomExercises, tier]);

  const openSaveModal = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTemplateName('');
    setSaveModalVisible(true);
  }, []);

  const closeSaveModal = useCallback(() => {
    setSaveModalVisible(false);
    setLoadedTemplateId(null);
  }, []);

  const confirmSaveTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name) return;
    const strengthExercises: CustomExercise[] = selected.map((s) => ({
      id: s.template.id,
      name: s.template.name,
      sets: s.sets,
      reps: s.reps,
      cue: s.template.cue,
      suggestedLoad: s.template.suggestedLoad,
      category: s.template.category,
    }));
    const cardioExercises: CustomExercise[] = selectedCardio.map((c) => ({
      id: c.id,
      name: c.name,
      sets: 1,
      reps: '',
      cue: c.cue,
      suggestedLoad: 'Cardio',
      category: 'accessory' as const,
      type: 'cardio' as const,
    }));
    saveTemplate(name, [...strengthExercises, ...cardioExercises]);
    setSaveModalVisible(false);
    setLoadedTemplateId(null);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [templateName, selected, selectedCardio, saveTemplate]);

  const loadTemplate = useCallback(
    (tmpl: CustomTemplate) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const exerciseById = new Map(allExercises.map((e) => [e.id, e]));
      const strengthExs = tmpl.exercises.filter((ex) => ex.type !== 'cardio');
      const cardioExs = tmpl.exercises.filter((ex) => ex.type === 'cardio');
      const newSelected: SelectedExercise[] = strengthExs.map((ex) => {
        const found = exerciseById.get(ex.id);
        const template: ExerciseTemplate = found ?? {
          id: ex.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          cue: ex.cue,
          suggestedLoad: ex.suggestedLoad,
          category: ex.category as ExerciseCategory,
          targetRegions: [],
          videoId: '',
        };
        return { template, sets: ex.sets, reps: ex.reps };
      });
      const newCardio: SelectedCardioExercise[] = cardioExs.map((ex) => {
        const option = CARDIO_OPTIONS.find((o) => o.id === ex.id) ?? CARDIO_OPTIONS[4];
        return { id: ex.id, name: ex.name, icon: option.icon, cue: ex.cue };
      });
      const restoredOtherName = cardioExs.find((ex) => ex.id === 'cardio-other')?.name ?? '';
      setSelected(newSelected);
      setSelectedCardio(newCardio);
      setOtherCardioName(restoredOtherName === 'Other Cardio' ? '' : restoredOtherName);
      setLoadedTemplateId(tmpl.id);
      setSearch('');
      setCategoryFilter('all');
      setPatternFilters(new Set());
      setDifficultyFilters(new Set());
    },
    [allExercises]
  );

  const openRenameModal = useCallback((tmpl: CustomTemplate) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRenamingTemplate(tmpl);
    setRenameText(tmpl.name);
  }, []);

  const confirmRename = useCallback(() => {
    if (!renamingTemplate) return;
    const name = renameText.trim();
    if (!name) return;
    updateTemplate(renamingTemplate.id, { name });
    setRenamingTemplate(null);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [renamingTemplate, renameText, updateTemplate]);

  const confirmUpdateTemplate = useCallback(() => {
    if (!loadedTemplateId) return;
    const strengthExercises: CustomExercise[] = selected.map((s) => ({
      id: s.template.id,
      name: s.template.name,
      sets: s.sets,
      reps: s.reps,
      cue: s.template.cue,
      suggestedLoad: s.template.suggestedLoad,
      category: s.template.category,
    }));
    const cardioExercises: CustomExercise[] = selectedCardio.map((c) => ({
      id: c.id,
      name: c.name,
      sets: 1,
      reps: '',
      cue: c.cue,
      suggestedLoad: 'Cardio',
      category: 'accessory' as const,
      type: 'cardio' as const,
    }));
    const exercises = [...strengthExercises, ...cardioExercises];

    const originalTemplate = savedTemplates.find((t) => t.id === loadedTemplateId);
    const removedCount = originalTemplate
      ? originalTemplate.exercises.length - exercises.length
      : 0;

    const doUpdate = () => {
      const prevSelected: SelectedExercise[] | null =
        removedCount > 0 && originalTemplate
          ? originalTemplate.exercises.map((ex) => {
              const found = allExercises.find((e) => e.id === ex.id);
              const tmpl: ExerciseTemplate = found ?? {
                id: ex.id,
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                cue: ex.cue,
                suggestedLoad: ex.suggestedLoad,
                category: ex.category as ExerciseCategory,
                targetRegions: [],
                videoId: '',
              };
              return { template: tmpl, sets: ex.sets, reps: ex.reps };
            })
          : null;

      updateTemplate(loadedTemplateId, { exercises });
      setLoadedTemplateId(null);
      setSaveModalVisible(false);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (prevSelected && originalTemplate) {
        showUndoToast(loadedTemplateId, originalTemplate.name, prevSelected);
      }
    };

    if (removedCount > 0) {
      const message = `You're removing ${removedCount} exercise${removedCount !== 1 ? 's' : ''}. Continue?`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          doUpdate();
        }
        return;
      }
      Alert.alert('Remove Exercises?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', style: 'destructive', onPress: doUpdate },
      ]);
      return;
    }

    doUpdate();
  }, [
    loadedTemplateId,
    selected,
    selectedCardio,
    updateTemplate,
    savedTemplates,
    allExercises,
    showUndoToast,
  ]);

  const confirmDeleteTemplate = useCallback(
    (tmpl: CustomTemplate) => {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(`Remove template "${tmpl.name}"?`)) {
          deleteTemplate(tmpl.id);
        }
        return;
      }
      Alert.alert('Delete Template', `Remove "${tmpl.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTemplate(tmpl.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]);
    },
    [deleteTemplate]
  );

  const getCategoryColor = (cat: ExerciseCategory | string): string => {
    switch (cat) {
      case 'main':
        return C.primary;
      case 'accessory':
        return C.badgeVolumeText;
      case 'prehab':
        return C.categoryPrehabText;
      default:
        return C.textSecondary;
    }
  };

  const getCategoryBg = (cat: ExerciseCategory | string): string => {
    switch (cat) {
      case 'main':
        return C.primaryMuted;
      case 'accessory':
        return C.badgeVolume;
      case 'prehab':
        return C.categoryPrehab;
      default:
        return C.surfaceSecondary;
    }
  };

  const renderExercise = ({ item, index }: { item: ExerciseTemplate; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    const selEntry = selected.find((s) => s.template.id === item.id);
    const lastDone = getLastDone(item);
    const recent = lastDone ? recentLabel(lastDone) : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 18).duration(280)}>
        <Pressable
          onPress={() => toggleExercise(item)}
          onLongPress={() => (isSelected && selEntry ? openEditModal(selEntry) : undefined)}
          style={({ pressed }) => [
            styles.exerciseCard,
            isSelected && styles.exerciseCardSelected,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          testID={`custom-exercise-${item.id}`}
        >
          <View style={styles.exerciseCardLeft}>
            <View style={styles.exerciseCardPills}>
              <View
                style={[styles.categoryPill, { backgroundColor: getCategoryBg(item.category) }]}
              >
                <Text style={[styles.categoryPillText, { color: getCategoryColor(item.category) }]}>
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </Text>
              </View>
              {item.movementPattern && (
                <View style={[styles.categoryPill, { backgroundColor: C.surfaceSecondary }]}>
                  <Text style={[styles.categoryPillText, { color: C.textSecondary }]}>
                    {item.movementPattern}
                  </Text>
                </View>
              )}
              {item.difficulty && (
                <View
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor:
                        item.difficulty === 'advanced'
                          ? C.difficultyAdvancedBg
                          : item.difficulty === 'intermediate'
                            ? C.difficultyIntermediateBg
                            : C.difficultyBeginnerBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      {
                        color:
                          item.difficulty === 'advanced'
                            ? C.difficultyAdvancedText
                            : item.difficulty === 'intermediate'
                              ? C.difficultyIntermediateText
                              : C.difficultyBeginnerText,
                      },
                    ]}
                  >
                    {item.difficulty}
                  </Text>
                </View>
              )}
              {recent && (
                <View style={styles.recentPill} testID={`recent-tag-${item.id}`}>
                  <Ionicons name="time-outline" size={10} color={C.primary} />
                  <Text style={styles.recentPillText}>{recent}</Text>
                </View>
              )}
            </View>
            <Text style={styles.exerciseName}>{item.name}</Text>
            {item.primaryMuscle && (
              <Text style={styles.exercisePrimary}>
                {item.primaryMuscle}
                {item.isUnilateral ? ' · unilateral' : ''}
              </Text>
            )}
            <Text style={styles.exerciseMeta}>
              {selEntry
                ? `${selEntry.sets} sets · ${selEntry.reps}`
                : `${item.sets} sets · ${item.reps}`}
              {' · '}
              {item.suggestedLoad}
            </Text>
          </View>
          <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const TemplatesSection = useMemo(() => {
    if (savedTemplates.length === 0) return null;
    return (
      <View style={styles.templatesSection}>
        <Text style={styles.templatesSectionTitle}>My Templates</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templatesScroll}
        >
          {savedTemplates.map((tmpl) => (
            <View key={tmpl.id} style={styles.templateCardWrapper}>
              <Pressable
                onPress={() => loadTemplate(tmpl)}
                style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.8 }]}
                testID={`template-${tmpl.id}`}
              >
                <View style={styles.templateCardTop}>
                  <Ionicons name="bookmark" size={14} color={C.primary} />
                  <Text style={styles.templateCardName} numberOfLines={1}>
                    {tmpl.name}
                  </Text>
                </View>
                <Text style={styles.templateCardMeta}>
                  {tmpl.exercises.length} exercise{tmpl.exercises.length !== 1 ? 's' : ''}
                </Text>
              </Pressable>
              <View style={styles.templateActions}>
                <Pressable
                  onPress={() => openRenameModal(tmpl)}
                  hitSlop={8}
                  style={styles.templateActionBtn}
                  testID={`template-rename-${tmpl.id}`}
                  accessibilityLabel="Rename template"
                  accessibilityRole="button"
                >
                  <Ionicons name="pencil-outline" size={13} color={C.textTertiary} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteTemplate(tmpl)}
                  hitSlop={8}
                  style={styles.templateActionBtn}
                  testID={`template-delete-${tmpl.id}`}
                  accessibilityLabel="Delete template"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={13} color={C.textTertiary} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }, [savedTemplates, styles, C, loadTemplate, confirmDeleteTemplate, openRenameModal]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          testID="custom-session-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
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
        <Ionicons
          name="search-outline"
          size={18}
          color={C.textTertiary}
          style={styles.searchIcon}
        />
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
        style={{ flexShrink: 0 }}
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
            <Text
              style={[
                styles.filterChipText,
                categoryFilter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {(availablePatterns.length > 0 || availableDifficulties.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexShrink: 0 }}
          contentContainerStyle={styles.attrFilterRow}
        >
          <Pressable
            onPress={clearAttrFilters}
            style={({ pressed }) => [
              styles.filterChip,
              !attrFiltersActive && styles.filterChipActive,
              pressed && { opacity: 0.8 },
            ]}
            testID="filter-attr-all"
          >
            <Text
              style={[styles.filterChipText, !attrFiltersActive && styles.filterChipTextActive]}
            >
              All
            </Text>
          </Pressable>

          {availablePatterns.map((p) => {
            const active = patternFilters.has(p.key);
            return (
              <Pressable
                key={p.key}
                onPress={() => togglePatternFilter(p.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                testID={`filter-pattern-${p.key}`}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}

          {availablePatterns.length > 0 && availableDifficulties.length > 0 && (
            <View style={styles.filterDivider} />
          )}

          {availableDifficulties.map((d) => {
            const active = difficultyFilters.has(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => toggleDifficultyFilter(d.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                testID={`filter-difficulty-${d.key}`}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}

          {hasHistory && (
            <>
              <View style={styles.filterDivider} />
              <Pressable
                onPress={toggleFreshFirst}
                style={({ pressed }) => [
                  styles.filterChip,
                  styles.freshChip,
                  freshFirst && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                testID="filter-fresh-first"
              >
                <Ionicons
                  name="sparkles-outline"
                  size={13}
                  color={freshFirst ? C.primary : C.textSecondary}
                />
                <Text style={[styles.filterChipText, freshFirst && styles.filterChipTextActive]}>
                  Fresh first
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {categoryFilter === 'cardio' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                selected.length + selectedCardio.length > 0
                  ? 180 + insets.bottom
                  : 40 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {CARDIO_OPTIONS.map((opt) => {
            const isSelected = selectedCardio.some((c) => c.id === opt.id);
            const isOther = opt.id === 'cardio-other';
            return (
              <React.Fragment key={opt.id}>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web')
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (isSelected) {
                      setSelectedCardio((prev) => prev.filter((c) => c.id !== opt.id));
                      if (isOther) setOtherCardioName('');
                    } else {
                      const name = isOther ? otherCardioName.trim() || 'Other Cardio' : opt.name;
                      setSelectedCardio((prev) => [
                        ...prev,
                        { id: opt.id, name, icon: opt.icon, cue: opt.cue },
                      ]);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.exerciseCard,
                    isSelected && styles.exerciseCardSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={styles.exerciseCardLeft}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={isSelected ? C.primary : C.textSecondary}
                      />
                      <Text style={[styles.exerciseName, isSelected && { color: C.primary }]}>
                        {opt.name}
                      </Text>
                      <View
                        style={{
                          backgroundColor: C.primaryMuted,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: 'Inter_600SemiBold',
                            color: C.primary,
                            textTransform: 'uppercase' as const,
                            letterSpacing: 0.4,
                          }}
                        >
                          Cardio
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Inter_400Regular',
                        color: C.textSecondary,
                      }}
                      numberOfLines={2}
                    >
                      {opt.cue}
                    </Text>
                  </View>
                  <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
                  </View>
                </Pressable>
                {isOther && isSelected && (
                  <View
                    style={{
                      marginHorizontal: 0,
                      marginTop: -4,
                      marginBottom: 8,
                      backgroundColor: C.surfaceSecondary,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Inter_500Medium',
                        color: C.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      Name this exercise (optional)
                    </Text>
                    <TextInput
                      style={{
                        fontSize: 14,
                        fontFamily: 'Inter_400Regular',
                        color: C.text,
                        paddingVertical: 0,
                      }}
                      value={otherCardioName}
                      onChangeText={(text) => {
                        setOtherCardioName(text);
                        setSelectedCardio((prev) =>
                          prev.map((c) =>
                            c.id === 'cardio-other'
                              ? { ...c, name: text.trim() || 'Other Cardio' }
                              : c
                          )
                        );
                      }}
                      placeholder="e.g. Jump rope, Assault bike…"
                      placeholderTextColor={C.textTertiary}
                      returnKeyType="done"
                      maxLength={40}
                    />
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}

      {categoryFilter !== 'cardio' && (
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          ListHeaderComponent={
            <>
              {TemplatesSection}
              {selected.length === 0 && filtered.length > 0 && !hasEverSelected && (
                <View style={styles.selectionHint}>
                  <Ionicons name="hand-left-outline" size={14} color={C.primary} />
                  <Text style={styles.selectionHintText}>
                    Tap an exercise to add it - select at least one to start
                  </Text>
                </View>
              )}
            </>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: selected.length > 0 ? 180 + insets.bottom : 40 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No exercises found"
              subtitle={
                search.trim() || categoryFilter !== 'all' || attrFiltersActive
                  ? 'Try a different search or filter'
                  : 'Pick at least one exercise to start your session'
              }
              testID="custom-session-empty"
            />
          }
        />
      )}

      {emptiedToastVisible && selected.length === 0 && selectedCardio.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(220)}
          style={[
            styles.emptiedToast,
            { bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="information-circle" size={18} color={C.textInverse} />
          <Text style={styles.emptiedToastText}>
            All exercises removed - tap one to add it back
          </Text>
        </Animated.View>
      )}

      {(selected.length > 0 || selectedCardio.length > 0) && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[
            styles.tray,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 },
          ]}
        >
          <View style={styles.trayTop}>
            <Text style={styles.trayCount}>
              {selected.length + selectedCardio.length} exercise
              {selected.length + selectedCardio.length !== 1 ? 's' : ''} selected
            </Text>
            <View style={styles.trayTopRight}>
              <Pressable
                onPress={openSaveModal}
                style={({ pressed }) => [styles.saveTemplateBtn, pressed && { opacity: 0.7 }]}
                testID="save-template-btn"
              >
                <Ionicons name="bookmark-outline" size={15} color={C.primary} />
                <Text style={styles.saveTemplateBtnText}>Save</Text>
              </Pressable>
              <Text style={styles.trayHint}>Long-press to drag</Text>
            </View>
          </View>
          <View
            style={styles.trayChipsWrapper}
            onLayout={(e) => setTrayContainerWidth(e.nativeEvent.layout.width)}
            {...chipsPanResponder.panHandlers}
          >
            <ScrollView
              ref={trayScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trayChips}
              scrollEnabled={draggingIdx === null}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                scrollOffsetRef.current = x;
                setTrayScrollX(x);
              }}
              scrollEventThrottle={16}
              onContentSizeChange={(w) => setTrayContentWidth(w)}
            >
              {selected.map((s, idx) => {
                const isDragged = draggingIdx === idx;
                const showInsertBefore = insertAtIdx === idx && insertAtIdx !== draggingIdx;
                return (
                  <React.Fragment key={s.template.id}>
                    {showInsertBefore && <View style={styles.insertCursor} />}
                    <Pressable
                      onPress={() => openEditModal(s)}
                      onLongPress={() => {
                        if (Platform.OS !== 'web')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        draggingIdxRef.current = idx;
                        insertAtIdxRef.current = idx;
                        setDraggingIdx(idx);
                        setInsertAtIdx(idx);
                      }}
                      onPressOut={() => {
                        if (draggingIdxRef.current !== null && !containerOwnedRef.current)
                          cancelDrag();
                      }}
                      delayLongPress={300}
                      onLayout={(e) => {
                        const { x, width } = e.nativeEvent.layout;
                        chipLayoutsRef.current[idx] = { x, width };
                      }}
                      style={[styles.trayChip, isDragged && styles.trayChipDragging]}
                      testID={`tray-chip-${s.template.id}`}
                    >
                      <Ionicons
                        name="reorder-three-outline"
                        size={15}
                        color={isDragged ? C.primary : C.textTertiary}
                        style={styles.trayChipDragHandle}
                      />
                      <View style={styles.trayChipBody}>
                        <Text style={styles.trayChipName} numberOfLines={1}>
                          {s.template.name}
                        </Text>
                        <Text style={styles.trayChipMeta}>
                          {s.sets}×{s.reps}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removeFromTray(s.template.id)}
                        hitSlop={8}
                        style={styles.trayChipRemove}
                        accessibilityLabel="Remove exercise"
                        accessibilityRole="button"
                      >
                        <Ionicons name="close" size={13} color={C.textSecondary} />
                      </Pressable>
                    </Pressable>
                  </React.Fragment>
                );
              })}
              {insertAtIdx === selected.length && <View style={styles.insertCursor} />}
              {selectedCardio.map((c) => (
                <View key={c.id} style={styles.trayChip}>
                  <Ionicons name={c.icon} size={14} color={C.primary} style={{ marginRight: 4 }} />
                  <View style={styles.trayChipBody}>
                    <Text style={styles.trayChipName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.trayChipMeta}>Cardio</Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedCardio((prev) => prev.filter((x) => x.id !== c.id))}
                    hitSlop={8}
                    style={styles.trayChipRemove}
                    accessibilityLabel="Remove cardio exercise"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={13} color={C.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            {/* Right-edge overflow affordance: fade + chevron shown when chips extend beyond tray width */}
            {trayContentWidth > trayContainerWidth + 4 &&
              trayScrollX < trayContentWidth - trayContainerWidth - 4 && (
                <LinearGradient
                  colors={[`${C.surface}00`, C.surface]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.trayOverflowFade}
                  pointerEvents="none"
                >
                  <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
                </LinearGradient>
              )}
          </View>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              styles.startBtn,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            testID="custom-session-start"
          >
            <Ionicons name="play" size={18} color={C.textInverse} />
            <Text style={styles.startBtnText}>Start Session</Text>
          </Pressable>
        </Animated.View>
      )}

      <Modal
        visible={!!editingExercise}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingExercise(null)}
      >
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
                  accessibilityLabel="Decrease sets"
                  accessibilityRole="button"
                >
                  <Ionicons name="remove" size={20} color={C.text} />
                </Pressable>
                <Text style={styles.stepperValue}>{editSets}</Text>
                <Pressable
                  onPress={() => setEditSets((v) => Math.min(5, v + 1))}
                  style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.7 }]}
                  accessibilityLabel="Increase sets"
                  accessibilityRole="button"
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

      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSaveModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSaveModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.saveModalHeader}>
              <Ionicons name="bookmark" size={20} color={C.primary} />
              <Text style={styles.modalTitle}>Save as Template</Text>
            </View>
            <Text style={styles.modalSub}>
              {selected.length} exercise{selected.length !== 1 ? 's' : ''} will be saved
            </Text>

            {loadedTemplateId &&
              (() => {
                const loadedTmpl = savedTemplates.find((t) => t.id === loadedTemplateId);
                if (!loadedTmpl) return null;
                return (
                  <Pressable
                    onPress={confirmUpdateTemplate}
                    style={({ pressed }) => [styles.updateExistingBtn, pressed && { opacity: 0.8 }]}
                    testID="confirm-update-template"
                  >
                    <Ionicons name="refresh-outline" size={16} color={C.primary} />
                    <Text style={styles.updateExistingText} numberOfLines={1}>
                      {`Update "${loadedTmpl.name}"`}
                    </Text>
                  </Pressable>
                );
              })()}

            {loadedTemplateId && (
              <View style={styles.saveModalDivider}>
                <View style={styles.saveModalDividerLine} />
                <Text style={styles.saveModalDividerText}>or save as new</Text>
                <View style={styles.saveModalDividerLine} />
              </View>
            )}

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Template Name</Text>
              <TextInput
                style={styles.modalRepsInput}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="e.g. Push Day, Leg Blast…"
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
                onSubmitEditing={confirmSaveTemplate}
                autoFocus={!loadedTemplateId}
                maxLength={40}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeSaveModal}
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmSaveTemplate}
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  !templateName.trim() && styles.modalSaveBtnDisabled,
                  pressed && { opacity: 0.88 },
                ]}
                disabled={!templateName.trim()}
                testID="confirm-save-template"
              >
                <Text style={styles.modalSaveText}>
                  {loadedTemplateId ? 'Save New' : 'Save Template'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {undoToast && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={[
            styles.undoToast,
            {
              bottom:
                insets.bottom + (Platform.OS === 'web' ? 34 : 0) + (selected.length > 0 ? 180 : 16),
            },
          ]}
          testID="undo-toast"
        >
          <Text style={styles.undoToastText} numberOfLines={1}>
            {`"${undoToast.templateName}" updated`}
          </Text>
          <Pressable
            onPress={handleUndo}
            style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.75 }]}
            testID="undo-toast-btn"
          >
            <Text style={styles.undoBtnText}>Undo</Text>
          </Pressable>
          <Pressable
            onPress={dismissUndoToast}
            hitSlop={10}
            style={styles.undoDismissBtn}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      )}

      <Modal
        visible={!!renamingTemplate}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingTemplate(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRenamingTemplate(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.saveModalHeader}>
              <Ionicons name="pencil" size={20} color={C.primary} />
              <Text style={styles.modalTitle}>Rename Template</Text>
            </View>
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Template Name</Text>
              <TextInput
                style={styles.modalRepsInput}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Template name…"
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
                onSubmitEditing={confirmRename}
                autoFocus
                maxLength={40}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRenamingTemplate(null)}
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmRename}
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  !renameText.trim() && styles.modalSaveBtnDisabled,
                  pressed && { opacity: 0.88 },
                ]}
                disabled={!renameText.trim()}
                testID="confirm-rename-template"
              >
                <Text style={styles.modalSaveText}>Rename</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    headerSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: C.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      paddingHorizontal: 12,
      height: 42,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.text,
      height: 42,
    },

    filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
    attrFilterRow: {
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 10,
      gap: 8,
      alignItems: 'center',
    },
    filterDivider: { width: 1, height: 22, backgroundColor: C.borderLight, marginHorizontal: 2 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    filterChipActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    filterChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

    listContent: { paddingHorizontal: 16, paddingTop: 4 },

    templatesSection: { marginBottom: 16 },
    templatesSectionTitle: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    templatesScroll: { gap: 10, paddingRight: 4 },
    templateCardWrapper: {
      position: 'relative',
      minWidth: 130,
      maxWidth: 180,
    },
    templateCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
      padding: 12,
      paddingRight: 12,
    },
    templateCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 4,
    },
    templateCardName: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      flex: 1,
    },
    templateCardMeta: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    templateActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 6,
    },
    templateActionBtn: { padding: 4 },

    exerciseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
      padding: 14,
      marginBottom: 8,
    },
    exerciseCardSelected: {
      borderColor: C.primary,
      backgroundColor: C.primaryMuted,
    },
    exerciseCardLeft: { flex: 1, marginRight: 10 },
    categoryPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    categoryPillText: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    recentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      alignSelf: 'flex-start',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: C.primaryMuted,
    },
    recentPillText: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
      letterSpacing: 0.2,
    },
    freshChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    exerciseCardPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    exerciseName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 },
    exercisePrimary: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginBottom: 3,
    },
    exerciseMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkCircleSelected: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },

    selectionHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 12,
    },
    selectionHintText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },

    tray: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: C.surface,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
      paddingTop: 14,
      paddingHorizontal: 16,
      ...shadowStyle('#000', 0.06, 8, -2, 8),
    },
    trayTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    trayTopRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    trayCount: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
    trayHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    saveTemplateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: C.primaryMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.primary,
    },
    saveTemplateBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
    emptiedToast: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.text,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      ...shadowStyle('#000', 0.18, 12, 4, 6),
    },
    emptiedToastText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textInverse,
    },
    trayChipsWrapper: { position: 'relative', overflow: 'hidden' },
    trayOverflowFade: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 48,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingRight: 6,
    },
    trayChips: { gap: 8, paddingRight: 4, marginBottom: 12 },
    trayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    trayChipDragging: {
      opacity: 0.5,
      borderColor: C.primary,
      borderStyle: 'dashed',
    },
    trayChipDragHandle: { marginRight: 1 },
    trayChipBody: { alignItems: 'center' },
    trayChipName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text, maxWidth: 90 },
    trayChipMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    trayChipRemove: { padding: 2, marginLeft: 2 },
    insertCursor: {
      width: 3,
      borderRadius: 2,
      backgroundColor: C.primary,
      alignSelf: 'stretch',
      marginHorizontal: 1,
    },

    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 14,
      gap: 8,
    },
    startBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 22,
      width: '100%',
      maxWidth: 380,
    },
    saveModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
    modalSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 20,
      marginTop: 2,
    },
    modalSection: { marginBottom: 18 },
    modalLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      marginBottom: 10,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    stepperBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      flex: 1,
      textAlign: 'center',
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    modalRepsInput: {
      backgroundColor: C.surfaceSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
      color: C.text,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
    },
    modalCancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    modalSaveBtn: {
      flex: 2,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: C.primary,
      alignItems: 'center',
    },
    modalSaveBtnDisabled: { opacity: 0.45 },
    modalSaveText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.textInverse },

    updateExistingBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primaryMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.primary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 12,
    },
    updateExistingText: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
    },
    saveModalDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 16,
    },
    saveModalDividerLine: { flex: 1, height: 1, backgroundColor: C.borderLight },
    saveModalDividerText: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },

    undoToast: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.text,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      ...shadowStyle('#000', 0.22, 10, 4, 12),
      gap: 10,
    },
    undoToastText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textInverse,
    },
    undoBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: C.primary,
      borderRadius: 8,
    },
    undoBtnText: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: C.textInverse,
    },
    undoDismissBtn: {
      padding: 2,
    },
  });
}
