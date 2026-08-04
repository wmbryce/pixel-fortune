/**
 * Which keydowns the ambient "press any key to continue" path answers.
 *
 * "Any key" is a convenience, not a contract, and the rule that bounds it is
 * that a key whose whole purpose is navigation is never an activation. That
 * covers moving focus (Tab, and Shift for a reverse tab) and moving the
 * viewport (the arrows, PageUp/PageDown, Home/End) alike: the spread can be
 * taller than the stage, so on a short viewport those are the only way to
 * reach the cards, and with focus on `<body>` every one of them used to
 * advance the flow out from under the visitor — refused at the reveal prompt,
 * paging the reading they were scrolling to read. Space is not one of these;
 * it is a legitimate "press any key", and the Enter/Space-on-a-button guard
 * already covers it whenever a control holds focus. Everything else still
 * counts, focus or not.
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
]);

export const isAnyKeyPress = (event: KeyboardEvent) =>
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !NAVIGATION.has(event.key);
