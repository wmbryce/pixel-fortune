'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CROSSFADE, SPRING } from '../_libs/motion';
import { useReducedMotionPref } from '../_libs/settings';
import './modal.css';

type Props = {
  title: string;
  /** The only way out. Escape, the backdrop and the close button all call it. */
  onClose: () => void;
  children: ReactNode;
};

/**
 * A modal over a page that answers "any key" and "click anywhere". The native
 * `<dialog>` supplies the hard parts — top layer, inert background (the focus
 * trap, #18's contract), Escape — and this component supplies what the
 * platform leaves open:
 *
 * - **Containment.** The window listeners in `Welcome` and `DialogBox` still
 *   hear events from inside an open dialog — inert stops delivery *to* the
 *   background, not bubbling *through* it — so a keypress on a setting would
 *   advance the flow underneath. Keydown and click stop here, at the seam.
 * - **Focus, deterministically.** The panel is focused on open and the opener
 *   on close, rather than trusting `showModal`'s equivalents, so the contract
 *   is this component's own and `test/modal-access.test.tsx` can hold it.
 * - **Mounted only while open.** Closed is unmounted, so no `opacity: 0`
 *   surface ever ships in the document, and the entrance plays from mount.
 *   The close is immediate: an exit animation would hold the inert veil over
 *   a page the visitor has already asked back.
 */
export default function Modal({ title, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduced = useReducedMotionPref();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const opener = document.activeElement;
    el.showModal();
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (el.open) el.close();
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="pf-modal"
      // Escape's native path. Prevented and routed through `onClose` so the
      // dialog only ever closes by unmounting — two close paths would race.
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') onClose();
      }}
      onClick={event => {
        event.stopPropagation();
        // A click on the element itself is a click on the backdrop: the
        // panel fills everything else a pointer can reach.
        if (event.target === dialog.current) onClose();
      }}
    >
      <motion.div
        ref={panel}
        tabIndex={-1}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
        animate={
          reduced
            ? { opacity: 1, transition: CROSSFADE }
            : { opacity: 1, scale: 1, transition: SPRING.settle }
        }
        className="flex w-[min(92vw,480px)] max-h-[80dvh] flex-col gap-4 overflow-y-auto rounded-md border-8 border-brown_01 bg-brown_02 p-6 text-brown_03 font-sans outline-none"
      >
        <h2 id={titleId} className="text-2xl">
          {title}
        </h2>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="self-end rounded-md bg-brown_01 px-6 py-2 text-brown_02 hover:opacity-80 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown_03"
        >
          Close
        </button>
      </motion.div>
    </dialog>
  );
}
