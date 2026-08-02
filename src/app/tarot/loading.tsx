/**
 * The exit fades the outgoing screen to nothing before `router.push` fires, so
 * without a boundary here the App Router has nothing to show while the segment
 * resolves and a cold hop lands on a blank screen. This renders inside
 * `tarot/layout.tsx`, so the header and the tableau are up the instant the push
 * lands and only the spread is still on its way.
 */
export default function Loading() {
  return <div className="flex flex-1" />;
}
