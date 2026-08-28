/**
 * Badge artwork that changes as you climb.
 *
 * WHY THIS EXISTS
 * ───────────────
 * lib/badge-art.ts draws one picture per CATEGORY, so every badge in a row was
 * the identical drawing and only the tier metal differed. Measured on the real
 * catalogue: 277 badges, 33 distinct drawings, 8.4 badges per picture. Scroll
 * the achievements screen and Milestones is five identical staircases, Streaks
 * is five identical flames, Consistency is five identical calendars. A
 * collection is not worth collecting if the pieces are the same.
 *
 * So each family becomes a LADDER: one metaphor, drawn at four to six stages,
 * where a single visual quantity grows with the badge's own number. Milestone
 * is a staircase that gains steps; streak is a fire that burns higher; goals is
 * a lap closing round a bullseye.
 *
 * WHY THE STAGES ARE BUILT AND NOT TYPED OUT
 * ──────────────────────────────────────────
 * 120 stages of hand-typed coordinates is 120 chances to be half a unit out,
 * and the whole point of a ladder is that the rungs are even. Each family is a
 * function of its stage number instead, the same way effortMeter() and seal()
 * are already built rather than drawn in lib/icon-art.ts. Change the footprint
 * once and every rung moves together.
 *
 * The coordinate space is lib/badge-art.ts's: a 48x48 box, content inside
 * roughly 4..44 on both axes, `glyph` ink for the tier's colour and `face` to
 * cut a shape back out of a filled one.
 */
import type { ArtShape } from '@/lib/badge-art';

// ─── Shared constructions ────────────────────────────────────────────────────

/** Degrees to a point on a circle, 0 at twelve o'clock, clockwise. */
function onCircle(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
}

