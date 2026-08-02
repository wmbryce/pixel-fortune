/**
 * The spread is sized to the stage rather than to breakpoints, because the
 * binding constraint is vertical — two rows above the dialog box's 256px — and
 * no width breakpoint expresses that. Decided in #14.
 *
 * These are the properties that layout has to keep: five cards on the stage at
 * every size, and a plan whose caption row agrees with the one `Card` renders.
 */
import { describe, it, expect } from 'vitest';
import { planSpread } from '@/app/_components/CardTable';
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

const widest = (plan: ReturnType<typeof planSpread>) =>
  Math.max(
    ...plan.rows.map(
      r => r.length * plan.cell.width + (r.length - 1) * GAP
    )
  );

const tall = (plan: ReturnType<typeof planSpread>) =>
  plan.rows.length * plan.cell.height + (plan.rows.length - 1) * GAP;

describe('planSpread', () => {
  it.each(STAGES)('keeps all five cards on the stage at $name', stage => {
    const plan = planSpread(stage.w, stage.h);

    expect(plan.rows.flat().sort()).toEqual([0, 1, 2, 3, 4]);
    expect(widest(plan)).toBeLessThanOrEqual(stage.w);
    expect(tall(plan)).toBeLessThanOrEqual(stage.h);
  });

  it.each(STAGES)('plans the caption row Card will render at $name', stage => {
    const plan = planSpread(stage.w, stage.h);
    expect(plan.cell).toEqual(cardCell(plan.cardW));
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
