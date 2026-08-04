/**
 * Which keydowns the ambient "press any key to continue" path answers.
 *
 * "Any key" is a convenience, not a contract. Before this, `keydown` on the
 * window answered *every* key, so Tab — the only way a keyboard visitor moves
 * between the cards and the dialog's button — advanced the flow out from under
 * them, and Shift for a reverse tab did it again. The keys spent on getting
 * around the page are the ones that must not also drive it; everything else
 * still counts, focus or not.
 */
const NAVIGATION = new Set([
  'Tab',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'Escape',
  'CapsLock',
  'ContextMenu',
]);

export const isAnyKeyPress = (event: KeyboardEvent) =>
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !NAVIGATION.has(event.key);
