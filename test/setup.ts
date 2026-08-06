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

/**
 * jsdom ships no `<dialog>` methods either. These stand-ins run `Modal`'s
 * open/close lifecycle — the `open` attribute and the `close` event — so specs
 * can hold the component's own contract (initial focus, containment, Escape,
 * focus return). What they do not simulate is what the browser owns: the top
 * layer and the inert background that is the focus trap itself.
 */
const dialogProto = window.HTMLDialogElement?.prototype as
  | (HTMLDialogElement & { showModal?: () => void })
  | undefined;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function (this: HTMLElement) {
    this.setAttribute('open', '');
  };
  dialogProto.close = function (this: HTMLElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  if (!('open' in dialogProto))
    Object.defineProperty(dialogProto, 'open', {
      get(this: HTMLElement) {
        return this.hasAttribute('open');
      },
      configurable: true,
    });
}
