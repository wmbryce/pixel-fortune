/**
 * The spread is sized to the stage rather than to breakpoints, because the
 * binding constraint is vertical — two rows above the dialog box's 256px — and
 * no width breakpoint expresses that. Decided in #14.
 *
 * These are the properties that layout has to keep: five cards on the stage at
 * every size, a plan whose caption row agrees with the one `Card` renders, and
 * — where no plan fits at all — one the stage can reserve, so the cards stay
 * reachable instead of being centred off both ends of it.
 */
import { describe, it, expect } from 'vitest';
import { planSpread, spreadCandidates } from '@/app/_components/CardTable';
import { cardCell, showsLabel } from '@/app/_components/Card';

const GAP = 12;

/** Every stage the app has to survive, minus header and the dialog's strip. */
const STAGES = [
  { name: 'iPhone SE 1, 320x568', w: 320, h: 244 },
  { name: 'iPhone SE 3, 375x667', w: 375, h: 343 },
  { name: 'iPhone 14, 390x844', w: 390, h: 520 },
  { name: 'Pixel, 412x915', w: 412, h: 591 },
  { name: 'tall, 390x1080', w: 390, h: 756 },
  { name: 'tablet, 768x1024', w: 768, h: 700 },
  { name: 'desktop, 1200x900', w: 1200, h: 576 },
];

/** Stages no plan fits, or where the short side is the wrong one. */
const SHORT_STAGES = [
  { name: 'landscape phone, 844x390', w: 844, h: 66 },
  { name: 'short window, 1024x500', w: 1024, h: 176 },
  { name: 'shorter window, 600x524', w: 600, h: 200 },
];

const widest = (plan: ReturnType<typeof planSpread>) =>
  Math.max(
    ...plan.rows.map(
      r => r.length * plan.cell.width + (r.length - 1) * GAP
    )
  );

const tall = (plan: ReturnType<typeof planSpread>) =>
  plan.rows.length * plan.cell.height + (plan.rows.length - 1) * GAP;

/**
 * The solver reserves a gutter of GAP outside the spread as well as between
 * the cards, so this is the box a plan is actually solved against.
 */
const budget = (stage: { w: number; h: number }) => ({
  w: stage.w - 2 * GAP,
  h: stage.h - 2 * GAP,
});

/** What a stage no card size can exhaust returns: the solver's own ceiling. */
const MAX_CARD = planSpread(4000, 4000).cardW;

describe('planSpread', () => {
  it.each(STAGES)('keeps all five cards on the stage at $name', stage => {
    const plan = planSpread(stage.w, stage.h);

    expect(plan.rows.flat().sort()).toEqual([0, 1, 2, 3, 4]);
    expect(widest(plan)).toBeLessThanOrEqual(stage.w);
    expect(tall(plan)).toBeLessThanOrEqual(stage.h);
  });

  it.each([...STAGES, ...SHORT_STAGES])(
    'plans the caption row Card will render at $name',
    stage => {
      const plan = planSpread(stage.w, stage.h);
      expect(plan.cell).toEqual(cardCell(plan.cardW));
    }
  );

  it.each(STAGES)('solves against the cell Card renders at $name', stage => {
    // The solver works in card widths and `cardCell` turns those into pixels,
    // so it has to spend Card's chrome and caption threshold, not a copy of
    // them: with a copy the answer is no longer the largest card that fits,
    // which is what one more pixel overflowing proves.
    const plan = planSpread(stage.w, stage.h);
    if (plan.cardW >= MAX_CARD) return;

    const cols = Math.max(...plan.rows.map(r => r.length));
    const bigger = cardCell(plan.cardW + 1);
    const box = budget(stage);

    expect(
      cols * bigger.width + (cols - 1) * GAP > box.w ||
        plan.rows.length * bigger.height + (plan.rows.length - 1) * GAP > box.h
    ).toBe(true);
  });

  it.each([...STAGES, ...SHORT_STAGES])(
    'picks a plan no alternative beats at $name',
    stage => {
      const plan = planSpread(stage.w, stage.h);

      for (const alt of spreadCandidates(stage.w, stage.h)) {
        // Overflowing while something fits, or being smaller *and* taller than
        // an equally fitting alternative, is the plan being chosen rather than
        // compared.
        expect(alt.fits && !plan.fits).toBe(false);
        expect(
          alt.fits === plan.fits &&
            alt.cardW > plan.cardW &&
            alt.height <= plan.height
        ).toBe(false);
      }
    }
  );

  it.each(SHORT_STAGES)('reports what the stage must reserve at $name', stage => {
    const plan = planSpread(stage.w, stage.h);

    // What CardTable puts on the stage as `minHeight`, so a plan taller than
    // the stage grows the column and scrolls instead of painting the cards
    // over the header and the dialog box.
    expect(plan.height).toEqual(tall(plan));
    expect(plan.width).toEqual(widest(plan));
    expect(plan.fits).toBe(tall(plan) <= stage.h && widest(plan) <= stage.w);
    // A width overflow has no scroll back to it, so it is never the trade.
    expect(widest(plan)).toBeLessThanOrEqual(stage.w);
  });

  it('reserving the plan settles in one pass', () => {
    // The reserve feeds back through the ResizeObserver, so the plan for the
    // reserved height has to be the same plan — otherwise the stage oscillates.
    for (const stage of [...STAGES, ...SHORT_STAGES]) {
      const plan = planSpread(stage.w, stage.h);
      const reserved = planSpread(stage.w, Math.max(stage.h, plan.height));
      expect(reserved.height).toEqual(plan.height);
      expect(reserved.rows).toEqual(plan.rows);
      expect(reserved.fits).toBe(true);
    }
  });

  it('takes the larger card over the shorter fallback on a short wide stage', () => {
    const plan = planSpread(1024, 176);
    const [, twoRows] = spreadCandidates(1024, 176);

    expect(plan.rows).toEqual([[0, 1, 2, 3, 4]]);
    expect(plan.cardW).toBeGreaterThan(twoRows.cardW);
    expect(tall(plan)).toBeLessThanOrEqual(176);
    expect(tall(twoRows)).toBeGreaterThan(176);
  });

  it('falls back to 2+3 once five across would be too small', () => {
    expect(planSpread(390, 520).rows).toEqual([
      [0, 1],
      [2, 3, 4],
    ]);
  });

  it('keeps one row while five fit at a usable size', () => {
    const plan = planSpread(1200, 576);
    expect(plan.rows).toEqual([[0, 1, 2, 3, 4]]);
    expect(plan.cardW).toBeGreaterThanOrEqual(96);
  });

  it('drops the caption rather than the fit on a short viewport', () => {
    const plan = planSpread(320, 244);
    expect(showsLabel(plan.cardW)).toBe(false);
    expect(tall(plan)).toBeLessThanOrEqual(244);
  });

  it('leaves a flipping card room between the rows', () => {
    const plan = planSpread(390, 520);
    // The flip grows a card ~19% taller (measured in #14); horizontal growth
    // is negligible because rotateY narrows the projection as scale grows.
    const peak = Math.round(plan.cardW * 1.5) * 1.19;
    const boxed = plan.cell.height - (showsLabel(plan.cardW) ? 22 : 0);
    expect((peak - boxed) / 2).toBeLessThan(GAP + 16);
  });
});
