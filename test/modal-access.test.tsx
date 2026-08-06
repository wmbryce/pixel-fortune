/**
 * The settings and credits modals (#3), held to #18's contracts. The trap
 * itself — the inert background — is `showModal()`'s and cannot run in jsdom
 * (see the stand-ins in `setup.ts`); what these pin is everything the
 * component owns on top of it: focus moves in on open and back to the trigger
 * on close, Escape closes, and — the part this app makes hard — nothing that
 * happens inside an open modal reaches the "any key, any click" listeners
 * underneath. Without that containment, ticking a checkbox on the welcome
 * screen navigates it, which is #18's keyboard trap wearing a new face.
 */
import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
const prefetch = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, prefetch }),
}));

import AppMenu from '@/app/_components/AppMenu';
import Welcome from '@/app/_components/Welcome';
import { STORAGE_KEY, reloadSettings } from '@/app/_libs/settings';

const dialog = () => document.querySelector('dialog');
const panel = () => dialog()?.querySelector<HTMLElement>('[tabindex="-1"]');
const trigger = (label: string) =>
  [...document.querySelectorAll('button')].find(
    b => b.textContent === label && !b.closest('dialog')
  )!;

const open = (label: string) => {
  fireEvent.click(trigger(label));
  return within(dialog()!);
};

beforeEach(() => {
  push.mockClear();
  prefetch.mockClear();
  window.localStorage.clear();
  reloadSettings();
});

describe('a modal, opened from the menu', () => {
  it('moves focus in on open and back to the trigger on close', () => {
    render(<AppMenu />);
    trigger('Settings').focus();
    open('Settings');
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(panel());

    fireEvent.keyDown(panel()!, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger('Settings'));
  });

  it('closes from its own button too', () => {
    render(<AppMenu />);
    const modal = open('Credits');
    fireEvent.click(modal.getByRole('button', { name: 'Close' }));
    expect(dialog()).toBeNull();
  });

  it('names itself: the dialog is labelled by its title', () => {
    render(<AppMenu />);
    open('Settings');
    const labelledBy = dialog()!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Settings');
  });

  it('lets nothing inside it reach the window listeners', () => {
    render(<AppMenu />);
    const onKey = vi.fn();
    const onClick = vi.fn();
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    try {
      const modal = open('Settings');
      fireEvent.keyDown(panel()!, { key: 'a' });
      fireEvent.keyDown(modal.getByLabelText('Reduce motion'), {
        key: 'Enter',
      });
      fireEvent.click(modal.getByLabelText('Fast'));
      expect(onKey).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    }
  });
});

describe('the settings modal', () => {
  it('controls the store it claims to: nothing is a no-op', () => {
    render(<AppMenu />);
    const modal = open('Settings');

    fireEvent.click(modal.getByLabelText('Reduce motion'));
    fireEvent.click(modal.getByLabelText('Instant'));

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.reduceMotion).toBe(true);
    expect(stored.textSpeed).toBe('instant');
  });
});

describe('the credits modal', () => {
  it('attributes what the repo actually uses', () => {
    render(<AppMenu />);
    const modal = open('Credits');
    // The art and the readings.
    modal.getByText(/DALL·E/);
    // The two faces the app is set in, with their designers and license.
    modal.getByText(/Pixelify Sans by Stefie Justprince/);
    modal.getByText(/Inter by\s+Rasmus Andersson/);
    modal.getByText(/SIL Open Font License/);
    // The load-bearing libraries, and the author.
    modal.getByText(/Next\.js, React, Motion, tRPC/);
    modal.getByText(/Michael Bryce/);
    expect(
      modal
        .getByRole('link', { name: /github\.com\/wmbryce\/pixel-fortune/ })
        .getAttribute('href')
    ).toBe('https://github.com/wmbryce/pixel-fortune');
  });
});

/**
 * `Welcome` rendered standalone beside the menu, the `welcome-access` idiom:
 * outside a `PageTransition` its `usePageLeave` falls back to `router.push`,
 * so "did the ambient path fire" is one synchronous assertion — through the
 * real page it is deferred to an animation jsdom never completes, and a
 * not-called assertion would pass vacuously.
 */
describe('the menu beside the welcome listeners, which answer any key and any click', () => {
  const mount = () =>
    render(
      <>
        <Welcome />
        <AppMenu />
      </>
    );

  it('opens a modal without also leaving the page', () => {
    mount();
    fireEvent.click(trigger('Settings'));
    expect(dialog()).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not navigate on Enter aimed at a trigger', () => {
    mount();
    const settings = trigger('Settings');
    settings.focus();
    fireEvent.keyDown(settings, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('holds the page still under keys and clicks inside the modal', () => {
    mount();
    // Focused first: jsdom does not focus on click the way a browser does,
    // and the close is what should hand focus back here.
    trigger('Settings').focus();
    fireEvent.click(trigger('Settings'));
    const modal = within(dialog()!);

    fireEvent.keyDown(panel()!, { key: 'x' });
    fireEvent.click(modal.getByLabelText('Reduce motion'));
    fireEvent.keyDown(panel()!, { key: 'Escape' });

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger('Settings'));
    expect(push).not.toHaveBeenCalled();
  });

  it('still leaves on an ambient key once the modal is closed', async () => {
    mount();
    fireEvent.click(trigger('Settings'));
    fireEvent.keyDown(panel()!, { key: 'Escape' });
    await act(async () => {
      fireEvent.keyDown(window, { key: 'z' });
    });
    expect(push).toHaveBeenCalled();
  });
});
