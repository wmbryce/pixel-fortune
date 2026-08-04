/**
 * The reveal is a 3D flip, so both faces are always mounted and the rotation
 * is what hides one of them. The old reveal cross-faded the back out of the
 * tree, so "is the back in the DOM?" used to mean "is the card hidden?" — it
 * no longer does, and a test that forgets this passes on a card that never
 * turns. Decided in #13.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Card from '@/app/_components/Card';
import { CardType } from '@/types';

const DATA: CardType = {
  id: 0,
  name: 'The Fool',
  image: 'Tarot_00_Fool.png',
};

const flipper = () => document.getElementById('t-card-0') as HTMLElement | null;

/** Both faces are permanently mounted; only the rotation distinguishes them. */
const faces = () => document.querySelectorAll('img');

function renderCard(reveal: boolean, setReveal = vi.fn()) {
  const utils = render(
    <Card
      id="t-card-0"
      index={0}
      width={96}
      data={DATA}
      reveal={reveal}
      setReveal={setReveal}
    />
  );
  return { ...utils, setReveal };
}

describe('Card reveal', () => {
  it('mounts both faces so there is something to flip between', () => {
    renderCard(false);
    const alts = Array.from(faces()).map(img => img.getAttribute('alt'));
    expect(alts).toContain('Card Back');
    expect(alts).toContain('The Fool');
  });

  it('reports the reveal to the table on click', () => {
    const { setReveal } = renderCard(false);
    act(() => {
      flipper()?.click();
    });
    expect(setReveal).toHaveBeenCalledWith(0);
  });

  it('does not re-report a card that is already revealed', () => {
    const { setReveal } = renderCard(true);
    act(() => {
      flipper()?.click();
    });
    expect(setReveal).not.toHaveBeenCalled();
  });

  it('turns the card to the front when revealed', () => {
    const { rerender, setReveal } = renderCard(false);
    expect(flipper()?.style.transform ?? '').not.toMatch(/rotateY\(18\d/);

    rerender(
      <Card
        id="t-card-0"
        index={0}
        width={96}
        data={DATA}
        reveal
        setReveal={setReveal}
      />
    );

    // The spring is interruptible, so assert it lands rather than sampling it.
    return vi.waitFor(() =>
      expect(flipper()?.style.transform ?? '').toMatch(/rotateY\(180deg\)/)
    );
  });

  it('renders nothing without data', () => {
    const { container } = render(
      <Card
        id="t-card-0"
        index={0}
        width={96}
        data={null}
        setReveal={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
