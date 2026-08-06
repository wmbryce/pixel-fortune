'use client';
import { useEffect } from 'react';
import { REDUCE_MOTION_ATTR, useSettings } from '../_libs/settings';

/**
 * The one writer of the reduce-motion attribute after first paint (the inline
 * script in `layout.tsx` owns the paint before hydration). CSS-owned motion —
 * the page entrance, the welcome hint's blink — cannot read a React hook, so
 * the stylesheets key their reduced form on this attribute as well as on the
 * media query.
 */
export default function SettingsBridge() {
  const { reduceMotion } = useSettings();
  useEffect(() => {
    const html = document.documentElement;
    if (reduceMotion) html.setAttribute(REDUCE_MOTION_ATTR, 'true');
    else html.removeAttribute(REDUCE_MOTION_ATTR);
  }, [reduceMotion]);
  return null;
}
