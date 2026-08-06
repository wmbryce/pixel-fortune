/**
 * The settings store (#3): what is stored is honoured, what is garbage is
 * ignored, and the reduce-motion override actually reaches the surfaces that
 * animate. Two of the readers cannot go through the hook — the CSS entrance
 * and the welcome hint run before hydration — so the last cases pin the
 * restatements the same way `site-metadata.test.ts` pins the origin: the app
 * renders identically with a broken restatement, and nothing else notices.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_SETTINGS,
  REDUCE_MOTION_ATTR,
  STORAGE_KEY,
  reloadSettings,
  updateSettings,
  useReducedMotionPref,
  useSettings,
} from '@/app/_libs/settings';
import SettingsBridge from '@/app/_components/SettingsBridge';
import TypingText from '@/app/_components/TypingText';

function Probe() {
  const settings = useSettings();
  const reduced = useReducedMotionPref();
  return (
    <span
      data-testid="probe"
      data-reduced={String(reduced)}
      data-speed={settings.textSpeed}
    />
  );
}

const probe = () => {
  const el = document.querySelector('[data-testid="probe"]');
  return {
    reduced: el?.getAttribute('data-reduced'),
    speed: el?.getAttribute('data-speed'),
  };
};

beforeEach(() => {
  window.localStorage.clear();
  reloadSettings();
});

describe('the settings store', () => {
  it('answers the defaults when nothing is stored', () => {
    render(<Probe />);
    expect(probe()).toEqual({ reduced: 'false', speed: 'normal' });
  });

  it('persists an update and serves it to a fresh read', () => {
    render(<Probe />);
    act(() => updateSettings({ reduceMotion: true, textSpeed: 'fast' }));
    expect(probe()).toEqual({ reduced: 'true', speed: 'fast' });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual({ reduceMotion: true, textSpeed: 'fast' });

    act(() => reloadSettings());
    expect(probe()).toEqual({ reduced: 'true', speed: 'fast' });
  });

  it('falls back to the defaults on garbage, field by field', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ reduceMotion: 'yes', textSpeed: 'warp', sound: true })
    );
    reloadSettings();
    render(<Probe />);
    expect(probe()).toEqual({ reduced: 'false', speed: 'normal' });

    window.localStorage.setItem(STORAGE_KEY, 'not json');
    act(() => reloadSettings());
    expect(probe()).toEqual({ reduced: 'false', speed: 'normal' });
  });
});

describe('the reduce-motion override', () => {
  it('is stamped on <html> by the bridge, and removed again', () => {
    render(<SettingsBridge />);
    expect(document.documentElement.hasAttribute(REDUCE_MOTION_ATTR)).toBe(
      false
    );
    act(() => updateSettings({ reduceMotion: true }));
    expect(document.documentElement.getAttribute(REDUCE_MOTION_ATTR)).toBe(
      'true'
    );
    act(() => updateSettings({ reduceMotion: false }));
    expect(document.documentElement.hasAttribute(REDUCE_MOTION_ATTR)).toBe(
      false
    );
  });

  /**
   * The pre-hydration readers. The boot script in `layout.tsx` restates the
   * storage key and the attribute because a server component cannot import
   * them, and both stylesheets restate the attribute because a stylesheet
   * cannot import anything. A drift breaks only the unhydrated first paint,
   * which no other spec can see.
   */
  it('is restated verbatim by the boot script and both stylesheets', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain(`localStorage.getItem('${STORAGE_KEY}')`);
    expect(layout).toContain(`'${REDUCE_MOTION_ATTR}'`);

    for (const sheet of [
      'src/app/_components/page-transition.css',
      'src/app/welcome/welcome.css',
    ])
      expect(readFileSync(sheet, 'utf8')).toContain(
        `:root[${REDUCE_MOTION_ATTR}]`
      );
  });
});

describe('TypingText under the text-speed setting', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const runTimers = async (ms: number, slice = 30) => {
    for (let t = 0; t < ms; t += slice) {
      await act(async () => {
        vi.advanceTimersByTime(slice);
      });
    }
  };
  const body = () => document.querySelector('p.font-pixel')?.textContent ?? '';

  const TEXT = 'A reading, paced by the visitor.';

  it('paints the page whole on instant', async () => {
    updateSettings({ textSpeed: 'instant' });
    const done = vi.fn();
    render(<TypingText text={TEXT} delay={0} skip={false} onDone={done} />);
    await act(async () => {});
    expect(body()).toBe(TEXT);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('types faster than normal on fast, and still completes', async () => {
    updateSettings({ textSpeed: 'fast' });
    const done = vi.fn();
    render(<TypingText text={TEXT} delay={0} skip={false} onDone={done} />);
    // 12ms a character: well inside the window normal's 30ms would still be
    // mid-page in.
    await runTimers(TEXT.length * 12 + 200, 12);
    expect(body()).toBe(TEXT);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('keeps the defaults intact for everyone else', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      reduceMotion: false,
      textSpeed: 'normal',
    });
  });
});
