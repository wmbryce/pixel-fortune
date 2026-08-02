/**
 * The welcome → tarot hop and the reset were hard swaps: `router.push` fired on
 * the keypress and whatever arrived faded in over 3s (#15). The contract that
 * makes them transitions instead is that the push waits for the exit — a test
 * that only asserts "it navigated eventually" would pass on the old code.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DURATION, EASE_OUT } from '@/app/_libs/motion';

const push = vi.fn();
const prefetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, prefetch }),
}));

const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/app/_components/page-transition.css'),
  'utf8'
);
const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;

import PageTransition, {
  usePageLeave,
  VARIANTS,
  REDUCED_VARIANTS,
} from '@/app/_components/PageTransition';

function Leaver({ href, back }: { href: string; back?: boolean }) {
  const leave = usePageLeave();
  return (
    <button id="go" onClick={() => leave(href, back ? 'back' : 'forward')}>
      go
    </button>
  );
}

const main = () => document.querySelector('main') as HTMLElement;
const go = () => act(() => void document.getElementById('go')?.click());

const mount = (props: {
  href: string;
  back?: boolean;
  prefetch?: readonly string[];
}) =>
  render(
    <PageTransition className="page" prefetch={props.prefetch}>
      <Leaver {...props} />
    </PageTransition>
  );

beforeEach(() => {
  push.mockClear();
  prefetch.mockClear();
});

describe('PageTransition', () => {
  it('holds the push until the outgoing screen has left', async () => {
    mount({ href: '/tarot' });
    await go();

    expect(prefetch).toHaveBeenCalledWith('/tarot');
    expect(push).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/tarot'));
  });

  it('leaves forward by pushing past the viewer', async () => {
    mount({ href: '/tarot' });
    await go();
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    expect(main().style.transform).toMatch(/scale\(1\.03\)/);
  });

  it('leaves back by receding, so the reset mirrors the way in', async () => {
    mount({ href: '/welcome', back: true });
    await go();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/welcome'));
    expect(main().style.transform).toMatch(/scale\(0\.98\)/);
  });

  it('ignores a second key press during the exit', async () => {
    mount({ href: '/tarot' });
    await go();
    await go();
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it('renders the page it was given rather than wrapping it', () => {
    mount({ href: '/tarot' });
    expect(main().className).toContain('page');
  });

  /**
   * The entrance may not be the thing that makes the page visible. `initial` is
   * the only state the server can inline, so it has to be the visible one, and
   * the fade-in belongs to `page-transition.css` — which renders with no JS at
   * all and picks up `prefers-reduced-motion` from its own media query.
   */
  it('is visible before anything animates', () => {
    mount({ href: '/tarot' });
    expect(main().style.opacity === '' || main().style.opacity === '1').toBe(
      true
    );
    expect(main().className).toContain('page-enter');
    for (const variant of [VARIANTS, REDUCED_VARIANTS])
      expect(variant.enter.opacity).toBe(1);
  });

  /**
   * The stylesheet cannot import the tokens — it has to render before any JS
   * can read them — so the duplication is unavoidable and this is what keeps
   * it honest. Without it, raising `DURATION.page` lengthens the exit while
   * the entrance quietly stays where it was, and nothing says so.
   */
  it('states the same durations and easing the tokens do', () => {
    expect(stylesheet).toContain(
      `animation: page-enter ${ms(DURATION.page)} ` +
        `cubic-bezier(${EASE_OUT.join(', ')}) backwards;`
    );
    expect(stylesheet).toContain(
      `animation-duration: ${ms(DURATION.crossfade)};`
    );
  });

  /**
   * The exit takes the CSS entrance away with it — a running CSS animation
   * would outrank motion's inline styles for the rest of the entrance — so an
   * exit that started from motion's own last value would jump to full
   * brightness before fading. It has to pick up whatever is on screen.
   */
  it('leaves from the opacity the entrance had reached, not from full', async () => {
    mount({ href: '/tarot' });
    main().style.opacity = '0.4';

    await go();

    expect(Number(main().style.opacity)).toBeLessThanOrEqual(0.4);
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
  });

  /**
   * A ~240ms exit is not a head start a cold route can arrive inside, and the
   * outgoing screen is at zero opacity by the time the push fires — so the warm
   * has to happen long before the visitor asks to leave.
   */
  it('warms the routes it can leave to on mount, not on the way out', () => {
    mount({ href: '/tarot', prefetch: ['/tarot'] });
    expect(prefetch).toHaveBeenCalledWith('/tarot');
  });

  /**
   * Found in the browser, not here: the server cannot read the preference, so
   * every document arrives carrying `initial`'s `scale(0.985)` inline. A
   * reduced variant that merely omits `scale` leaves the client nothing to
   * write over it, and a direct load renders the page at 98.5% permanently.
   * jsdom has no SSR pass to reproduce that, so pin the invariant instead:
   * whatever the full-motion variants can put on screen, the reduced ones must
   * be able to take back.
   */
  it('reduced variants neutralise every property the server may have written', () => {
    for (const [name, full] of Object.entries(VARIANTS)) {
      const reduced = REDUCED_VARIANTS[name as keyof typeof REDUCED_VARIANTS];
      expect(Object.keys(full).sort()).toEqual(Object.keys(reduced).sort());
    }
    for (const variant of Object.values(REDUCED_VARIANTS)) {
      expect(variant.scale).toBe(1);
    }
  });
});
