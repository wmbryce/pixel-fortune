/**
 * Which keydowns the ambient "press any key to continue" path answers.
 *
 * "Any key" is a convenience, not a contract, and the rule that bounds it is
 * that a key whose purpose *in the focus context it arrives in* is navigation
 * is never an activation. This filter only ever sees the ambient context — a
 * window listener, with `<body>` holding focus — so what it takes out is what
 * navigates from there: moving focus (Tab, and Shift for a reverse tab) and
 * moving the viewport (the arrows, PageUp/PageDown, Home/End) alike. The
 * spread can be taller than the stage, so on a short viewport those are the
 * only way to reach the cards, and every one of them used to advance the flow
 * out from under the visitor — refused at the reveal prompt, paging the
 * reading they were scrolling to read.
 *
 * Space is the one key whose purpose depends on that context, so it is split
 * rather than kept or dropped whole. At `<body>` level Space is the page's
 * scroll key and nothing else, which is the same failure as the arrows, so it
 * is listed here and the ambient path stops answering it. On a focused control
 * Space is unambiguous and it still activates — the browser synthesises a click
 * on the focused button, and that click is what reaches the dialog, so this
 * filter is never consulted on that path. Enter is not a scroll key at `<body>`
 * level, so Enter stays ambient. Everything else still counts, focus or not.
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
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

export const isAnyKeyPress = (event: KeyboardEvent) =>
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !NAVIGATION.has(event.key);
