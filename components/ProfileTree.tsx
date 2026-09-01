/**
 * THE PROFILE BUILDER AS A TREE YOU TRAVEL DOWN.
 *
 * WHY IT IS A SPINE AND NOT A DIAGRAM
 * ───────────────────────────────────
 * A real tree diagram is wide, and a phone is about 390 points across. Twelve
 * questions branching sideways is either unreadable or needs pinching, which is
 * a horrible thing to hand somebody in the first minute of an app.
 *
 * So the tree runs DOWN. One question in focus, the ones already answered
 * collapsing into small rows above with their answers still visible, the path
 * below fading out so you can see there is more coming. Answering scrolls the
 * view rather than swiping it, and that travelling is the whole feeling: a route
 * with a length, not a form with a progress bar.
 *
 * WHY A FORK MEANS SOMETHING
 * ──────────────────────────
 * Most questions are the same for everybody, so the spine is a straight line
 * most of the way down and a branch is rare. When one does open, the rail draws
 * a limb out to the side and writes the reason on it, taken from the node's own
 * `branch.label`: "Because something is sore". Nobody has to wonder why they are
 * being asked something the last person was not.
 *
 * THE TWO TIERS ARE THE ONE STRUCTURAL BOUNDARY
 * ─────────────────────────────────────────────
 * A marked line partway down separates what you want (which chooses your
 * programme) from what the engine needs (which tunes it). It is drawn because it
 * is true, and because it is where the form would be cut in half if the drop-off
 * numbers ever say it should be.
 *
 * WHAT IT REFUSES TO DO
 * ─────────────────────
 * It never auto-advances off a question somebody is typing into, because
 * finishing a word is not the same as finishing an answer. It never animates for
 * anybody who has asked their phone to stop animating things. And it never
 * scrolls somewhere the person did not cause, which is why every scroll here is
 * a direct consequence of a tap.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useGoColors } from '@/constants/colors';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { bodyweightIssue } from '@/lib/bodyweight';
import { ageIssue, oneRepMaxIssue } from '@/lib/one-rep-max-input';
import {
  isAnswered,
  nextNode,
  treeProgress,
  visibleNodes,
  type Answers,
  type TreeNode,
  type TreeOption,
} from '@/lib/profile-tree';
import type { WeightUnit } from '@/lib/store';

/** Artwork for the equipment question. The only node with pictures. */
const EQUIPMENT_IMAGES: Record<string, number> = {
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
  bands: require('@/assets/images/equipment/bands.png'),
  dumbbells: require('@/assets/images/equipment/dumbbells.png'),
  kettlebells: require('@/assets/images/equipment/kettlebells.png'),
  fullgym: require('@/assets/images/equipment/fullgym.png'),
};

/**
 * Where the focused card lands, measured from the top of the scroll view.
 *
 * Deliberately large. At 74 the card sat almost at the top and the questions
 * already answered were pushed off the screen, so the route behind you was
 * invisible and the whole thing read as a form that redraws itself. Leaving
 * roughly two answered rows in view above is what makes it read as a journey
 * with a length.
 */
const FOCUS_OFFSET = 168;

/**
 * How far ahead the path is drawn.
 *
 * The first version drew every remaining question, which is a table of contents
 * rather than a horizon: there is nothing to travel towards if you can already
 * see the end. Two is enough to promise that more is coming.
 */
const HORIZON = 2;

const TIER_HEADINGS: Record<string, { label: string; hint: string }> = {
  shape: { label: 'What you want', hint: 'These choose your programme' },
  tune: { label: 'About you', hint: 'These set your weights and your exercises' },
};

export interface ProfileTreeProps {
  /** Answers to start from, e.g. a saved draft. */
  initialAnswers?: Answers;
  /** Called on every change, so the caller can persist a draft and apply the
   *  theme and unit answers the moment they are given. */
  onAnswersChange?: (answers: Answers) => void;
  /** Called once every required question has an answer and Finish is pressed. */
  onComplete: (answers: Answers) => void;
  /** The areas the body diagram can adapt around, owned by the Recover tab. */
  regionOptions: TreeOption[];
  /** Which unit the number questions are labelled in. */
  weightUnit: WeightUnit;
}

