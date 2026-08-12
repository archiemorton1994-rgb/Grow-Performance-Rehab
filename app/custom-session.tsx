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
import {
  canBeMainLift,
  patternGroupOf,
  tierOf,
  COMPOUND_PATTERN_ORDER,
  PATTERN_GROUP_LABELS,
  TIER_LABELS,
  type PatternGroup,
} from '@/lib/exercise-classification';
import {
  assembleSession,
  blocksForGoal,
  optionsForBlock,
  refreshForKpi,
  CARDIO_MINUTES,
  DEFAULT_CARDIO_MINUTES,
  SESSION_FOCUSES,
  SESSION_GOALS,
  type BlockId,
  type BuilderBlock,
  type BuilderPick,
  type BuilderPicks,
  type SessionFocus,
  type SessionGoal,
} from '@/lib/session-builder';
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
  mechanical: 'Mechanical',
  neuro: 'Power',
  prep: 'Warm-Up',
  finisher: 'Finisher',
  prehab: 'Prehab',
  cooldown: 'Cooldown',
  cardio: 'Cardio',
};

/**
 * Catalogue sections. Labels are curated for readability; which ones appear
 * is driven by what is actually in the pool (see catalogueSections below),
 * so widening the exercise pool cannot leave a category unreachable — which
 * is what happened when mechanical/neuro/prep/finisher/cooldown became
 * pickable but this list still named only five.
 */
const CATEGORY_SECTION_LABELS: Record<string, string> = {
  main: 'Main Lifts',
  accessory: 'Accessories',
  mechanical: 'Mechanical',
  neuro: 'Power',
  prep: 'Warm-Up',
  finisher: 'Finishers',
  prehab: 'Prehab',
  cooldown: 'Cooldown',
};

/** Order the rail lists sections in; anything unknown falls to the end. */
const CATEGORY_ORDER = [
  'main',
  'accessory',
  'mechanical',
  'neuro',
  'prep',
  'finisher',
  'prehab',
  'cooldown',
];

const EQUIPMENT_FILTER_OPTIONS: { key: InternalTier; label: string }[] = [
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'fullgym', label: 'Gym' },
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
/**
 * Movement filters, by compound PATTERN GROUP rather than by the raw
 * `movementPattern` field. The database does not distinguish horizontal from
 * vertical pushing or pulling — bench and overhead press are both "push" — and
 * that is exactly the distinction someone building a Push/Pull/Legs or
 * Upper/Lower week needs. See lib/exercise-classification.ts.
 */
const PATTERN_FILTERS: { key: PatternGroup; label: string }[] = COMPOUND_PATTERN_ORDER.map(
  (k) => ({ key: k, label: PATTERN_GROUP_LABELS[k] })
);

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

/**
 * Where the user is in the build.
 *
 *   start     — pick a goal and a focus, or load a saved template
 *   step      — one block of the assembly line at a time
 *   review    — the whole session in the order it will be performed
 *   catalogue — the old flat repository, kept as the escape hatch
 *
 * The catalogue is unchanged and still reachable in one tap, because a guided
 * flow that cannot be stepped out of is a worse repository, not a better one.
 * It does two jobs now: a free build from the start screen, and "find me
 * something the filter left out" from inside a step, which is what
 * `catalogueTarget` distinguishes.
 */
type BuilderStage = 'start' | 'step' | 'review' | 'catalogue';

