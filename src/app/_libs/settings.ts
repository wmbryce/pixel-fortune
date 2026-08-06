'use client';
/**
 * App-level settings (#3), kept to what the app can honour today: an override
 * that forces the reduced-motion path for a visitor whose OS preference is
 * off, and the typewriter's pace. #4's sound toggle belongs here too — add a
 * key to `Settings` and a control to the settings modal, nothing else moves.
 *
 * A module-level external store rather than context, the `media.ts` idiom: it
 * is right in the first committed frame, and no provider has to wrap anything.
 * The server snapshot is the defaults, so a stored preference is applied by a
 * post-hydration re-render — never a hydration mismatch. The one surface that
 * cannot wait for hydration, the CSS entrance, is covered by the inline script
 * in `layout.tsx`, which restates `STORAGE_KEY` because a server component
 * cannot import from this client module; `test/settings.test.ts` pins the two
 * together.
 */
import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'motion/react';

export const STORAGE_KEY = 'pf-settings';
/** Stamped on `<html>` so stylesheets can honour the override; see the bridge. */
export const REDUCE_MOTION_ATTR = 'data-pf-reduce-motion';

export const TEXT_SPEEDS = ['normal', 'fast', 'instant'] as const;
export type TextSpeed = (typeof TEXT_SPEEDS)[number];

export type Settings = {
  /** ORed with the OS preference — it can only ever reduce further. */
  reduceMotion: boolean;
  textSpeed: TextSpeed;
};

export const DEFAULT_SETTINGS: Settings = {
  reduceMotion: false,
  textSpeed: 'normal',
};

const isTextSpeed = (value: unknown): value is TextSpeed =>
  TEXT_SPEEDS.includes(value as TextSpeed);

/** Whatever is stored is a visitor's old tab or a hand edit; trust no field. */
const sanitize = (raw: unknown): Settings => {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const record = raw as Record<string, unknown>;
  return {
    reduceMotion: record.reduceMotion === true,
    textSpeed: isTextSpeed(record.textSpeed)
      ? record.textSpeed
      : DEFAULT_SETTINGS.textSpeed,
  };
};

const read = (): Settings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_SETTINGS : sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// Cached because `useSyncExternalStore` compares snapshots by identity: a
// fresh object from every `getSnapshot` call is an endless re-render.
let snapshot: Settings | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

const getSnapshot = (): Settings => (snapshot ??= read());
const getServerSnapshot = (): Settings => DEFAULT_SETTINGS;

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export const updateSettings = (change: Partial<Settings>) => {
  snapshot = { ...getSnapshot(), ...change };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage denied leaves the setting live for this page, which is honest.
  }
  notify();
};

/** Drop the cache and re-read storage. For specs; harmless anywhere. */
export const reloadSettings = () => {
  snapshot = null;
  notify();
};

export const useSettings = (): Settings =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/**
 * What every animated surface reads instead of `useReducedMotion()`: the OS
 * preference or the app override, either is enough. `motion`'s lazy
 * once-per-module-graph read of the media query is unchanged underneath.
 */
export const useReducedMotionPref = (): boolean => {
  const os = useReducedMotion() ?? false;
  const { reduceMotion } = useSettings();
  return os || reduceMotion;
};