export function ProfileTree({
  initialAnswers,
  onAnswersChange,
  onComplete,
  regionOptions,
  weightUnit,
}: ProfileTreeProps) {
  const C = useColors();
  const go = useGoColors();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [answers, setAnswers] = useState<Answers>(() => ({ ...(initialAnswers ?? {}) }));
  const nodes = useMemo(() => visibleNodes(answers), [answers]);
  const pending = useMemo(() => nextNode(answers), [answers]);

  /**
   * The question on screen.
   *
   * Held separately from "the first unanswered one" so that going back to change
   * an answer is possible. It is corrected below whenever the tree moves out
   * from under it, which happens when changing a fork answer removes the very
   * node somebody was looking at.
   */
  const [focusId, setFocusId] = useState<string>(() => nextNode(answers)?.id ?? nodes[0]?.id ?? '');

  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  /**
   * The row we are travelling to, until it tells us where it actually is.
   *
   * Changing the focus resizes two rows at once, so every stored position below
   * the higher of them is wrong for one frame. Scrolling on the next frame used
   * those stale numbers and clipped the question off the top of the screen.
   */
  const travelling = useRef<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const focusIndex = Math.max(
    0,
    nodes.findIndex((n) => n.id === focusId)
  );
  const focusNode: TreeNode | undefined = nodes[focusIndex];

  const progress = treeProgress(answers);

  // Correct the focus when the tree changes shape under it.
  useEffect(() => {
    if (!nodes.some((n) => n.id === focusId)) {
      setFocusId(pending?.id ?? nodes[nodes.length - 1]?.id ?? '');
    }
  }, [nodes, focusId, pending]);

  const haptic = useCallback((heavy = false) => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  const scrollToY = useCallback(
    (y: number) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - FOCUS_OFFSET),
        animated: !reduceMotion,
      });
    },
    [reduceMotion]
  );

  /**
   * Travel to a node. Every call here is the direct result of a tap.
   *
   * The scroll happens in landAt below, once the target row has reported its
   * position after the relayout. The timer is only a backstop for the case where
   * nothing about that row's own layout changed, so onLayout never fires.
   */
  const travelTo = useCallback(
    (id: string) => {
      travelling.current = id;
      setFocusId(id);
      setTimeout(() => {
        if (travelling.current !== id) return;
        travelling.current = null;
        const y = positions.current[id];
        if (y != null) scrollToY(y);
      }, 140);
    },
    [scrollToY]
  );

  /** A row reporting where it ended up. */
  const landAt = useCallback(
    (id: string, y: number) => {
      positions.current[id] = y;
      if (travelling.current === id) {
        travelling.current = null;
        scrollToY(y);
      }
    },
    [scrollToY]
  );

  const write = useCallback(
    (patch: Answers) => {
      setAnswers((prev) => {
        const next = { ...prev, ...patch };
        onAnswersChange?.(next);
        return next;
      });
    },
    [onAnswersChange]
  );

  /** Move on from the focused node, if there is anywhere to move on to. */
  const advance = useCallback(
    (from: Answers) => {
      const list = visibleNodes(from);
      const here = list.findIndex((n) => n.id === focusId);
      const after = list.slice(here + 1);
      const target = after.find((n) => !isAnswered(n, from)) ?? after[0];
      if (target) travelTo(target.id);
      else setFinishing(true);
    },
    [focusId, travelTo]
  );

  const answerSingle = useCallback(
    (node: TreeNode, value: string) => {
      haptic();
      const next = { ...answers, [node.id]: value };
      write({ [node.id]: value });
      // Single-choice questions travel by themselves. That auto-advance IS the
      // feeling of moving down the tree, and it is safe here because one tap is
      // a whole answer. Anything typed has to be confirmed instead.
      setTimeout(() => advance(next), reduceMotion ? 0 : 200);
    },
    [answers, write, haptic, advance, reduceMotion]
  );

  const toggleMulti = useCallback(
    (node: TreeNode, value: string) => {
      haptic();
      const current = Array.isArray(answers[node.id]) ? (answers[node.id] as string[]) : [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      write({ [node.id]: next });
    },
    [answers, write, haptic]
  );

  const optionsFor = useCallback(
    (node: TreeNode): TreeOption[] =>
      node.id === 'soreArea' ? regionOptions : (node.options ?? []),
    [regionOptions]
  );

  /** What is wrong with the typed answer on this node, if anything. */
  const issueFor = useCallback(
    (node: TreeNode): string | null => {
      if (node.id === 'bodyweight') {
        const t = String(answers.bodyweight ?? '');
        return t.trim() === '' ? null : bodyweightIssue(t, weightUnit);
      }
      if (node.id === 'age') return ageIssue(String(answers.age ?? ''));
      if (node.subFields) {
        for (const f of node.subFields) {
          const issue = oneRepMaxIssue(String(answers[f.key] ?? ''));
          if (issue) return issue;
        }
      }
      return null;
    },
    [answers, weightUnit]
  );

  const canAdvance = focusNode
    ? issueFor(focusNode) === null && (focusNode.optional || isAnswered(focusNode, answers))
    : false;

  const onFinish = useCallback(() => {
    haptic(true);
    Keyboard.dismiss();
    onComplete(answers);
  }, [answers, onComplete, haptic]);

  // ─── rows ────────────────────────────────────────────────────────────────
  const rows: React.ReactNode[] = [];
  let lastTier: string | null = null;
  let lastForkLabel: string | null = null;

  nodes.forEach((node, i) => {
    if (node.tier !== lastTier) {
      lastTier = node.tier;
      const heading = TIER_HEADINGS[node.tier];
      if (heading) {
        rows.push(
          <View key={`tier-${node.tier}`} style={styles.tierRow} testID={`tier-${node.tier}`}>
            <View style={styles.tierRule} />
            <View style={styles.tierText}>
              <Text style={styles.tierLabel}>{heading.label.toUpperCase()}</Text>
              <Text style={styles.tierHint}>{heading.hint}</Text>
            </View>
            <View style={styles.tierRule} />
          </View>
        );
      }
    }

    // A branch opening. Drawn once per limb, not once per question on it.
    const forkLabel = node.branch?.label ?? null;
    const opensFork = !!forkLabel && forkLabel !== lastForkLabel;
    lastForkLabel = forkLabel;

    const answered = isAnswered(node, answers);
    const state: RowState =
      finishing ? 'done' : node.id === focusId ? 'focus' : i < focusIndex || answered ? 'done' : 'ahead';

    // Past the horizon nothing is drawn at all, and the count of what is left
    // goes in once, at the bottom.
    if (state === 'ahead' && i > focusIndex + HORIZON) {
      if (i === focusIndex + HORIZON + 1) {
        const left = nodes.length - i;
        rows.push(
          <View key="horizon" style={styles.horizon} testID="tree-horizon">
            <View style={styles.horizonRail}>
              <View style={styles.horizonDot} />
              <View style={styles.horizonDot} />
              <View style={styles.horizonDot} />
            </View>
            <Text style={styles.horizonText}>
              {left} more {left === 1 ? 'question' : 'questions'}
            </Text>
          </View>
        );
      }
      return;
    }

    rows.push(
      <TreeRow
        key={node.id}
        node={node}
        state={state}
        opensFork={opensFork}
        forkLabel={forkLabel}
        answers={answers}
        options={optionsFor(node)}
        issue={state === 'focus' ? issueFor(node) : null}
        weightUnit={weightUnit}
        reduceMotion={reduceMotion}
        C={C}
        styles={styles}
        onLayout={(y) => landAt(node.id, y)}
        onReopen={() => {
          haptic();
          // Reaching the end collapses every card, so without this a person who
           // taps back to change an answer gets a row that will not open. The end
           // cap tells them they can change things; it has to be true here too.
          setFinishing(false);
          travelTo(node.id);
        }}
        onPick={(v) => answerSingle(node, v)}
        onToggle={(v) => toggleMulti(node, v)}
        onType={(key, v) => write({ [key]: v })}
      />
    );
  });

  const done = progress.answered;
  const total = progress.total;

  return (
    <View style={styles.root}>
      {/* Progress. Counts THIS journey, so nobody is shown a total that
          includes questions their answers mean they will never see. */}
      <View style={styles.header}>
        <View style={styles.railTrack}>
          <View
            style={[
              styles.railFill,
              { width: `${Math.round((done / Math.max(1, total)) * 100)}%`, backgroundColor: go.fill },
            ]}
          />
        </View>
        <Text style={styles.headerCount} testID="tree-progress">
          {done} of {total}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.spineWrap}>
          {/* One line, drawn behind everything. Per-row segments left a gap at
              every tier heading and every fork, which read as a broken rail. */}
          <View style={styles.spine} pointerEvents="none" />
          {rows}
        </View>

        {finishing && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(320)}
            style={styles.endCap}
            testID="tree-end"
          >
            <View style={[styles.endDot, { backgroundColor: go.fill }]}>
              <Ionicons name="checkmark" size={17} color={go.on} />
            </View>
            <Text style={styles.endTitle}>That is everything</Text>
            <Text style={styles.endBody}>
              Your programme is built from these answers. You can change any of them later, and
              change the programme itself whenever you like.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {focusNode?.optional && !finishing && (
          <Pressable
            onPress={() => {
              haptic();
              Keyboard.dismiss();
              // Skipping CLEARS the boxes. A half-typed number left behind
              // would go on to become a prescribed working weight, and "I do
              // not know my best lifts" is a real answer rather than a
              // reluctance to answer.
              const cleared: Answers = {};
              for (const f of focusNode.subFields ?? []) cleared[f.key] = '';
              cleared[`${focusNode.id}__skipped`] = true;
              const next = { ...answers, ...cleared };
              write(cleared);
              advance(next);
            }}
            hitSlop={8}
            testID="tree-skip"
            style={styles.skip}
          >
            <Text style={styles.skipText}>{focusNode.skipLabel ?? 'Skip this one'}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            if (finishing) return onFinish();
            if (!canAdvance) return;
            haptic(true);
            Keyboard.dismiss();
            advance(answers);
          }}
          disabled={!finishing && !canAdvance}
          testID="tree-continue"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: go.fill },
            !finishing && !canAdvance && styles.ctaOff,
            pressed && { opacity: 0.88 },
          ]}
        >
          <Text style={[styles.ctaText, { color: go.on }]}>
            {finishing ? 'Build my programme' : 'Continue'}
          </Text>
          <Ionicons
            name={finishing ? 'sparkles' : 'arrow-down'}
            size={17}
            color={go.on}
          />
        </Pressable>
      </View>
    </View>
  );
}

