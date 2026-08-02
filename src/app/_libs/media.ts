'use client';
/**
 * `whileHover` is a pointer-enter handler, and a touch tap fires pointer-enter
 * — so an ungated hover lift plays on every tap on a phone, on top of the press
 * feedback (audit finding #6). Gate it on the device actually having a hover.
 *
 * `useSyncExternalStore` rather than an effect: it is right in the first
 * committed frame, it re-renders if a keyboard and trackpad are attached later,
 * and it does not call `setState` from an effect.
 */
import { useSyncExternalStore } from 'react';

const HOVER = '(hover: hover) and (pointer: fine)';

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(HOVER);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

/** False on the server and in the first paint, so touch is the safe default. */
export const useHoverCapable = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(HOVER).matches,
    () => false
  );