/** An arc of `sweep` degrees clockwise from twelve o'clock. */
function arcFromTop(cx: number, cy: number, r: number, sweep: number): string {
  const [x0, y0] = onCircle(cx, cy, r, 0);
  const [x1, y1] = onCircle(cx, cy, r, sweep);
  return `M${x0} ${y0} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * Scale an absolute path about a point.
 *
 * Used where a family is genuinely one drawing at several sizes. Rebuilding the
 * flame at each height kept producing a teardrop: what makes it read as FIRE is
 * the inner tongue on its left, three control points of nuance that got lost
 * every time. So the shape is authored once and scaled.
 *
 * M, L and C carry x,y pairs; A carries rx ry rot large sweep x y, so the radii
 * scale and the three flags do not.
 */
function scaleAbout(d: string, k: number, cx: number, cy: number): string {
  const tokens = d.match(/[A-Za-z]|-?[0-9.]+/g) ?? [];
  const out: string[] = [];
  let cmd = '';
  let i = 0;
  const sx = (v: number) => +(cx + (v - cx) * k).toFixed(2);
  const sy = (v: number) => +(cy + (v - cy) * k).toFixed(2);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      out.push(t);
      i++;
      continue;
    }
    if (cmd === 'A') {
      const n = tokens.slice(i, i + 7).map(Number);
      out.push(
        String(+(n[0] * k).toFixed(2)), String(+(n[1] * k).toFixed(2)),
        String(n[2]), String(n[3]), String(n[4]),
        String(sx(n[5])), String(sy(n[6]))
      );
      i += 7;
      continue;
    }
    out.push(String(sx(Number(tokens[i]))), String(sy(Number(tokens[i + 1]))));
    i += 2;
  }
  return out.join(' ');
}

/** A row of `total` tiles, the first `lit` solid and the rest outlined. */
function tileRow(y: number, total: number, lit: number, w = 4.6, gap = 1.5): ArtShape[] {
  const span = total * w + (total - 1) * gap;
  const x0 = 24 - span / 2;
  return Array.from({ length: total }, (_, i) => ({
    k: 'rect' as const,
    x: +(x0 + i * (w + gap)).toFixed(2),
    y,
    w,
    h: w,
    rx: 1.4,
    ...(i < lit ? { fill: 'glyph' as const } : { stroke: 'glyph' as const, sw: 1.5, o: 0.4 }),
  }));
}

// ─── The families ────────────────────────────────────────────────────────────

/** goals: a lap closing round a bullseye. Six stages, 60 degrees each. */
function goalsRing(sweep: number | 'closed'): ArtShape[] {
  const target: ArtShape[] = [{ k: 'circle', cx: 24, cy: 24, r: 6, fill: 'glyph' }];
  if (sweep === 'closed') {
    return [...target, { k: 'circle', cx: 24, cy: 24, r: 16, stroke: 'glyph', sw: 6 }];
  }
  return [
    ...target,
    { k: 'circle', cx: 24, cy: 24, r: 16, stroke: 'glyph', sw: 2.4, o: 0.2 },
    { k: 'path', d: arcFromTop(24, 24, 16, sweep), stroke: 'glyph', sw: 6 },
  ];
}

/**
 * milestone: one staircase, gaining a step per stage.
 *
 * Drawn as a single closed silhouette rather than a row of bars. That is the
 * whole difference between a staircase and a bar chart, and without it this
 * family and strength_progress read as the same picture.
 */
function stairs(steps: number): ArtShape[] {
  // Footprint fixed, tread size derived. A fixed tread cannot span two steps
  // to eight: at 6.4 units two is a stub and eight is wider than the medal.
  // The ladder never draws fewer than two treads, because one tread is not a
  // staircase at any size - that is what made the first rung read as a dot.
  const base = 42, x0 = 8, x1 = 40, top = 10;
  const w = (x1 - x0) / steps;
  const rise = (base - top) / steps;
  const d: string[] = [`M${x0} ${base}`, `L${x0} ${base - rise}`];
  for (let i = 0; i < steps; i++) {
    const x = +(x0 + (i + 1) * w).toFixed(2);
    d.push(`L${x} ${base - rise * (i + 1)}`);
    if (i < steps - 1) d.push(`L${x} ${base - rise * (i + 2)}`);
  }
  d.push(`L${x1.toFixed(2)} ${base}`, 'Z');
  return [{ k: 'path', d: d.join(' '), fill: 'glyph' }];
}

/** streak: one fire on a fixed foot, burning higher. */
const FLAME_D =
  'M24 4 C30 12 37 16 37 26 A13 13 0 0 1 11 26 C11 20 15 17 17 13 C18 17 20 19 22 20 C23 14 23 9 24 4 Z';
function fire(step: number): ArtShape[] {
  const k = 0.52 + 0.12 * step;
  const out: ArtShape[] = [{ k: 'path', d: scaleAbout(FLAME_D, k, 24, 39), fill: 'glyph' }];
  // A wreath only at the top of the ladder, where it also echoes the grow
  // tier's own laurel. Earlier stages carry nothing but the fire.
  if (step === 4) {
    out.unshift({ k: 'path', d: 'M6.5 36 A18.5 18.5 0 0 1 41.5 36', stroke: 'glyph', sw: 3.2, o: 0.55 });
    out.push({ k: 'circle', cx: 6.5, cy: 37, r: 3, fill: 'glyph', o: 0.7 });
    out.push({ k: 'circle', cx: 41.5, cy: 37, r: 3, fill: 'glyph', o: 0.7 });
  }
  return out;
}

/**
 * strength_progress: a loading pin filling with plates.
 *
 * The post stands clear ABOVE the top plate at every stage. The collision audit
 * flagged that a buried post leaves nothing but a tapering stack, which is the
 * exercise_milestone drawing.
 */
function loadingPin(plates: number): ArtShape[] {
  // A loaded barbell, seen end-on down the bar: the sleeve runs across the
  // middle and plates stack outward from the collar on each side. The pin and
  // its pagoda of plates read as a lollipop on a christmas tree at 44 points;
  // a barbell is the object this whole app is about and it survives shrinking.
  const out: ArtShape[] = [
    { k: 'path', d: 'M6 24 L42 24', stroke: 'glyph', sw: 3.2 },
    { k: 'rect', x: 21.5, y: 16, w: 5, h: 16, rx: 2, fill: 'glyph', o: 0.4 },
  ];
  for (let i = 0; i < plates; i++) {
    // Nearest the collar is the biggest plate, as it is loaded in life.
    const h = 26 - i * 3.6;
    const w = 4.4;
    const gap = 0.9;
    const dx = 5.5 + i * (w + gap);
    for (const side of [-1, 1]) {
      out.push({
        k: 'rect',
        x: +(24 + side * dx - (side < 0 ? w : 0)).toFixed(2),
        y: +(24 - h / 2).toFixed(2),
        w,
        h: +h.toFixed(2),
        rx: 1.8,
        fill: 'glyph',
      });
    }
  }
  return out;
}

/**
 * consistency: a week of seven day tiles, then whole weeks stacked.
 *
 * The month stage keeps a visible gutter and a partly filled top row. A solid
 * block of 21 tiles resolves at medallion size to a plain filled rectangle,
 * which is the session_custom wall.
 */
function weekTiles(lit: number): ArtShape[] {
  return tileRow(21, 7, lit, 4.6, 1.5);
}
function monthTiles(): ArtShape[] {
  return [
    ...tileRow(11, 7, 7, 4.6, 1.5),
    ...tileRow(20, 7, 7, 4.6, 1.5),
    ...tileRow(29, 7, 4, 4.6, 1.5),
  ];
}

/**
 * variety: a seven-part wheel, one wedge per session type.
 *
 * Ten-degree separators, not four, and a solid hub. At four degrees the gaps
 * are under a point wide on a 44pt disc, the wedges merge into one band, and
 * the wheel becomes the goals progress ring.
 */
function wheel(filled: number): ArtShape[] {
  const R = 17, r = 9, GAP = 10, step = 360 / 7;
  const out: ArtShape[] = [{ k: 'circle', cx: 24, cy: 24, r: 4, fill: 'glyph' }];
  for (let i = 0; i < 7; i++) {
    const a0 = i * step + GAP / 2;
    const a1 = (i + 1) * step - GAP / 2;
    const [ox0, oy0] = onCircle(24, 24, R, a0);
    const [ox1, oy1] = onCircle(24, 24, R, a1);
    const [ix1, iy1] = onCircle(24, 24, r, a1);
    const [ix0, iy0] = onCircle(24, 24, r, a0);
    const d = `M${ox0} ${oy0} A${R} ${R} 0 0 1 ${ox1} ${oy1} L${ix1} ${iy1} A${r} ${r} 0 0 0 ${ix0} ${iy0} Z`;
    out.push(i < filled ? { k: 'path', d, fill: 'glyph' } : { k: 'path', d, fill: 'glyph', o: 0.22 });
  }
  return out;
}

/** session_full: a standing figure struck solid outward from the core. */
function figure(struck: number): ArtShape[] {
  const on = (i: number) => (i < struck ? 1 : 0.2);
  return [
    { k: 'rect', x: 20, y: 17, w: 8, h: 14, rx: 3, fill: 'glyph', o: on(0) },
    { k: 'circle', cx: 24, cy: 10, r: 5, fill: 'glyph', o: on(1) },
    { k: 'path', d: 'M20 19 L12.5 25', stroke: 'glyph', sw: 4.4, o: on(2) },
    { k: 'path', d: 'M28 19 L35.5 25', stroke: 'glyph', sw: 4.4, o: on(2) },
    { k: 'path', d: 'M12.5 25 L9 33', stroke: 'glyph', sw: 4.4, o: on(3) },
    { k: 'path', d: 'M35.5 25 L39 33', stroke: 'glyph', sw: 4.4, o: on(3) },
    { k: 'path', d: 'M21.5 31 L18.5 38', stroke: 'glyph', sw: 4.6, o: on(4) },
    { k: 'path', d: 'M26.5 31 L29.5 38', stroke: 'glyph', sw: 4.6, o: on(4) },
    { k: 'path', d: 'M18.5 38 L17.5 44', stroke: 'glyph', sw: 4.6, o: on(5) },
    { k: 'path', d: 'M29.5 38 L30.5 44', stroke: 'glyph', sw: 4.6, o: on(5) },
  ];
}

/** session_conditioning: a monitor trace, gaining a beat per stage. */
function trace(beats: number): ArtShape[] {
  // Beat WIDTH is fixed and the flat line between them shrinks. Dividing the
  // span by the beat count instead made every extra beat thinner, so six of
  // them came out as a comb rather than as a busier heart.
  const x0 = 5, x1 = 43, mid = 24, beatW = 6.2;
  const total = beats * beatW;
  const lead = (x1 - x0 - total) / 2;
  const d: string[] = [`M${x0} ${mid}`, `L${+(x0 + lead).toFixed(2)} ${mid}`];
  for (let i = 0; i < beats; i++) {
    const s = x0 + lead + i * beatW;
    d.push(
      `L${+(s + beatW * 0.26).toFixed(2)} ${mid - 13}`,
      `L${+(s + beatW * 0.58).toFixed(2)} ${mid + 10}`,
      `L${+(s + beatW * 0.82).toFixed(2)} ${mid}`,
      `L${+(s + beatW).toFixed(2)} ${mid}`
    );
  }
  d.push(`L${x1} ${mid}`);
  return [{ k: 'path', d: d.join(' '), stroke: 'glyph', sw: 3.4 }];
}

/**
 * session_prehab: a shield plated up from its point.
 *
 * The plates take the shield's own outline, curved sides and all. As plain
 * rectangles nothing in the silhouette says shield, and a banded wedge is a
 * banded wedge next to the exercise_milestone stack.
 */
const SHIELD_D = 'M24 5 L40 10 C40 26, 34 37, 24 43 C14 37, 8 26, 8 10 Z';
function shield(plates: number): ArtShape[] {
  const out: ArtShape[] = [{ k: 'path', d: SHIELD_D, stroke: 'glyph', sw: 2.6, o: 0.35 }];
  // Bands are cut across the shield by clipping with nothing more than a rect
  // of the same ink; a scaled copy of the outline gives the curve for free.
  for (let i = 0; i < plates; i++) {
    const k = 0.34 + 0.132 * i;
    out.push({ k: 'path', d: scaleAbout(SHIELD_D, k, 24, 43), fill: 'glyph', o: 1 - i * 0.02 });
  }
  return out;
}

/** session_flex: a band pinned at two anchors, drawn further each stage. */
function band(step: number): ArtShape[] {
  const rise = 6 + step * 5.2;
  const spread = 5 + step * 1.4;
  return [
    { k: 'rect', x: 5, y: 34, w: 6, h: 8, rx: 2, fill: 'glyph' },
    { k: 'rect', x: 37, y: 34, w: 6, h: 8, rx: 2, fill: 'glyph' },
    {
      k: 'path',
      d: `M8 34 C${8 + spread} ${38 - rise}, ${40 - spread} ${38 - rise}, 40 34`,
      stroke: 'glyph',
      sw: 3.4,
    },
  ];
}

/** session_lower: a trail of footprints climbing the medal. */
function prints(n: number): ArtShape[] {
  // Bigger than they were. At 5 by 8 these came out as specks on the metal;
  // a footprint has to be big enough to have a shape, so there are fewer of
  // them and they are nearly twice the area.
  const path: [number, number][] = [
    [15, 38], [30, 33], [16, 26], [31, 21], [17, 14], [32, 9],
  ];
  return path.slice(0, n).map(([x, y], i) => ({
    k: 'rect' as const,
    x: x - 3.6,
    y: y - 5.5,
    w: 7.2,
    h: 11,
    rx: 3.6,
    fill: 'glyph' as const,
    rot: i % 2 === 0 ? -16 : 16,
  }));
}

/**
 * session_upper: a chevron opening as the shoulders broaden.
 *
 * NOT a torso. The collision audit found a head-on figure here is the same
 * silhouette as session_full's at both ends of the ladder, and legs at the very
 * bottom of the disc are not a difference anyone can use.
 */
function chevron(step: number): ArtShape[] {
  const halfSpan = 7 + step * 2.6;
  const rise = 12 + step * 2.4;
  return [
    {
      k: 'path',
      d: `M${24 - halfSpan} ${36 - rise} L24 36 L${24 + halfSpan} ${36 - rise}`,
      stroke: 'glyph',
      sw: 4.6,
    },
    {
      k: 'path',
      d: `M${24 - halfSpan * 0.62} ${44 - rise} L24 44 L${24 + halfSpan * 0.62} ${44 - rise}`,
      stroke: 'glyph',
      sw: 3.6,
      o: 0.42,
    },
  ];
}

/**
 * session_custom: a six-brick wall built out from your own plan.
 *
 * Wide gaps and a firm outline on the unbuilt slots. At narrow gaps the built
 * bricks fuse into one stepped mass, which is the milestone stair mirrored.
 */
function wall(built: number): ArtShape[] {
  const slots: [number, number][] = [
    [10, 32], [24, 32], [38, 32], [10, 21], [24, 21], [17, 10],
  ];
  return slots.map(([cx, cy], i) => ({
    k: 'rect' as const,
    x: cx - 6.5,
    y: cy - 4.5,
    w: 13,
    h: 9,
    rx: 1.8,
    ...(i < built
      ? { fill: 'glyph' as const }
      : { stroke: 'glyph' as const, sw: 2.6, o: 0.45 }),
  }));
}

/** exercise_milestone: a plate stack. Only ever the fallback; eleven of the
 *  twelve badges here carry their own drawing in BADGE_ID_GLYPHS. */
function plateStack(n: number): ArtShape[] {
  return Array.from({ length: n }, (_, i) => {
    const w = 30 - i * 4;
    return {
      k: 'rect' as const,
      x: +(24 - w / 2).toFixed(2),
      y: +(40 - 6 * (i + 1)).toFixed(2),
      w: +w.toFixed(2),
      h: 5,
      rx: 1.8,
      fill: 'glyph' as const,
    };
  });
}

/**
 * time_of_day: the sun over a horizon.
 *
 * The faint track arc is deliberately absent. At 0.4 opacity on brushed metal
 * it was close to invisible, and it was the whole reason this family collided
 * with the session_flex band.
 */
function sky(kind: 'before-dawn' | 'sunrise' | 'noon' | 'evening' | 'night' | 'weekend'): ArtShape[] {
  const horizon: ArtShape = { k: 'path', d: 'M6 34 L42 34', stroke: 'glyph', sw: 3.4 };
  const rays = (cx: number, cy: number, r: number): ArtShape[] =>
    [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const [x0, y0] = onCircle(cx, cy, r + 3, deg);
      const [x1, y1] = onCircle(cx, cy, r + 6.5, deg);
      return { k: 'path', d: `M${x0} ${y0} L${x1} ${y1}`, stroke: 'glyph', sw: 2.4, o: 0.6 };
    });
  switch (kind) {
    case 'before-dawn':
      return [horizon, { k: 'circle', cx: 12, cy: 34, r: 6, fill: 'glyph', o: 0.5 }];
    case 'sunrise':
      return [horizon, { k: 'circle', cx: 14, cy: 26, r: 6, fill: 'glyph' }, ...rays(14, 26, 6)];
    case 'noon':
      return [horizon, { k: 'circle', cx: 24, cy: 17, r: 7, fill: 'glyph' }, ...rays(24, 17, 7)];
    case 'evening':
      // Sunk, not mirrored: a disc half below the line reads as setting even
      // when there is nothing beside it to compare against.
      return [
        horizon,
        { k: 'circle', cx: 34, cy: 32, r: 6.5, fill: 'glyph' },
        { k: 'path', d: 'M20 40 L42 40', stroke: 'glyph', sw: 2.4, o: 0.4 },
      ];
    case 'night':
      return [
        horizon,
        { k: 'path', d: 'M30 8 A11 11 0 1 0 30 30 A9 9 0 1 1 30 8 Z', fill: 'glyph' },
        { k: 'circle', cx: 13, cy: 12, r: 2, fill: 'glyph', o: 0.6 },
      ];
    case 'weekend':
      return [
        horizon,
        { k: 'circle', cx: 15, cy: 24, r: 5.5, fill: 'glyph' },
        { k: 'circle', cx: 33, cy: 24, r: 5.5, fill: 'glyph' },
        { k: 'path', d: 'M20.5 24 L27.5 24', stroke: 'glyph', sw: 2.6, o: 0.5 },
      ];
  }
}

/**
 * recovery: a sprig gaining leaves.
 *
 * Every stage has leaves coming off SIDEWAYS. A lone vertical point at the
 * bottom of the ladder is the streak ember.
 */
function sprig(pairs: number, crown = false): ArtShape[] {
  const leaf = (y: number, dir: 1 | -1, len: number): ArtShape => ({
    k: 'path',
    d: `M24 ${y} C${24 + dir * len * 0.4} ${y - 6}, ${24 + dir * len} ${y - 7}, ${24 + dir * len} ${y - 2} C${24 + dir * len} ${y + 3}, ${24 + dir * len * 0.4} ${y + 3}, 24 ${y} Z`,
    fill: 'glyph',
  });
  const out: ArtShape[] = [{ k: 'path', d: 'M24 43 L24 14', stroke: 'glyph', sw: 3 }];
  const ys = [37, 30, 23];
  for (let i = 0; i < pairs; i++) {
    const len = 11 - i * 1.2;
    out.push(leaf(ys[i], -1, len), leaf(ys[i], 1, len));
  }
  if (crown) out.push({ k: 'path', d: 'M24 16 C20 10, 21 6, 24 4 C27 6, 28 10, 24 16 Z', fill: 'glyph' });
  return out;
}

/**
 * duration: an hourglass, not a dial.
 *
 * A timer dial is a circle filled clockwise from twelve, which is exactly what
 * the goals lap and the variety wheel are. An hourglass is vertical and waisted
 * and cannot be mistaken for any of them.
 */
function hourglass(step: number): ArtShape[] {
  const run = step / 4;
  const topFill = 1 - run;
  const out: ArtShape[] = [
    { k: 'rect', x: 10, y: 5, w: 28, h: 3.6, rx: 1.6, fill: 'glyph' },
    { k: 'rect', x: 10, y: 39.4, w: 28, h: 3.6, rx: 1.6, fill: 'glyph' },
    { k: 'path', d: 'M13 8.6 L35 8.6 L26 24 L35 39.4 L13 39.4 L22 24 Z', stroke: 'glyph', sw: 2.6, o: 0.45 },
  ];
  if (topFill > 0.02) {
    const h = 13 * topFill;
    out.push({
      k: 'path',
      d: `M${13 + (13 - 13 * topFill) * 0.7} ${24 - h} L${35 - (13 - 13 * topFill) * 0.7} ${24 - h} L26 24 L22 24 Z`,
      fill: 'glyph',
    });
  }
  if (run > 0.02) {
    const w = 20 * run;
    out.push({
      k: 'path',
      d: `M${24 - w / 2} 39.4 L${24 + w / 2} 39.4 L${24 + w / 5} ${39.4 - 9 * run} L${24 - w / 5} ${39.4 - 9 * run} Z`,
      fill: 'glyph',
    });
  }
  return out;
}

/** equipment: a wall rack filling with kit. */
function rack(items: number): ArtShape[] {
  const out: ArtShape[] = [{ k: 'rect', x: 6, y: 11, w: 36, h: 3.6, rx: 1.6, fill: 'glyph' }];
  const xs = [10, 19, 28, 37];
  for (let i = 0; i < 4; i++) {
    const x = xs[i];
    if (i < items) {
      out.push({ k: 'rect', x: x - 1.4, y: 14.6, w: 2.8, h: 5, rx: 1.2, fill: 'glyph' });
      out.push({ k: 'rect', x: x - 3.5, y: 19.6, w: 7, h: 14, rx: 2.5, fill: 'glyph' });
    } else {
      out.push({ k: 'circle', cx: x, cy: 17.5, r: 1.8, fill: 'glyph', o: 0.3 });
    }
  }
  return out;
}

/** test_week: a measuring column read higher each test. */
function gauge(tick: number): ArtShape[] {
  const top = 7, bottom = 41;
  const out: ArtShape[] = [
    { k: 'rect', x: 19, y: top, w: 10, h: bottom - top, rx: 4, stroke: 'glyph', sw: 2.4, o: 0.45 },
  ];
  const y = bottom - ((bottom - top) / 5) * tick;
  out.push({ k: 'rect', x: 21, y: +y.toFixed(2), w: 6, h: +(bottom - 2 - y).toFixed(2), rx: 3, fill: 'glyph' });
  for (let i = 1; i <= 5; i++) {
    const ty = bottom - ((bottom - top) / 5) * i;
    out.push({ k: 'path', d: `M31 ${ty.toFixed(2)} L${i === tick ? 38 : 34.5} ${ty.toFixed(2)}`, stroke: 'glyph', sw: 2.2, o: i === tick ? 1 : 0.3 });
  }
  return out;
}

/** comeback: an arc carrying you back onto a broken line. */
function comeback(step: number): ArtShape[] {
  const hops = step >= 3 ? (step === 3 ? 3 : 5) : 1;
  const gap = step === 0 ? 9 : step === 1 ? 15 : 24;
  const y = 38;
  const out: ArtShape[] = [];
  if (hops === 1) {
    const a = 24 - gap / 2, b = 24 + gap / 2;
    out.push({ k: 'path', d: `M6 ${y} L${a} ${y}`, stroke: 'glyph', sw: 3.4 });
    out.push({ k: 'path', d: `M${b} ${y} L42 ${y}`, stroke: 'glyph', sw: 3.4 });
    out.push({ k: 'path', d: `M${a} ${y} Q24 ${y - gap * 1.1} ${b} ${y}`, stroke: 'glyph', sw: 3.4, o: 0.85 });
    out.push({ k: 'path', d: `M${b - 3.5} ${y - 4} L${b} ${y} L${b - 4.5} ${y + 0.5} Z`, fill: 'glyph' });
  } else {
    const span = 34, w = span / hops, x0 = 7;
    out.push({ k: 'path', d: `M5 ${y} L7 ${y}`, stroke: 'glyph', sw: 3.4 });
    out.push({ k: 'path', d: `M41 ${y} L43 ${y}`, stroke: 'glyph', sw: 3.4 });
    for (let i = 0; i < hops; i++) {
      const a = x0 + i * w, b = a + w;
      out.push({ k: 'path', d: `M${a.toFixed(2)} ${y} Q${(a + w / 2).toFixed(2)} ${y - 15} ${b.toFixed(2)} ${y}`, stroke: 'glyph', sw: 3 });
    }
    out.push({ k: 'path', d: `M37.5 ${y - 4} L41 ${y} L37 ${y + 0.5} Z`, fill: 'glyph' });
  }
  return out;
}

/** pain_warrior: ripples opening from the sore spot. */
function ripples(n: number): ArtShape[] {
  const out: ArtShape[] = [{ k: 'circle', cx: 12, cy: 36, r: 4, fill: 'glyph' }];
  for (let i = 1; i <= n; i++) {
    const r = 8 + (i - 1) * 7;
    out.push({ k: 'path', d: `M12 ${36 - r} A${r} ${r} 0 0 1 ${12 + r} 36`, stroke: 'glyph', sw: 3.2, o: 1 - (i - 1) * 0.16 });
  }
  return out;
}

/** endurance: the cell you trained on, emptying. */
function battery(bars: number): ArtShape[] {
  const out: ArtShape[] = [
    { k: 'rect', x: 5, y: 15, w: 33, h: 18, rx: 4.5, stroke: 'glyph', sw: 3.4 },
    { k: 'rect', x: 40, y: 20, w: 4, h: 8, rx: 2, fill: 'glyph' },
  ];
  for (let i = 0; i < bars; i++) {
    out.push({ k: 'rect', x: 8.5 + i * 6.7, y: 19, w: 5.5, h: 10, rx: 1.5, fill: 'glyph' });
  }
  return out;
}

// ─── Every stage, built ──────────────────────────────────────────────────────

export const STAGE_GLYPHS: Record<string, ArtShape[]> = {
  'goals:ring-60': goalsRing(60),
  'goals:ring-120': goalsRing(120),
  'goals:ring-180': goalsRing(180),
  'goals:ring-240': goalsRing(240),
  'goals:ring-300': goalsRing(300),
  'goals:ring-closed': goalsRing('closed'),

  'milestone:steps-1': stairs(2),
  'milestone:steps-2': stairs(3),
  'milestone:steps-3': stairs(4),
  'milestone:steps-4': stairs(5),
  'milestone:steps-5': stairs(6),
  'milestone:steps-6': stairs(7),
  'milestone:steps-7': stairs(8),

  'streak:flame-ember': fire(0),
  'streak:flame-low': fire(1),
  'streak:flame-half': fire(2),
  'streak:flame-high': fire(3),
  'streak:flame-full': fire(4),

  'strength_progress:plates-1': loadingPin(1),
  'strength_progress:plates-2': loadingPin(2),
  'strength_progress:plates-3': loadingPin(3),
  'strength_progress:plates-4': loadingPin(4),
  'strength_progress:plates-5': loadingPin(5),

  'consistency:week-2': weekTiles(2),
  'consistency:week-3': weekTiles(3),
  'consistency:week-4': weekTiles(4),
  'consistency:week-5': weekTiles(5),
  'consistency:week-7': weekTiles(7),
  'consistency:month-block': monthTiles(),

  'variety:wheel-2': wheel(2),
  'variety:wheel-3': wheel(3),
  'variety:wheel-4': wheel(4),
  'variety:wheel-5': wheel(5),
  'variety:wheel-7': wheel(7),

  'session_full:core': figure(1),
  'session_full:core-head': figure(2),
  'session_full:upper-arms': figure(3),
  'session_full:full-arms': figure(4),
  'session_full:thighs': figure(5),
  'session_full:whole-body': figure(6),

  'session_conditioning:beat-1': trace(1),
  'session_conditioning:beat-2': trace(2),
  'session_conditioning:beat-3': trace(3),
  'session_conditioning:beat-4': trace(4),
  'session_conditioning:beat-5': trace(5),
  'session_conditioning:beat-6': trace(6),

  'session_prehab:plate-1': shield(1),
  'session_prehab:plate-2': shield(2),
  'session_prehab:plate-3': shield(3),
  'session_prehab:plate-4': shield(4),
  'session_prehab:plate-5': shield(5),
  'session_prehab:plate-6': shield(6),

  'session_flex:bow-1': band(0),
  'session_flex:bow-2': band(1),
  'session_flex:bow-3': band(2),
  'session_flex:bow-4': band(3),
  'session_flex:bow-5': band(4),
  'session_flex:bow-6': band(5),

  'session_lower:prints-1': prints(1),
  'session_lower:prints-2': prints(2),
  'session_lower:prints-3': prints(3),
  'session_lower:prints-4': prints(4),
  'session_lower:prints-5': prints(5),
  'session_lower:prints-6': prints(6),

  'session_upper:frame-1': chevron(0),
  'session_upper:frame-2': chevron(1),
  'session_upper:frame-3': chevron(2),
  'session_upper:frame-4': chevron(3),
  'session_upper:frame-5': chevron(4),
  'session_upper:frame-6': chevron(5),

  'session_custom:bricks-1': wall(1),
  'session_custom:bricks-2': wall(2),
  'session_custom:bricks-3': wall(3),
  'session_custom:bricks-4': wall(4),
  'session_custom:bricks-5': wall(5),
  'session_custom:bricks-6': wall(6),

  'exercise_milestone:plate-1': plateStack(1),
  'exercise_milestone:plate-2': plateStack(2),
  'exercise_milestone:plate-3': plateStack(3),
  'exercise_milestone:plate-4': plateStack(4),
  'exercise_milestone:plate-5': plateStack(5),
  'exercise_milestone:plate-6': plateStack(6),

  'time_of_day:before-dawn': sky('before-dawn'),
  'time_of_day:sunrise': sky('sunrise'),
  'time_of_day:noon': sky('noon'),
  'time_of_day:evening': sky('evening'),
  'time_of_day:night': sky('night'),
  'time_of_day:weekend': sky('weekend'),

  'recovery:shoot': sprig(1),
  'recovery:one-pair': sprig(2),
  'recovery:two-pairs': sprig(3),
  'recovery:three-pairs': sprig(3, true),
  'recovery:crown': [...sprig(3, true), { k: 'circle', cx: 24, cy: 43, r: 4, fill: 'glyph', o: 0.35 }],

  'duration:eighth': hourglass(0),
  'duration:quarter': hourglass(1),
  'duration:half': hourglass(2),
  'duration:three-quarter': hourglass(3),
  'duration:full': hourglass(4),

  'equipment:bare': rack(0),
  'equipment:one': rack(1),
  'equipment:two': rack(2),
  'equipment:three': rack(3),
  'equipment:four': rack(4),

  'test_week:tick-1': gauge(1),
  'test_week:tick-2': gauge(2),
  'test_week:tick-3': gauge(3),
  'test_week:tick-4': gauge(4),
  'test_week:tick-5': gauge(5),

  'comeback:short-hop': comeback(0),
  'comeback:long-hop': comeback(1),
  'comeback:far-hop': comeback(2),
  'comeback:three-hops': comeback(3),
  'comeback:five-hops': comeback(4),

  'pain_warrior:ripple-1': ripples(1),
  'pain_warrior:ripple-2': ripples(2),
  'pain_warrior:ripple-3': ripples(3),
  'pain_warrior:ripple-4': ripples(4),

  'endurance:three-bars': battery(3),
  'endurance:two-bars': battery(2),
  'endurance:one-bar': battery(1),
  'endurance:flat': battery(0),
};

// ─── Which badge sits on which rung ──────────────────────────────────────────
// Written stage-first because that is how the ladders were designed and how
// they are reviewed: you want to see the six badges that share a picture, not
// hunt one id at a time. The reverse lookup is built once below.

export const STAGE_MEMBERS: Record<string, readonly string[]> = {
  // goals
  'goals:ring-60': [
    'goal_strength_1rm', 'goal_muscle_1', 'goal_fatloss_1', 'goal_fitness_1', 'goal_rehab_1',
    'goal_power_1',
  ],
  'goals:ring-120': [
    'goal_strength_10', 'goal_muscle_10', 'goal_fatloss_10', 'goal_fitness_10', 'goal_rehab_5',
    'goal_power_5',
  ],
  'goals:ring-180': [
    'goal_strength_25', 'goal_muscle_25', 'goal_fatloss_25', 'goal_rehab_10', 'goal_power_10',
  ],
  'goals:ring-240': [
    'goal_strength_50', 'goal_muscle_50', 'goal_fatloss_50', 'goal_fitness_50', 'goal_rehab_25',
    'goal_power_25',
  ],
  'goals:ring-300': [
    'goal_strength_100', 'goal_muscle_100', 'goal_fatloss_100', 'goal_fitness_100', 'goal_rehab_50',
    'goal_power_50',
  ],
  'goals:ring-closed': [
    'goal_strength_pb', 'goal_muscle_volume', 'goal_fatloss_streak', 'goal_fitness_variety',
    'goal_fitness_all', 'goal_rehab_adapt', 'goal_power_max',
  ],
  // milestone
  // Two badges on the bottom rungs, because those are the medals on screen the
  // day somebody installs the app and the first five fall inside a fortnight.
  // Five hundred and seven hundred and fifty sessions are years apart and can
  // afford to share.
  'milestone:steps-1': ['onboarding_complete', 'milestone_1'],
  'milestone:steps-2': ['milestone_2', 'milestone_3'],
  'milestone:steps-3': ['milestone_5', 'milestone_7'],
  'milestone:steps-4': ['milestone_10', 'milestone_15', 'milestone_20'],
  'milestone:steps-5': ['milestone_25', 'milestone_30', 'milestone_40', 'milestone_50'],
  'milestone:steps-6': ['milestone_60', 'milestone_75', 'milestone_100', 'milestone_125', 'milestone_150'],
  'milestone:steps-7': [
    'milestone_175', 'milestone_200', 'milestone_250', 'milestone_300',
    'milestone_350', 'milestone_400', 'milestone_500', 'milestone_750',
  ],
  // streak
  'streak:flame-ember': ['streak_2wk', 'streak_4wk'],
  'streak:flame-low': ['streak_6wk', 'streak_8wk', 'streak_12wk'],
  'streak:flame-half': ['streak_16wk', 'streak_20wk'],
  'streak:flame-high': ['streak_26wk', 'streak_32wk', 'streak_40wk'],
  'streak:flame-full': ['streak_52wk', 'streak_78wk', 'streak_104wk'],
  // strength_progress
  'strength_progress:plates-1': ['progress_squat_5pct', 'progress_bench_5pct', 'progress_deadlift_5pct'],
  'strength_progress:plates-2': ['progress_squat_10pct', 'progress_bench_10pct', 'progress_deadlift_10pct'],
  'strength_progress:plates-3': ['progress_squat_20pct', 'progress_bench_20pct', 'progress_deadlift_20pct'],
  'strength_progress:plates-4': ['progress_squat_30pct', 'progress_bench_30pct', 'progress_deadlift_30pct'],
  'strength_progress:plates-5': ['progress_squat_50pct', 'progress_bench_50pct', 'progress_deadlift_50pct'],
  // consistency
  'consistency:week-2': ['consistent_2x_4wk', 'consistent_2x_8wk', 'consistent_2x_12wk'],
  'consistency:week-3': ['consistent_3x_4wk', 'consistent_3x_8wk', 'consistent_3x_12wk'],
  'consistency:week-4': ['consistent_4x_4wk', 'consistent_4x_8wk'],
  'consistency:week-5': ['consistent_5x_1wk', 'consistent_morning_10'],
  'consistency:week-7': ['consistent_7x_1wk', 'consistent_morning_30'],
  'consistency:month-block': ['consistent_20_month', 'consistent_30_month', 'consistent_100_year'],
  // variety
  'variety:wheel-2': ['variety_recovery_balance', 'variety_strength_cond'],
  'variety:wheel-3': [
    'variety_3_types', 'variety_3_in_week', 'variety_strength_trio', 'exercise_all_three_lifts',
    'exercise_push_pull_hinge', 'exercise_strength_variety',
  ],
  'variety:wheel-4': ['variety_all_in_month'],
  'variety:wheel-5': ['variety_5_types', 'variety_5_in_week', 'variety_50_per_type'],
  'variety:wheel-7': ['variety_all_types', 'exercise_full_spectrum'],
  // session_full
  'session_full:core': ['full_session_1'],
  'session_full:core-head': ['full_session_3', 'full_session_5'],
  'session_full:upper-arms': ['full_session_10', 'full_session_15'],
  'session_full:full-arms': ['full_session_20', 'full_session_25', 'full_session_30'],
  'session_full:thighs': ['full_session_50', 'full_session_75'],
  'session_full:whole-body': ['full_session_100', 'full_session_150', 'full_session_200'],
  // session_conditioning
  'session_conditioning:beat-1': ['conditioning_session_1'],
  'session_conditioning:beat-2': ['conditioning_session_3', 'conditioning_session_5'],
  'session_conditioning:beat-3': ['conditioning_session_10', 'conditioning_session_15'],
  'session_conditioning:beat-4': [
    'conditioning_session_20', 'conditioning_session_25', 'conditioning_session_30',
  ],
  'session_conditioning:beat-5': ['conditioning_session_50', 'conditioning_session_75'],
  'session_conditioning:beat-6': [
    'conditioning_session_100', 'conditioning_session_150', 'conditioning_session_200',
  ],
  // session_prehab
  'session_prehab:plate-1': ['prehab_session_1'],
  'session_prehab:plate-2': ['prehab_session_3', 'prehab_session_5'],
  'session_prehab:plate-3': ['prehab_session_10', 'prehab_session_15'],
  'session_prehab:plate-4': ['prehab_session_20', 'prehab_session_25', 'prehab_session_30'],
  'session_prehab:plate-5': ['prehab_session_50', 'prehab_session_75'],
  'session_prehab:plate-6': ['prehab_session_100', 'prehab_session_150', 'prehab_session_200'],
  // session_flex
  'session_flex:bow-1': ['flex_session_1'],
  'session_flex:bow-2': ['flex_session_3', 'flex_session_5'],
  'session_flex:bow-3': ['flex_session_10', 'flex_session_15'],
  'session_flex:bow-4': ['flex_session_20', 'flex_session_25', 'flex_session_30'],
  'session_flex:bow-5': ['flex_session_50', 'flex_session_75'],
  'session_flex:bow-6': ['flex_session_100', 'flex_session_150', 'flex_session_200'],
  // session_lower
  'session_lower:prints-1': ['lower_session_1'],
  'session_lower:prints-2': ['lower_session_3', 'lower_session_5'],
  'session_lower:prints-3': ['lower_session_10', 'lower_session_15'],
  'session_lower:prints-4': ['lower_session_20', 'lower_session_25', 'lower_session_30'],
  'session_lower:prints-5': ['lower_session_50', 'lower_session_75'],
  'session_lower:prints-6': ['lower_session_100', 'lower_session_150', 'lower_session_200'],
  // session_upper
  'session_upper:frame-1': ['upper_session_1'],
  'session_upper:frame-2': ['upper_session_3', 'upper_session_5'],
  'session_upper:frame-3': ['upper_session_10', 'upper_session_15'],
  'session_upper:frame-4': ['upper_session_20', 'upper_session_25', 'upper_session_30'],
  'session_upper:frame-5': ['upper_session_50', 'upper_session_75'],
  'session_upper:frame-6': ['upper_session_100', 'upper_session_150', 'upper_session_200'],
  // session_custom
  'session_custom:bricks-1': ['custom_session_1'],
  'session_custom:bricks-2': ['custom_session_3', 'custom_session_5'],
  'session_custom:bricks-3': ['custom_session_10', 'custom_session_15', 'exercise_custom_10'],
  'session_custom:bricks-4': [
    'custom_session_20', 'custom_session_25', 'custom_session_30', 'exercise_custom_25',
  ],
  'session_custom:bricks-5': ['custom_session_50', 'custom_session_75'],
  'session_custom:bricks-6': ['custom_session_100', 'custom_session_150', 'custom_session_200'],
  // exercise_milestone
  'exercise_milestone:plate-1': ['ex_pull_up_first', 'ex_hip_thrust_first'],
  'exercise_milestone:plate-2': ['ex_nordic_first', 'ex_farmers_carry_first'],
  'exercise_milestone:plate-3': ['ex_bird_dog_first', 'ex_dead_hang_first'],
  'exercise_milestone:plate-4': ['ex_ghd_first', 'ex_seal_row_first'],
  'exercise_milestone:plate-5': ['ex_front_squat_first', 'ex_landmine_first'],
  'exercise_milestone:plate-6': ['ex_ab_wheel_first', 'ex_ghd_10_sessions'],
  // time_of_day
  'time_of_day:before-dawn': ['time_5am'],
  'time_of_day:sunrise': ['time_early_5', 'time_early_20'],
  'time_of_day:noon': ['time_noon_10'],
  'time_of_day:evening': ['time_evening_5'],
  'time_of_day:night': ['time_night_1', 'time_night_10', 'time_midnight'],
  'time_of_day:weekend': ['time_weekend_10', 'time_weekend_30'],
  // recovery
  'recovery:shoot': ['exercise_recovery_week', 'recovery_week'],
  'recovery:one-pair': ['recovery_5', 'exercise_recovery_10'],
  'recovery:two-pairs': ['recovery_15', 'exercise_recovery_25'],
  'recovery:three-pairs': ['recovery_30', 'recovery_50'],
  'recovery:crown': ['recovery_100'],
  // duration
  'duration:eighth': ['duration_60min_1'],
  'duration:quarter': ['duration_60min_5', 'duration_45min_10'],
  'duration:half': ['duration_30_30', 'duration_60min_20'],
  'duration:three-quarter': ['duration_60min_50', 'duration_total_50h'],
  'duration:full': ['duration_total_100h'],
  // equipment
  'equipment:bare': ['equip_bodyweight'],
  'equipment:one': ['equip_bands', 'equip_upgraded'],
  'equipment:two': ['equip_dumbbells'],
  'equipment:three': ['equip_kettlebells'],
  'equipment:four': ['equip_fullgym', 'equip_all'],
  // test_week
  'test_week:tick-1': ['test_1'],
  'test_week:tick-2': ['test_3'],
  'test_week:tick-3': ['test_5'],
  'test_week:tick-4': ['test_10'],
  'test_week:tick-5': ['test_20'],
  // comeback
  'comeback:short-hop': ['comeback_7d'],
  'comeback:long-hop': ['comeback_14d'],
  'comeback:far-hop': ['comeback_30d'],
  'comeback:three-hops': ['comeback_3x'],
  'comeback:five-hops': ['comeback_5x'],
  // pain_warrior
  'pain_warrior:ripple-1': ['pain_warrior_1'],
  'pain_warrior:ripple-2': ['pain_warrior_3'],
  'pain_warrior:ripple-3': ['pain_warrior_5'],
  'pain_warrior:ripple-4': ['pain_warrior_10', 'pain_warrior_20'],
  // endurance
  'endurance:three-bars': ['endurance_1'],
  'endurance:two-bars': ['endurance_3'],
  'endurance:one-bar': ['endurance_5'],
  'endurance:flat': ['endurance_10'],
};

/**
 * Badge id to stage.
 *
 * Built from STAGE_MEMBERS at load, plus the numeric rules below for the
 * families whose ids carry their own magnitude. A rule beats a literal list
 * because a badge added later lands on the right rung without anybody
 * remembering to add it here - and a badge with no rung silently falls back to
 * its category's single drawing, which is the defect this file exists to fix.
 */
const NUMERIC_RULES: { match: RegExp; stages: string[]; cuts: number[] }[] = [
  { match: /^streak_(\d+)wk$/, stages: ['streak:flame-ember', 'streak:flame-low', 'streak:flame-half', 'streak:flame-high', 'streak:flame-full'], cuts: [4, 8, 16, 32] },
];

const REVERSE: Record<string, string> = {};
for (const [stage, ids] of Object.entries(STAGE_MEMBERS)) {
  for (const id of ids) REVERSE[id] = stage;
}

export function stageFor(badgeId: string): string | null {
  const own = REVERSE[badgeId];
  if (own) return own;
  for (const rule of NUMERIC_RULES) {
    const m = rule.match.exec(badgeId);
    if (!m) continue;
    const n = Number(m[1]);
    let i = 0;
    while (i < rule.cuts.length && n > rule.cuts[i]) i++;
    return rule.stages[Math.min(i, rule.stages.length - 1)];
  }
  return null;
}
