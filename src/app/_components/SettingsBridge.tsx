'use client';
import { useEffect } from 'react';
import { REDUCE_MOTION_ATTR, useSettings } from '../_libs/settings';
import { useSoundSync } from '../_libs/sound';

/**
 * Where a setting reaches something React cannot hand it.
 *
 * The reduce-motion attribute after first paint (the inline script in
 * `layout.tsx` owns the paint before hydration): CSS-owned motion — the page
 * entrance, the welcome hint's blink — cannot read a React hook, so the
 * stylesheets key their reduced form on this attribute as well as on the media
 * query. And the sound engine, which is a module-level `AudioContext` rather
 * than anything rendered; it is synced here because this is the one component
 * mounted on every screen, so turning sound off shuts the context down wherever
 * the visitor happens to be standing.
 */
export default function SettingsBridge() {
  const { reduceMotion } = useSettings();
  useSoundSync();
  useEffect(() => {
    const html = document.documentElement;
    if (reduceMotion) html.setAttribute(REDUCE_MOTION_ATTR, 'true');
    else html.removeAttribute(REDUCE_MOTION_ATTR);
  }, [reduceMotion]);
  return null;
}