/** Icon per block, so a step is recognisable before its title is read. */
const BLOCK_ICONS: Record<BlockId, React.ComponentProps<typeof Ionicons>['name']> = {
  cardio: 'heart-outline',
  mobility: 'accessibility-outline',
  activation: 'flash-outline',
  power: 'rocket-outline',
  kpi: 'barbell-outline',
  accessory: 'layers-outline',
  volume: 'repeat-outline',
  core_prehab: 'shield-checkmark-outline',
  conditioning: 'stopwatch-outline',
};

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
  // Named sessions land in history under this label instead of a generic
  // "Custom Session" — the session screen already accepts displayLabel.
  const [sessionName, setSessionName] = useState('');
  /** The name field folds away — most sessions are never named, and it was
   *  taking a full row of the screen from everyone to serve the few who do. */
  const [nameOpen, setNameOpen] = useState(false);
  /** Equipment, movement pattern, difficulty and fresh-first all lived in two
   *  full-width rows above the list. They are one button and one sheet now. */
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  // ── The guided build ──────────────────────────────────────────────────────
  const [stage, setStage] = useState<BuilderStage>('start');
  const [goal, setGoal] = useState<SessionGoal>('athletic');
  const [focus, setFocus] = useState<SessionFocus>('lower');
  const [stepIndex, setStepIndex] = useState(0);
  const [picks, setPicks] = useState<BuilderPicks>({});
  const [cardioMinutes, setCardioMinutes] = useState(DEFAULT_CARDIO_MINUTES);
  const [stepSearch, setStepSearch] = useState('');
  /** Per-step escape hatch: show the whole block, not just what matches the lift. */
  const [showWholeBlock, setShowWholeBlock] = useState(false);
  /** Set when the catalogue was opened to fill a step rather than to free-build. */
  const [catalogueTarget, setCatalogueTarget] = useState<BlockId | null>(null);

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
      patSet.add(patternGroupOf(e));
      if (e.difficulty) diffSet.add(e.difficulty);
    }
    return {
      availablePatterns: PATTERN_FILTERS.filter((p) => patSet.has(p.key)),
      availableDifficulties: DIFFICULTY_FILTERS.filter((d) => diffSet.has(d.key)),
    };
  }, [allExercises]);

  const attrFiltersActive = patternFilters.size > 0 || difficultyFilters.size > 0;

  /**
   * How many filters are on, for the badge on the filter button.
   *
   * Equipment counts only when it is NARROWER than what the user owns —
   * everything selected is the default state, not a filter, and a button
   * permanently reading "3" would tell nobody anything.
   */
  const activeFilterCount =
    patternFilters.size +
    difficultyFilters.size +
    (freshFirst ? 1 : 0) +
    (equipmentFilters.size > 0 && equipmentFilters.size < ownedTiers.length ? 1 : 0);

  // Built from the pool, so a category can never become unreachable just
  // because a hardcoded list was not updated alongside it.
  const catalogueSections = useMemo(() => {
    const present = new Set(allExercises.map((e) => e.category as string));
    // "Main Lifts" is now defined by movement rather than by template slot, so
    // it must be offered whenever any compound is in the pool — not only when
    // something happens to be filed under category 'main'. On a bodyweight tier
    // that difference is the whole section.
    if (allExercises.some((e) => canBeMainLift(e))) present.add('main');
    const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
    const extras = [...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [
      { key: 'all', label: 'All' },
      ...[...ordered, ...extras].map((c) => ({ key: c, label: CATEGORY_SECTION_LABELS[c] ?? c })),
      { key: 'cardio', label: 'Cardio' },
    ];
  }, [allExercises]);

  const filtered = useMemo(() => {
    // Equipment gate first: never offer a movement the user has no kit for.
    const active = equipmentFilters.size > 0 ? equipmentFilters : new Set(ownedTiers);
    let list = allExercises.filter((e) => {
      const t = tiersByName.get(e.name);
      // No tier recorded means the movement needs no equipment — always allow.
      return !t || t.length === 0 || t.some((x) => active.has(x));
    });
    if (categoryFilter === 'main') {
      /**
       * "Main Lifts" is a question about the MOVEMENT, not about where the
       * template happens to be filed.
       *
       * `category === 'main'` covers 22 of 447 exercises — essentially the
       * barbell big three and their closest variants. So a Goblet Squat, a Lat
       * Pulldown and a Romanian Deadlift could never be a main lift, in any
       * split, for anyone, which is only right if every user is a powerlifter.
       * Filed under the same heading, 187 exercises qualify, spread across all
       * six compound patterns. See lib/exercise-classification.ts.
       */
      list = list.filter((e) => canBeMainLift(e));
    } else if (categoryFilter === 'accessory') {
      // The other side of the same coin: an accessory section that excluded
      // every compound would be missing most of what people actually use as
      // accessories, so this stays a category filter and simply drops the
      // movements now surfaced above it.
      list = list.filter((e) => e.category === 'accessory' && !canBeMainLift(e));
    } else if (categoryFilter !== 'all') {
      list = list.filter((e) => e.category === categoryFilter);
    }
    if (patternFilters.size > 0) {
      list = list.filter((e) => patternFilters.has(patternGroupOf(e)));
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

  const totalPicked = selected.length + selectedCardio.length;

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

  const [editingBlock, setEditingBlock] = useState<BlockId | null>(null);

  const openEditModal = useCallback((sel: SelectedExercise, block: BlockId | null = null) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingBlock(block);
    setEditingExercise(sel);
    setEditSets(sel.sets);
    setEditReps(sel.reps);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingExercise) return;
    const id = editingExercise.template.id;
    if (editingBlock) {
      setPicks((prev) => ({
        ...prev,
        [editingBlock]: (prev[editingBlock] ?? []).map((p) =>
          p.template.id === id ? { ...p, sets: editSets, reps: editReps.trim() || p.reps } : p
        ),
      }));
    } else {
      setSelected((prev) =>
        prev.map((s) =>
          s.template.id === id ? { ...s, sets: editSets, reps: editReps.trim() || s.reps } : s
        )
      );
    }
    setEditingExercise(null);
    setEditingBlock(null);
  }, [editingExercise, editingBlock, editSets, editReps]);

  // ── Assembly-line state ───────────────────────────────────────────────────

  const blocks = useMemo(() => blocksForGoal(goal), [goal]);
  const activeBlock: BuilderBlock | undefined = blocks[stepIndex];

  /** The lift the session is built on, once it has been chosen. */
  const kpiTemplate = picks.kpi?.[0]?.template ?? null;
  const relevanceCtx = useMemo(() => ({ focus, kpi: kpiTemplate }), [focus, kpiTemplate]);

  /** No exercise fills two slots of the same session. */
  const pickedNames = useMemo(() => {
    const names = new Set<string>();
    for (const [id, list] of Object.entries(picks)) {
      if (id === activeBlock?.id) continue;
      for (const p of list ?? []) names.add(p.template.name);
    }
    return names;
  }, [picks, activeBlock]);

  const stepOptions = useMemo(() => {
    if (!activeBlock) return { options: [], widened: false, all: [] };
    return optionsForBlock(activeBlock, relevanceCtx, ownedTiers, pickedNames);
  }, [activeBlock, relevanceCtx, ownedTiers, pickedNames]);

  /**
   * The list a step shows.
   *
   * Three widths, in one direction: what suits the lift, then the whole block,
   * then — through the catalogue — everything. Anything already picked is kept
   * visible whatever the filter says, so narrowing the list can never make a
   * choice you already made disappear.
   */
  const stepList = useMemo(() => {
    if (!activeBlock) return [];
    const base = showWholeBlock ? stepOptions.all : stepOptions.options;
    const chosen = picks[activeBlock.id] ?? [];
    const merged = [...chosen.map((p) => p.template)];
    for (const t of base) if (!merged.some((m) => m.id === t.id)) merged.push(t);
    const q = stepSearch.trim().toLowerCase();
    return q ? merged.filter((t) => t.name.toLowerCase().includes(q)) : merged;
  }, [activeBlock, showWholeBlock, stepOptions, picks, stepSearch]);

  const pickOf = useCallback(
    (t: ExerciseTemplate): BuilderPick => ({ template: t, sets: t.sets, reps: t.reps }),
    []
  );

  /**
   * Move to a step, filling it in if it has never been visited.
   *
   * The default is the top-ranked option (or two, where the block is built
   * around two), which is what lets someone hold Next and still finish with a
   * coherent session. An emptied block stays empty — `[]` means the user
   * skipped it deliberately, `undefined` means they have not been there yet.
   */
  const goToStep = useCallback(
    (index: number) => {
      const block = blocks[index];
      if (!block) return;
      setStepIndex(index);
      setStepSearch('');
      setShowWholeBlock(false);
      setPicks((prev) => {
        if (prev[block.id] !== undefined) return prev;
        const others = new Set<string>();
        for (const [id, list] of Object.entries(prev)) {
          if (id === block.id) continue;
          for (const p of list ?? []) others.add(p.template.name);
        }
        const { options } = optionsForBlock(block, { focus, kpi: prev.kpi?.[0]?.template ?? null }, ownedTiers, others);
        return { ...prev, [block.id]: options.slice(0, block.picks).map(pickOf) };
      });
    },
    [blocks, focus, ownedTiers, pickOf]
  );

  const startBuild = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPicks({});
    setSelected([]);
    setSelectedCardio([]);
    setLoadedTemplateId(null);
    setStage('step');
    goToStep(0);
  }, [goToStep]);

  const nextStep = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stepIndex >= blocks.length - 1) {
      setStage('review');
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, blocks.length, goToStep]);

  const backStep = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    if (stepIndex === 0) {
      setStage('start');
      return;
    }
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const skipStep = useCallback(() => {
    if (!activeBlock) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setPicks((prev) => ({ ...prev, [activeBlock.id]: [] }));
    if (stepIndex >= blocks.length - 1) {
      setStage('review');
      return;
    }
    goToStep(stepIndex + 1);
  }, [activeBlock, stepIndex, blocks.length, goToStep]);

  /**
   * Tap an exercise in a step.
   *
   * A block built around one exercise behaves like a radio button — tapping a
   * different KPI lift swaps it rather than adding a second one — and a block
   * built around several behaves like a checkbox. Anything else means a step
   * that says "choose one" and then lets you choose four.
   *
   * Tapping the one exercise a required block holds does nothing, rather than
   * emptying it. Otherwise the obvious gesture for "I want a different main
   * lift" — tap the highlighted one — leaves the step with nothing chosen and
   * the Next button greyed out, with no way back but a second guess.
   */
  const togglePick = useCallback(
    (block: BuilderBlock, t: ExerciseTemplate) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPicks((prev) => {
        const current = prev[block.id] ?? [];
        const already = current.some((p) => p.template.id === t.id);
        if (already) {
          if (!block.optional && current.length <= 1) return prev;
          return { ...prev, [block.id]: current.filter((p) => p.template.id !== t.id) };
        }
        const next: BuilderPicks =
          block.picks === 1
            ? { ...prev, [block.id]: [pickOf(t)] }
            : { ...prev, [block.id]: [...current, pickOf(t)] };
        // Changing the lift the session is built on re-filters everything that
        // claims to be matched to it.
        if (block.id !== 'kpi') return next;
        return refreshForKpi(goal, next, { focus, kpi: t }, ownedTiers);
      });
    },
    [pickOf, goal, focus, ownedTiers]
  );

  const removePick = useCallback(
    (block: BuilderBlock, id: string) => {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      setPicks((prev) => {
        const current = prev[block.id] ?? [];
        if (!block.optional && current.length <= 1) return prev;
        return { ...prev, [block.id]: current.filter((p) => p.template.id !== id) };
      });
    },
    []
  );

  const openCatalogueFor = useCallback((blockId: BlockId) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCatalogueTarget(blockId);
    setSearch('');
    setCategoryFilter('all');
    setStage('catalogue');
  }, []);

  /** The built session, in the order a generated one arrives in. */
  const guidedExercises = useMemo(
    () => assembleSession(goal, picks, cardioMinutes),
    [goal, picks, cardioMinutes]
  );

  const handleStartGuided = useCallback(() => {
    if (guidedExercises.length === 0) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingCustomExercises(guidedExercises);
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
        ...(sessionName.trim() ? { displayLabel: sessionName.trim() } : {}),
      },
    });
  }, [guidedExercises, setPendingCustomExercises, tier, sessionName]);

  /**
   * The catalogue serves two masters.
   *
   * Opened from the start screen it builds a flat session, exactly as before.
   * Opened from a step it is filling that step, so a tap lands in the block
   * rather than in the flat tray and the bottom bar takes you back rather than
   * starting a session.
   */
  const catalogueBlock = useMemo(
    () => (catalogueTarget ? (blocks.find((b) => b.id === catalogueTarget) ?? null) : null),
    [catalogueTarget, blocks]
  );

  const catalogueSelected = useMemo(
    () =>
      catalogueBlock
        ? (picks[catalogueBlock.id] ?? []).map((p) => ({
            template: p.template,
            sets: p.sets,
            reps: p.reps,
          }))
        : selected,
    [catalogueBlock, picks, selected]
  );

  const catalogueSelectedIds = useMemo(
    () => new Set(catalogueSelected.map((s) => s.template.id)),
    [catalogueSelected]
  );

  const onCataloguePick = useCallback(
    (t: ExerciseTemplate) => {
      if (catalogueBlock) togglePick(catalogueBlock, t);
      else toggleExercise(t);
    },
    [catalogueBlock, togglePick, toggleExercise]
  );

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
        ...(sessionName.trim() ? { displayLabel: sessionName.trim() } : {}),
      },
    });
  }, [selected, selectedCardio, setPendingCustomExercises, tier, sessionName]);

  const openSaveModal = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTemplateName(sessionName.trim());
    setSaveModalVisible(true);
  }, [sessionName]);

  const closeSaveModal = useCallback(() => {
    setSaveModalVisible(false);
    setLoadedTemplateId(null);
  }, []);

  const confirmSaveTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name) return;
    // A guided build is already an ordered list of CustomExercises, blocks and
    // all, so it saves as itself rather than being flattened back through the
    // catalogue's model.
    if (stage === 'review') {
      saveTemplate(name, guidedExercises);
      setSaveModalVisible(false);
      setLoadedTemplateId(null);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
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
  }, [templateName, selected, selectedCardio, saveTemplate, stage, guidedExercises]);

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
      // A saved template is a finished session. It opens in the catalogue,
      // where every exercise in it is visible and editable at once — walking
      // someone back through eight steps to change one accessory would be
      // slower than the flat list they saved it from.
      setCatalogueTarget(null);
      setStage('catalogue');
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
    const isSelected = catalogueSelectedIds.has(item.id);
    const selEntry = catalogueSelected.find((s) => s.template.id === item.id);
    const lastDone = getLastDone(item);
    const recent = lastDone ? recentLabel(lastDone) : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 18).duration(280)}>
        <Pressable
          onPress={() => onCataloguePick(item)}
          onLongPress={() =>
            isSelected && selEntry
              ? openEditModal(selEntry, catalogueBlock?.id ?? null)
              : undefined
          }
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
              {/* The pattern GROUP, not the raw field — "Push (vertical)" tells
                  you what slot this fills; "push" does not distinguish a bench
                  press from an overhead press. Paired with the tier, so the
                  card says both what the movement is and how central it is. */}
              <View style={[styles.categoryPill, { backgroundColor: C.surfaceSecondary }]}>
                <Text style={[styles.categoryPillText, { color: C.textSecondary }]}>
                  {PATTERN_GROUP_LABELS[patternGroupOf(item)]}
                </Text>
              </View>
              <View style={[styles.categoryPill, { backgroundColor: C.surfaceSecondary }]}>
                <Text style={[styles.categoryPillText, { color: C.textSecondary }]}>
                  {TIER_LABELS[tierOf(item)]}
                </Text>
              </View>
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
                  <Ionicons name="time-outline" size={10} color={C.primaryText} />
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
                  <Ionicons name="bookmark" size={14} color={C.primaryText} />
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

  const renderEditModal = () => (
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
  );

  const renderSaveModal = () => (
    <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={closeSaveModal}>
      <Pressable style={styles.modalOverlay} onPress={closeSaveModal}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.saveModalHeader}>
            <Ionicons name="bookmark" size={20} color={C.primaryText} />
            <Text style={styles.modalTitle}>Save as Template</Text>
          </View>
          <Text style={styles.modalSub}>
            {stage === 'review' ? guidedExercises.length : selected.length} exercise
            {(stage === 'review' ? guidedExercises.length : selected.length) !== 1 ? 's' : ''} will
            be saved
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
                  <Ionicons name="refresh-outline" size={16} color={C.primaryText} />
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
  );

  const renderRenameModal = () => (
    <Modal
      visible={!!renamingTemplate}
      transparent
      animationType="fade"
      onRequestClose={() => setRenamingTemplate(null)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setRenamingTemplate(null)}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.saveModalHeader}>
            <Ionicons name="pencil" size={20} color={C.primaryText} />
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
  );

  const guidedHeader = (title: string, subtitle: string, onBack: () => void) => (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          testID="custom-session-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={C.textInverse} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setNameOpen((v) => !v);
          }}
          style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.7 }]}
          testID="custom-session-name-toggle"
          accessibilityLabel="Name this session"
          accessibilityRole="button"
        >
          <Ionicons name={nameOpen ? 'create' : 'create-outline'} size={19} color={C.textInverse} />
        </Pressable>
      </View>
      {nameOpen && (
        <TextInput
          style={styles.heroNameInput}
          placeholder="Name this session (optional)"
          placeholderTextColor={C.primaryMuted}
          value={sessionName}
          onChangeText={setSessionName}
          returnKeyType="done"
          maxLength={40}
          autoFocus
          testID="custom-session-name"
        />
      )}
    </View>
  );

  /**
   * Step 1. Goal, and what is being trained.
   *
   * The goal decides which blocks the session has; the focus decides what the
   * warm-up is warming up. Both are answered before anything is picked, which
   * is what stops the preparation sequence being generic.
   */
  const renderStart = () => (
    <>
      {guidedHeader(
        sessionName.trim() || 'Build a session',
        `Step 1 of ${blocks.length + 1} - what are you training for`,
        () => router.back()
      )}
      <ScrollView
        contentContainerStyle={[styles.startContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.startGroupLabel}>Primary goal</Text>
        {SESSION_GOALS.map((g) => {
          const active = goal === g.key;
          return (
            <Pressable
              key={g.key}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setGoal(g.key);
              }}
              style={({ pressed }) => [
                styles.goalCard,
                active && styles.goalCardActive,
                pressed && { opacity: 0.85 },
              ]}
              testID={`builder-goal-${g.key}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalCardTitle, active && { color: C.primaryText }]}>
                  {g.label}
                </Text>
                <Text style={styles.goalCardBlurb}>{g.blurb}</Text>
              </View>
              <View style={[styles.checkCircle, active && styles.checkCircleSelected]}>
                {active && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.startGroupLabel}>Training today</Text>
        <View style={styles.sheetChipWrap}>
          {SESSION_FOCUSES.map((f) => {
            const active = focus === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setFocus(f.key);
                }}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                testID={`builder-focus-${f.key}`}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.startFocusBlurb}>
          {SESSION_FOCUSES.find((f) => f.key === focus)?.blurb}
        </Text>

        <Text style={styles.startPlanLabel}>Your session</Text>
        <View style={styles.planRow}>
          {blocks.map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 && <Ionicons name="chevron-forward" size={11} color={C.textTertiary} />}
              <Text style={styles.planChip}>{b.title}</Text>
            </React.Fragment>
          ))}
        </View>

        <Pressable
          onPress={startBuild}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
          testID="builder-begin"
        >
          <Ionicons name="play" size={18} color={C.textInverse} />
          <Text style={styles.primaryBtnText}>Build my session</Text>
        </Pressable>

        {TemplatesSection}

        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            setCatalogueTarget(null);
            setStage('catalogue');
          }}
          style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
          testID="builder-open-catalogue"
        >
          <Ionicons name="albums-outline" size={15} color={C.primaryText} />
          <Text style={styles.linkBtnText}>Browse the full catalogue instead</Text>
        </Pressable>
      </ScrollView>
    </>
  );

  /** One block of the assembly line. */
  const renderStep = () => {
    if (!activeBlock) return null;
    const chosen = picks[activeBlock.id] ?? [];
    const chosenIds = new Set(chosen.map((p) => p.template.id));
    const isLast = stepIndex === blocks.length - 1;
    const filterLabel = kpiTemplate
      ? `Matched to ${kpiTemplate.name}`
      : `Matched to ${SESSION_FOCUSES.find((f) => f.key === focus)?.label.toLowerCase()} training`;

    return (
      <>
        {guidedHeader(
          activeBlock.title,
          `Step ${stepIndex + 2} of ${blocks.length + 1}`,
          backStep
        )}

        <View style={styles.stepDots}>
          {blocks.map((b, i) => (
            <View
              key={b.id}
              style={[
                styles.stepDot,
                i === stepIndex && styles.stepDotActive,
                i < stepIndex && styles.stepDotDone,
              ]}
            />
          ))}
        </View>

        <View style={styles.stepMeta}>
          <View style={styles.stepPurposeRow}>
            <Ionicons name={BLOCK_ICONS[activeBlock.id]} size={15} color={C.primaryText} />
            <Text style={styles.stepPurpose}>{activeBlock.purpose}</Text>
          </View>
          <Text style={styles.stepFilterNote} testID="step-filter-note">
            {showWholeBlock
              ? `Every ${activeBlock.title.toLowerCase()} option for your equipment`
              : stepOptions.widened
                ? `${filterLabel} - widened, too few exact matches for your equipment`
                : filterLabel}
          </Text>

          {activeBlock.id === 'cardio' && (
            <View style={styles.minuteRow}>
              <Text style={styles.minuteLabel}>Minutes</Text>
              {CARDIO_MINUTES.map((m) => {
                const active = cardioMinutes === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setCardioMinutes(m);
                    }}
                    style={({ pressed }) => [
                      styles.minuteChip,
                      active && styles.minuteChipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    testID={`cardio-minutes-${m}`}
                  >
                    <Text style={[styles.minuteChipText, active && styles.minuteChipTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.stepSearchRow}>
            <View style={[styles.searchRow, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
              <Ionicons name="search" size={16} color={C.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${activeBlock.title.toLowerCase()}…`}
                placeholderTextColor={C.textTertiary}
                value={stepSearch}
                onChangeText={setStepSearch}
                returnKeyType="search"
                autoCorrect={false}
                testID="step-search"
              />
            </View>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setShowWholeBlock((v) => !v);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                showWholeBlock && styles.filterChipActive,
                pressed && { opacity: 0.8 },
              ]}
              testID="step-show-all"
            >
              <Text
                style={[styles.filterChipText, showWholeBlock && styles.filterChipTextActive]}
              >
                All
              </Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={stepList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = chosenIds.has(item.id);
            const entry = chosen.find((p) => p.template.id === item.id);
            return (
              <Pressable
                onPress={() => togglePick(activeBlock, item)}
                onLongPress={() =>
                  isSelected && entry ? openEditModal(entry, activeBlock.id) : undefined
                }
                style={({ pressed }) => [
                  styles.exerciseCard,
                  isSelected && styles.exerciseCardSelected,
                  pressed && { opacity: 0.85 },
                ]}
                testID={`step-exercise-${item.id}`}
              >
                <View style={styles.exerciseCardLeft}>
                  <View style={styles.exerciseCardPills}>
                    <View style={[styles.categoryPill, { backgroundColor: C.surfaceSecondary }]}>
                      <Text style={[styles.categoryPillText, { color: C.textSecondary }]}>
                        {PATTERN_GROUP_LABELS[patternGroupOf(item)]}
                      </Text>
                    </View>
                    {item.primaryMuscle && (
                      <View style={[styles.categoryPill, { backgroundColor: C.surfaceSecondary }]}>
                        <Text style={[styles.categoryPillText, { color: C.textSecondary }]}>
                          {item.primaryMuscle}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {activeBlock.id === 'cardio'
                      ? `${cardioMinutes} min · ${item.suggestedLoad}`
                      : `${entry?.sets ?? item.sets} sets · ${entry?.reps ?? item.reps} · ${item.suggestedLoad}`}
                  </Text>
                </View>
                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <Pressable
              onPress={() => openCatalogueFor(activeBlock.id)}
              style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
              testID="step-open-catalogue"
            >
              <Ionicons name="albums-outline" size={15} color={C.primaryText} />
              <Text style={styles.linkBtnText}>Not here? Search the full catalogue</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Nothing matches that search"
              subtitle="Clear the search, or tap All to see the whole block"
              testID="step-empty"
            />
          }
        />

        <View style={[styles.stepFooter, { paddingBottom: insets.bottom + 12 }]}>
          {activeBlock.optional && (
            <Pressable
              onPress={skipStep}
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
              testID="step-skip"
            >
              <Text style={styles.ghostBtnText}>Skip</Text>
            </Pressable>
          )}
          <Pressable
            onPress={nextStep}
            disabled={chosen.length === 0 && !activeBlock.optional}
            style={({ pressed }) => [
              styles.primaryBtn,
              { flex: 1, marginTop: 0 },
              chosen.length === 0 && !activeBlock.optional && styles.modalSaveBtnDisabled,
              pressed && { opacity: 0.88 },
            ]}
            testID="step-next"
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? 'Review session' : `Next · ${chosen.length} chosen`}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={C.textInverse} />
          </Pressable>
        </View>
      </>
    );
  };

  /** The finished session, in the order it will be performed. */
  const renderReview = () => (
    <>
      {guidedHeader(
        sessionName.trim() || 'Your session',
        `${guidedExercises.length} exercise${guidedExercises.length === 1 ? '' : 's'} · ${SESSION_GOALS.find((g) => g.key === goal)?.label}`,
        () => {
          setStage('step');
          goToStep(blocks.length - 1);
        }
      )}
      <ScrollView
        contentContainerStyle={[styles.startContent, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {blocks.map((block, blockIdx) => {
          const list = picks[block.id] ?? [];
          return (
            <View key={block.id} style={styles.reviewBlock}>
              <View style={styles.reviewBlockHead}>
                <Ionicons name={BLOCK_ICONS[block.id]} size={14} color={C.primaryText} />
                <Text style={styles.reviewBlockTitle}>{block.title}</Text>
                <Pressable
                  onPress={() => {
                    setStage('step');
                    goToStep(blockIdx);
                  }}
                  hitSlop={8}
                  testID={`review-edit-${block.id}`}
                >
                  <Text style={styles.reviewEditText}>{list.length === 0 ? 'Add' : 'Change'}</Text>
                </Pressable>
              </View>
              {list.length === 0 ? (
                <Text style={styles.reviewSkipped}>Skipped</Text>
              ) : (
                list.map((p) => (
                  <Pressable
                    key={p.template.id}
                    onPress={() => openEditModal(p, block.id)}
                    style={({ pressed }) => [styles.reviewRow, pressed && { opacity: 0.8 }]}
                    testID={`review-row-${p.template.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewRowName}>{p.template.name}</Text>
                      <Text style={styles.reviewRowMeta}>
                        {block.id === 'cardio'
                          ? `${cardioMinutes} min steady`
                          : `${p.sets} sets · ${p.reps} · ${p.template.suggestedLoad}`}
                      </Text>
                    </View>
                    {/* A required block can be changed but not emptied. */}
                    {block.optional && (
                      <Pressable
                        onPress={() => removePick(block, p.template.id)}
                        hitSlop={8}
                        style={styles.trayChipRemove}
                        accessibilityLabel="Remove exercise"
                        accessibilityRole="button"
                      >
                        <Ionicons name="close" size={15} color={C.textSecondary} />
                      </Pressable>
                    )}
                  </Pressable>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.stepFooter, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={openSaveModal}
          style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
          testID="review-save-template"
        >
          <Ionicons name="bookmark-outline" size={15} color={C.primaryText} />
          <Text style={styles.ghostBtnText}>Save</Text>
        </Pressable>
        <Pressable
          onPress={handleStartGuided}
          disabled={guidedExercises.length === 0}
          style={({ pressed }) => [
            styles.primaryBtn,
            { flex: 1, marginTop: 0 },
            guidedExercises.length === 0 && styles.modalSaveBtnDisabled,
            pressed && { opacity: 0.88 },
          ]}
          testID="review-start"
        >
          <Ionicons name="play" size={17} color={C.textInverse} />
          <Text style={styles.primaryBtnText}>Start Session</Text>
        </Pressable>
      </View>
    </>
  );

  if (stage === 'start') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        {renderStart()}
        {renderSaveModal()}
        {renderRenameModal()}
      </View>
    );
  }

  if (stage === 'step') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        {renderStep()}
        {renderEditModal()}
      </View>
    );
  }

  if (stage === 'review') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        {renderReview()}
        {renderEditModal()}
        {renderSaveModal()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* ONE HEADER BLOCK, NOT FOUR ROWS OF CHROME.
          Before this there were four full-width control rows stacked above the
          list — a name field, a search field, an equipment row and a horizontal
          filter row — so roughly 200pt of the screen was spent before a single
          exercise appeared. Two of them were identical-looking text inputs,
          which is its own kind of confusing.

          The header is a tinted block so this screen reads as its own place
          rather than another card list. Search is the one control that earns
          permanent space. The name field folds away until wanted, and every
          other filter lives behind one button that says how many are on. */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable
            onPress={() => {
              if (catalogueBlock) {
                setCatalogueTarget(null);
                setStage('step');
                return;
              }
              setStage('start');
            }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            testID="custom-session-back"
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color={C.textInverse} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {catalogueBlock ? catalogueBlock.title : sessionName.trim() || 'Build a session'}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {catalogueBlock
                ? 'Whole catalogue - anything you tap fills this block'
                : totalPicked === 0
                  ? 'Pick the exercises you want'
                  : `${totalPicked} exercise${totalPicked === 1 ? '' : 's'} picked`}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setNameOpen((v) => !v);
            }}
            style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.7 }]}
            testID="custom-session-name-toggle"
            accessibilityLabel="Name this session"
            accessibilityRole="button"
          >
            <Ionicons
              name={nameOpen ? 'create' : 'create-outline'}
              size={19}
              color={C.textInverse}
            />
          </Pressable>
        </View>

        {nameOpen && (
          <TextInput
            style={styles.heroNameInput}
            placeholder="Name this session (optional)"
            placeholderTextColor={C.primaryMuted}
            value={sessionName}
            onChangeText={setSessionName}
            returnKeyType="done"
            maxLength={40}
            autoFocus
            testID="custom-session-name"
          />
        )}

        <View style={styles.heroControls}>
          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={17}
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
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFiltersOpen(true);
            }}
            style={({ pressed }) => [
              styles.filterBtn,
              activeFilterCount > 0 && styles.filterBtnActive,
              pressed && { opacity: 0.85 },
            ]}
            testID="custom-open-filters"
            accessibilityLabel="Filters"
            accessibilityRole="button"
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? C.primaryDarkText : C.text}
            />
            {activeFilterCount > 0 && (
              <Text style={styles.filterBtnCount}>{activeFilterCount}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.browseRow}>
        {/* Catalogue rail — replaces the horizontal chip row, which pushed the
            list down and truncated section names on narrow screens. */}
        <ScrollView
          style={styles.rail}
          contentContainerStyle={styles.railContent}
          showsVerticalScrollIndicator={false}
        >
          {catalogueSections.map((sec) => {
            const active = categoryFilter === sec.key;
            return (
              <Pressable
                key={sec.key}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setCategoryFilter(sec.key);
                }}
                style={({ pressed }) => [
                  styles.railItem,
                  active && styles.railItemActive,
                  pressed && { opacity: 0.75 },
                ]}
                testID={`custom-cat-${sec.key}`}
              >
                <Text
                  style={[styles.railItemText, active && styles.railItemTextActive]}
                  numberOfLines={1}
                >
                  {sec.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.browsePane}>
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
                        color={isSelected ? C.primaryText : C.textSecondary}
                      />
                      <Text style={[styles.exerciseName, isSelected && { color: C.primaryText }]}>
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
                            color: C.primaryText,
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
              {!catalogueBlock && TemplatesSection}
              {!catalogueBlock && selected.length === 0 && filtered.length > 0 && !hasEverSelected && (
                <View style={styles.selectionHint}>
                  <Ionicons name="hand-left-outline" size={14} color={C.primaryText} />
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
        </View>
      </View>

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

      {catalogueBlock && (
        <View
          style={[
            styles.tray,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 },
          ]}
        >
          <Text style={styles.trayCount} numberOfLines={2}>
            {catalogueSelected.length === 0
              ? `Nothing chosen for ${catalogueBlock.title} yet`
              : catalogueSelected.map((s) => s.template.name).join(', ')}
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCatalogueTarget(null);
              setStage('step');
            }}
            style={({ pressed }) => [styles.startBtn, { marginTop: 12 }, pressed && { opacity: 0.88 }]}
            testID="catalogue-done"
          >
            <Ionicons name="checkmark" size={18} color={C.textInverse} />
            <Text style={styles.startBtnText}>Back to {catalogueBlock.title}</Text>
          </Pressable>
        </View>
      )}

      {!catalogueBlock && (selected.length > 0 || selectedCardio.length > 0) && (
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
                <Ionicons name="bookmark-outline" size={15} color={C.primaryText} />
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
                        color={isDragged ? C.primaryText : C.textTertiary}
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
                  <Ionicons name={c.icon} size={14} color={C.primaryText} style={{ marginRight: 4 }} />
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

      {renderEditModal()}
      {renderSaveModal()}

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

      {renderRenameModal()}

      {/* FILTERS, IN ONE PLACE.
          These chips used to sit in a horizontal ScrollView above the list,
          which meant everything past the fourth one was off the right edge —
          the difficulty filters and "Fresh first" were present but effectively
          invisible. In a sheet they wrap, so you can see the whole set at once
          and choose deliberately. Not shown at all until asked for. */}
      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setFiltersOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]
            }
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeadRow}>
              <Text style={styles.sheetTitle}>Filters</Text>
              {activeFilterCount > 0 && (
                <Pressable
                  onPress={() => {
                    clearAttrFilters();
                    setFreshFirst(false);
                    setEquipmentFilters(new Set(ownedTiers));
                  }}
                  testID="custom-clear-filters"
                >
                  <Text style={styles.sheetClear}>Clear all</Text>
                </Pressable>
              )}
            </View>

            {ownedTiers.length > 1 && (
              <View style={styles.sheetGroup}>
                <Text style={styles.sheetGroupLabel}>Equipment</Text>
                <View style={styles.sheetChipWrap}>
                  {EQUIPMENT_FILTER_OPTIONS.filter((o) => ownedTiers.includes(o.key)).map((o) => {
                    const active = equipmentFilters.has(o.key);
                    return (
                      <Pressable
                        key={o.key}
                        onPress={() => {
                          if (Platform.OS !== 'web')
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEquipmentFilters((prev) => {
                            const next = new Set(prev);
                            if (next.has(o.key)) next.delete(o.key);
                            else next.add(o.key);
                            return next;
                          });
                        }}
                        style={({ pressed }) => [
                          styles.filterChip,
                          active && styles.filterChipActive,
                          pressed && { opacity: 0.8 },
                        ]}
                        testID={`custom-equip-${o.key}`}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {(availablePatterns.length > 0 || availableDifficulties.length > 0) && (
              <View style={styles.sheetGroup}>
                <Text style={styles.sheetGroupLabel}>Movement and difficulty</Text>
                <View style={styles.sheetChipWrap}>
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
                  color={freshFirst ? C.primaryText : C.textSecondary}
                />
                <Text style={[styles.filterChipText, freshFirst && styles.filterChipTextActive]}>
                  Fresh first
                </Text>
              </Pressable>
            </>
          )}

                </View>
              </View>
            )}

            <Pressable
              onPress={() => setFiltersOpen(false)}
              style={({ pressed }) => [styles.sheetDoneBtn, pressed && { opacity: 0.9 }]}
              testID="custom-filters-done"
            >
              <Text style={styles.sheetDoneText}>Show exercises</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    /**
     * A tinted header block, not another white card.
     *
     * Asked for: "have its own individual UI rather than just along with the
     * theme". Every other screen in the app is neutral cards on a neutral
     * background, which is right for reading your own data and wrong for a
     * workbench. Filling the top with the brand colour gives this screen a
     * place of its own and, more usefully, marks where the controls end and
     * the catalogue begins — which is exactly the boundary that was missing.
     */
    hero: {
      backgroundColor: C.primaryDark,
      paddingHorizontal: 14,
      paddingBottom: 12,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingBottom: 10,
    },
    heroTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', color: C.primaryDarkText },
    heroSub: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.primaryDarkText,
      opacity: 0.75,
      marginTop: 1,
    },
    heroIconBtn: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroNameInput: {
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.primaryDarkText,
    },
    heroControls: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 42,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: C.surface,
    },
    filterBtnActive: { backgroundColor: C.primary },
    filterBtnCount: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.primaryDarkText },

    // ── The guided build ────────────────────────────────────────────────────
    startContent: { paddingHorizontal: 16, paddingTop: 18 },
    startGroupLabel: {
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 6,
    },
    goalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
      padding: 14,
      marginBottom: 8,
    },
    goalCardActive: { borderColor: C.primary, backgroundColor: C.primaryMuted },
    goalCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
    goalCardBlurb: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    startFocusBlurb: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 8,
    },
    startPlanLabel: {
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 20,
      marginBottom: 8,
    },
    planRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 4,
    },
    planChip: {
      fontSize: 11.5,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: 22,
    },
    primaryBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 15,
      borderRadius: 14,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    ghostBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      marginTop: 6,
    },
    linkBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },

    stepDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
      paddingTop: 10,
    },
    stepDot: {
      width: 18,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
    },
    stepDotActive: { backgroundColor: C.primary, width: 26 },
    stepDotDone: { backgroundColor: C.primaryLight },
    stepMeta: { paddingHorizontal: 16, paddingTop: 12 },
    stepPurposeRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    stepPurpose: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.text,
    },
    stepFilterNote: {
      fontSize: 11.5,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 4,
      marginLeft: 22,
    },
    stepSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    minuteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    minuteLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginRight: 2,
    },
    minuteChip: {
      width: 38,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    minuteChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    minuteChipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    minuteChipTextActive: { color: C.primaryText, fontFamily: 'Inter_700Bold' },
    stepFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: C.surface,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },

    reviewBlock: { marginBottom: 16 },
    reviewBlockHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    reviewBlockTitle: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reviewEditText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
    reviewSkipped: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      paddingLeft: 20,
    },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 6,
    },
    reviewRowName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    reviewRowMeta: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },

    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 14,
    },
    sheetHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sheetTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    sheetClear: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
    sheetGroupLabel: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      marginBottom: 8,
    },
    sheetGroup: { marginBottom: 18 },
    sheetChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sheetDoneBtn: {
      backgroundColor: C.primaryDark,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 2,
    },
    sheetDoneText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primaryDarkText },
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

    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    nameInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      padding: 0,
    },
    equipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginBottom: 10,
      flexShrink: 0,
    },
    equipLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginRight: 2,
    },
    equipChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    equipChipActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    equipChipText: {
      fontSize: 11.5,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    equipChipTextActive: {
      color: C.primaryText,
      fontFamily: 'Inter_700Bold',
    },
    browseRow: {
      flex: 1,
      flexDirection: 'row',
    },
    browsePane: {
      flex: 1,
    },
    /**
     * The category rail.
     *
     * It was 104pt wide with 20pt of padding, leaving ~76pt for a 12.5px label
     * — narrower than the word "Accessories", which is why the screenshot
     * showed "Accessorie / s" breaking mid-word. Wider, plus two labels
     * shortened, so nothing wraps at all.
     *
     * It also reads as a rail now rather than a list that happens to have a
     * line beside it: its own recessed background, and the active item a solid
     * pill instead of a tint.
     */
    rail: {
      width: 118,
      flexGrow: 0,
      backgroundColor: C.surfaceTertiary,
    },
    railContent: {
      paddingHorizontal: 8,
      paddingTop: 10,
      paddingBottom: 24,
      gap: 3,
    },
    railItem: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    railItemActive: {
      backgroundColor: C.primaryDark,
    },
    railItemText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    railItemTextActive: {
      color: C.primaryDarkText,
      fontFamily: 'Inter_700Bold',
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
    filterChipTextActive: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },

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
      color: C.primaryText,
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
    saveTemplateBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
      color: C.primaryText,
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