// ─── one stop on the journey ────────────────────────────────────────────────

type RowState = 'done' | 'focus' | 'ahead';

interface TreeRowProps {
  node: TreeNode;
  state: RowState;
  opensFork: boolean;
  forkLabel: string | null;
  answers: Answers;
  options: TreeOption[];
  issue: string | null;
  weightUnit: WeightUnit;
  reduceMotion: boolean;
  C: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
  onLayout: (y: number) => void;
  onReopen: () => void;
  onPick: (value: string) => void;
  onToggle: (value: string) => void;
  onType: (key: string, value: string) => void;
}

function TreeRow({
  node,
  state,
  opensFork,
  forkLabel,
  answers,
  options,
  issue,
  weightUnit,
  reduceMotion,
  C,
  styles,
  onLayout,
  onReopen,
  onPick,
  onToggle,
  onType,
}: TreeRowProps) {
  const go = useGoColors();
  const fill = useSharedValue(state === 'done' ? 1 : 0);
  const grow = useSharedValue(state === 'focus' ? 1 : 0);

  useEffect(() => {
    const to = state === 'done' ? 1 : 0;
    fill.value = reduceMotion ? to : withSpring(to, { damping: 14, stiffness: 160 });
    const g = state === 'focus' ? 1 : 0;
    grow.value = reduceMotion ? g : withTiming(g, { duration: 240 });
  }, [state, reduceMotion, fill, grow]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.72 + fill.value * 0.28 + grow.value * 0.35 }],
    opacity: 0.45 + fill.value * 0.55 + grow.value * 0.55,
  }));

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.y),
    [onLayout]
  );

  const summary = answerSummary(node, answers, options, weightUnit);

  return (
    <View onLayout={handleLayout}>
      {opensFork && forkLabel && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(300)}
          style={styles.forkRow}
          testID={`fork-${node.id}`}
        >
          <View style={styles.forkRail}>
            <View style={[styles.forkLimb, { backgroundColor: C.primary }]} />
          </View>
          <Text style={styles.forkLabel}>{forkLabel}</Text>
        </Animated.View>
      )}

      <View style={styles.row}>
        {/* The rail: the line, and this stop on it. */}
        <View style={styles.rail}>
          <Animated.View
            style={[
              styles.dot,
              dotStyle,
              state === 'done' && { backgroundColor: go.fill, borderColor: go.fill },
              state === 'focus' && { borderColor: go.fill, borderWidth: 3 },
            ]}
          >
            {state === 'done' && <Ionicons name="checkmark" size={11} color={go.on} />}
          </Animated.View>
        </View>

        <View style={styles.body}>
          {state === 'done' && (
            <Pressable onPress={onReopen} testID={`tree-done-${node.id}`} style={styles.doneRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.doneQuestion} numberOfLines={1}>
                  {node.question}
                </Text>
                {!!summary && (
                  <Text style={styles.doneAnswer} numberOfLines={1}>
                    {summary}
                  </Text>
                )}
              </View>
              <Ionicons name="pencil" size={13} color={C.textTertiary} />
            </Pressable>
          )}

          {state === 'ahead' && (
            <View style={styles.aheadRow}>
              <Text style={styles.aheadQuestion} numberOfLines={1}>
                {node.question}
              </Text>
            </View>
          )}

          {state === 'focus' && (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.duration(280)}
              style={styles.card}
              testID={`tree-node-${node.id}`}
            >
              <Text style={styles.question}>{node.question}</Text>
              {(() => {
                // hintFor beats hint wherever a node has one. See TreeNode.
                const line = node.hintFor ? node.hintFor(answers) : node.hint;
                return line ? <Text style={styles.hint}>{line}</Text> : null;
              })()}

              {node.kind === 'single' && (
                /**
                 * A GRID, where the node asks for it.
                 *
                 * Nine block lengths as nine full-width rows was a card taller
                 * than the phone, on a question whose whole point is that the
                 * numbers are comparable: you choose between them by looking at
                 * them together. Found by photographing it. The layout is
                 * declared on the node rather than guessed from how many
                 * options there are, because "9 is a lot" is true of numbers and
                 * false of the six things a programme can be built around.
                 */
                <View style={node.layout === 'grid' ? styles.numberGrid : styles.options}>
                  {options.map((o) => {
                    const on = answers[node.id] === o.value;
                    if (node.layout === 'grid') {
                      return (
                        <Pressable
                          key={o.value}
                          onPress={() => onPick(o.value)}
                          testID={`opt-${node.id}-${o.value}`}
                          style={({ pressed }) => [
                            styles.numberCell,
                            on && { borderColor: go.fill, backgroundColor: C.primarySurface },
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <Text style={[styles.numberCellLabel, on && { color: C.primaryText }]}>
                            {o.label}
                          </Text>
                          {!!o.hint && (
                            <Text style={styles.numberCellHint} numberOfLines={1}>
                              {o.hint}
                            </Text>
                          )}
                        </Pressable>
                      );
                    }
                    return (
                      <Pressable
                        key={o.value}
                        onPress={() => onPick(o.value)}
                        testID={`opt-${node.id}-${o.value}`}
                        style={({ pressed }) => [
                          styles.option,
                          on && { borderColor: go.fill, backgroundColor: C.primarySurface },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionLabel, on && { color: C.primaryText }]}>
                            {o.label}
                          </Text>
                          {!!o.hint && <Text style={styles.optionHint}>{o.hint}</Text>}
                        </View>
                        {on && <Ionicons name="checkmark-circle" size={19} color={go.fill} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {node.kind === 'multi' && (
                <View
                  style={
                    node.id === 'equipment'
                      ? styles.grid
                      : options.length > 8
                        ? styles.chips
                        : styles.options
                  }
                >
                  {options.map((o) => {
                    const picked = Array.isArray(answers[node.id])
                      ? (answers[node.id] as string[]).includes(o.value)
                      : false;
                    const art = node.id === 'equipment' ? EQUIPMENT_IMAGES[o.value] : null;
                    // Nineteen body areas as nineteen full-width rows is four
                    // screens of scrolling to answer one question.
                    const dense = !art && options.length > 8;
                    return (
                      <Pressable
                        key={o.value}
                        onPress={() => onToggle(o.value)}
                        testID={`opt-${node.id}-${o.value}`}
                        style={({ pressed }) => [
                          art ? styles.tile : dense ? styles.chip : styles.option,
                          picked && { borderColor: go.fill, backgroundColor: C.primarySurface },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        {art ? <Image source={art} style={styles.tileArt} resizeMode="contain" /> : null}
                        <Text
                          style={[
                            art ? styles.tileLabel : dense ? styles.chipLabel : styles.optionLabel,
                            picked && { color: C.primaryText },
                          ]}
                          numberOfLines={2}
                        >
                          {o.label}
                        </Text>
                        {picked && !art && !dense && (
                          <Ionicons name="checkmark-circle" size={19} color={go.fill} />
                        )}
                        {picked && dense && (
                          <Ionicons name="checkmark" size={14} color={go.fill} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {(node.kind === 'text' || node.kind === 'number') && !node.subFields && (
                <TextInput
                  value={String(answers[node.id] ?? '')}
                  onChangeText={(t) => onType(node.id, t)}
                  placeholder={placeholderFor(node, weightUnit)}
                  placeholderTextColor={C.textTertiary}
                  keyboardType={node.kind === 'number' ? 'numeric' : 'default'}
                  autoCapitalize={node.kind === 'text' ? 'words' : 'none'}
                  style={styles.input}
                  testID={`input-${node.id}`}
                />
              )}

              {node.subFields && (
                <View style={styles.subFields}>
                  {node.subFields.map((f) => (
                    <View key={f.key} style={styles.subField}>
                      <Text style={styles.subLabel}>{f.label}</Text>
                      <TextInput
                        value={String(answers[f.key] ?? '')}
                        onChangeText={(t) => onType(f.key, t)}
                        placeholder="kg"
                        placeholderTextColor={C.textTertiary}
                        keyboardType="numeric"
                        style={[styles.input, styles.subInput]}
                        testID={`input-${f.key}`}
                      />
                    </View>
                  ))}
                </View>
              )}

              {node.id === 'bodyweight' && (
                <Text style={styles.unitTag}>{weightUnit}</Text>
              )}

              {!!issue && (
                <View style={styles.issueRow} testID={`issue-${node.id}`}>
                  <Ionicons name="alert-circle" size={13} color={C.error} />
                  <Text style={styles.issueText}>{issue}</Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── words ──────────────────────────────────────────────────────────────────

/** The answer, short enough to sit on one collapsed line. */
function answerSummary(
  node: TreeNode,
  answers: Answers,
  options: TreeOption[],
  unit: WeightUnit
): string {
  if (node.subFields) {
    const given = node.subFields
      .map((f) => (String(answers[f.key] ?? '').trim() ? `${f.label} ${answers[f.key]}` : null))
      .filter(Boolean);
    return given.length ? given.join(', ') : 'Skipped';
  }
  const v = answers[node.id];
  if (v == null || v === '') return '';
  if (Array.isArray(v)) {
    const labels = v.map((x) => options.find((o) => o.value === x)?.label ?? x);
    return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} and ${labels.length - 2} more` : labels.join(', ');
  }
  if (node.id === 'bodyweight') return `${v} ${unit}`;
  if (node.id === 'age') return `${v}`;
  // The grid's labels are bare numbers, which is right inside a nine-cell grid
  // and wrong on a line of its own halfway up the spine. "12" is not an answer;
  // "12 sessions" is.
  if (node.id === 'length') return `${v} sessions`;
  return options.find((o) => o.value === String(v))?.label ?? String(v);
}

function placeholderFor(node: TreeNode, unit: WeightUnit): string {
  if (node.id === 'name') return 'Your name';
  if (node.id === 'age') return 'Years';
  // NOT a number. A guessed weight sitting in the box before anybody has typed
  // is the same problem as printing the assumption out loud.
  if (node.id === 'bodyweight') return 'Optional';
  return '';
}

// ─── styles ─────────────────────────────────────────────────────────────────

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 22,
      paddingBottom: 12,
    },
    railTrack: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: C.surfaceSecondary,
      overflow: 'hidden',
    },
    railFill: { height: 3, borderRadius: 2 },
    headerCount: {
      fontSize: 11.5,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      letterSpacing: 0.4,
    },

    scroll: { flex: 1 },
    // The tail of padding is what lets the LAST question travel up to the focus
    // position. Without it the view cannot scroll far enough and the final card
    // stays pinned to the bottom of the screen.
    content: { paddingHorizontal: 18, paddingBottom: 300 },

    spineWrap: { position: 'relative' },
    spine: {
      position: 'absolute',
      left: 16,
      top: 8,
      bottom: 8,
      width: 2,
      backgroundColor: C.border,
    },

    horizon: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
    horizonRail: { width: 34, alignItems: 'center', gap: 4 },
    horizonDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.textTertiary,
      opacity: 0.5,
    },
    horizonText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      opacity: 0.75,
    },

    // The two tiers, which is the only structural line on the whole diagram.
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 },
    tierRule: { flex: 1, height: 1, backgroundColor: C.border },
    tierText: { alignItems: 'center' },
    tierLabel: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1.1,
      color: C.textSecondary,
    },
    tierHint: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 1 },

    // A limb leaving the spine, with the reason written on it.
    forkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
    forkRail: { width: 34, alignItems: 'center' },
    forkLimb: { width: 22, height: 2, borderRadius: 1, transform: [{ rotate: '32deg' }] },
    forkLabel: {
      flex: 1,
      fontSize: 11.5,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryText,
      letterSpacing: 0.2,
    },

    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { width: 34, alignItems: 'center' },
    dot: {
      marginTop: 12,
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: C.border,
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
    },

    body: { flex: 1, paddingBottom: 6 },

    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingLeft: 6,
    },
    doneQuestion: { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    doneAnswer: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, marginTop: 1 },

    aheadRow: { paddingVertical: 11, paddingLeft: 6, opacity: 0.4 },
    aheadQuestion: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      marginLeft: 2,
      marginVertical: 6,
    },
    question: { fontSize: 21, lineHeight: 27, fontFamily: 'Inter_700Bold', color: C.text },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 5,
    },

    options: { gap: 8, marginTop: 14 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      minHeight: 48,
    },
    optionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    optionHint: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      minHeight: 40,
    },
    chipLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },

    // Three across, so nine numbers are one glance rather than one scroll.
    numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    numberCell: {
      flexBasis: '30%',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      minHeight: 62,
    },
    numberCellLabel: { fontSize: 19, fontFamily: 'Inter_700Bold', color: C.text },
    numberCellHint: {
      fontSize: 10.5,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      marginTop: 2,
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    tile: {
      width: '47.5%',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    tileArt: { width: '100%', height: 58, marginBottom: 6 },
    tileLabel: {
      fontSize: 12.5,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      textAlign: 'center',
    },

    input: {
      marginTop: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: 14,
      height: 52,
      fontSize: 17,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    subFields: { gap: 8 },
    subField: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
    subLabel: { width: 96, fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    subInput: { flex: 1, marginTop: 0, height: 46 },

    unitTag: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      marginTop: 6,
      letterSpacing: 0.3,
    },
    issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
    issueText: {
      flex: 1,
      fontSize: 12.5,
      lineHeight: 17,
      fontFamily: 'Inter_500Medium',
      color: C.error,
    },

    endCap: { alignItems: 'center', paddingTop: 26, paddingHorizontal: 20 },
    endDot: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    endTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', color: C.text },
    endBody: {
      fontSize: 13.5,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },

    footer: {
      paddingHorizontal: 22,
      paddingTop: 10,
      gap: 10,
      alignItems: 'center',
    },
    skip: { paddingVertical: 4 },
    skipText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    cta: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: 16,
    },
    ctaOff: { opacity: 0.4 },
    ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  });
}
