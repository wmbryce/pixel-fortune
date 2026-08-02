/**
 * jsdom ships no `matchMedia`, and both the reduced-motion path and the hover
 * gate ask for one during render. Install the answer a plain touch device with
 * no stated preference would give; a spec that wants a different one stubs
 * `matchMedia` itself, before its first render — `motion` reads the preference
 * once, lazily, on the first `useReducedMotion`.
 */
import { vi } from 'vitest';

export const mediaQueryList = (query: string, matches: boolean) =>
  ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

vi.stubGlobal('matchMedia', (query: string) => mediaQueryList(query, false));
