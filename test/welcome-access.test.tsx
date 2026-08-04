/**
 * The welcome screen, which is where a visitor arrives and where #18 rewrote
 * the most: the window `touchstart` that called `preventDefault` became a plain
 * `click`, the window `keydown` went through `isAnyKeyPress`, and the hint went
 * from a `<p>` — the screen had no tab stop at all — to a real button.
 *
 * Nothing pinned any of it. Every case below is a regression that would
 * otherwise pass lint, typecheck and the whole suite while quietly taking the
 * screen back to a wall: an answered Tab navigates before the visitor can reach
 * the hint, a dropped click listener strands every touch visitor, and a
 * restored `preventDefault` takes the page's scroll and pinch-zoom with it.
 *
 * `Welcome` is rendered on its own, outside a `PageTransition`, so
 * `usePageLeave` falls back to `router.push` — which makes "did it navigate?"
 * exactly one assertion.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
const prefetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, prefetch }),
}));

import Welcome from '@/app/_components/Welcome';

const hint = () => document.querySelector('button.continue-hint');

const mount = () => render(<Welcome />);

const key = (k: string) =>
  act(() => void fireEvent.keyDown(window, { key: k }));

beforeEach(() => {
  push.mockClear();
  prefetch.mockClear();
});

describe('Welcome, reached without a mouse', () => {
  /**
   * Tab is the only way to the hint, and Space is how the page is scrolled.
   * Answering either navigates out from under a visitor who was only trying to
   * look at the screen they had just arrived on.
   */
  it('does not navigate on the keys a visitor gets around with', async () => {
    mount();
    for (const k of [
      'Tab',
      'Shift',
      'ArrowDown',
      'PageDown',
      'Home',
      'End',
      ' ',
    ])
      await key(k);
    expect(push).not.toHaveBeenCalled();
  });

  /** "Press any key to continue" still means what it says. */
  it('navigates on an ordinary key, from anywhere on the page', async () => {
    mount();
    await key('x');
    expect(push).toHaveBeenCalledWith('/tarot');
  });

  /**
   * The touch path in full. It was a `touchstart` listener that cancelled every
   * touch on the window; a plain click is what a tap raises anyway, and the
   * navigation was always idempotent against the double-fire that cancelling
   * was there to prevent.
   */
  it('navigates on a tap anywhere, without cancelling the touch', async () => {
    mount();

    const touch = new Event('touchstart', { bubbles: true, cancelable: true });
    await act(() => void window.dispatchEvent(touch));
    // Cancelling this took the page's scroll and pinch-zoom with it.
    expect(touch.defaultPrevented).toBe(false);

    await act(() => void fireEvent.click(window));
    expect(push).toHaveBeenCalledWith('/tarot');
  });

  /**
   * The hint is the screen's only tab stop, so it has to be a control the
   * browser will focus and activate on its own. That is what carries Space,
   * which the ambient path no longer answers at all: the browser synthesises a
   * click on the focused button, and the click is the activation.
   */
  it('offers the hint as a real, focusable control', async () => {
    mount();
    const control = hint() as HTMLButtonElement;

    expect(control).not.toBeNull();
    expect(control.tagName).toBe('BUTTON');
    expect(control.type).toBe('button');

    control.focus();
    expect(document.activeElement).toBe(control);

    // The browser answers Enter and Space on a focused button with a click of
    // its own; jsdom does not, so the click is what stands in for them.
    await act(() => void control.click());
    expect(push).toHaveBeenCalledWith('/tarot');
  });

  /**
   * The name comes from the button's own text, so whichever span the media
   * query leaves displayed is what it is called — no `aria-label` to drift from
   * what is on screen. jsdom loads no stylesheet, so both strings are present
   * here; which one is displayed is the browser's to show.
   */
  it('is named by the copy it displays, not by an attribute', () => {
    mount();
    const control = hint() as HTMLButtonElement;

    expect(control.getAttribute('aria-label')).toBeNull();
    expect(control.getAttribute('aria-labelledby')).toBeNull();
    expect(control.textContent).toContain('Press any key to continue');
    expect(control.textContent).toContain('Tap to continue');
  });

  /** The screen had no heading either, so nothing said where the visitor was. */
  it('names the page for a screen reader', () => {
    mount();
    const heading = document.querySelector('h1');
    expect(heading?.textContent).toBe('Pixel Fortune');
    expect(heading?.className).toContain('sr-only');
  });
});
