/**
 * The same boundary as `tarot/loading.tsx`, for the reset's way back out.
 * `/welcome` has no layout of its own, so the ground is all there is to hold —
 * which is still the app's own ground rather than the blank the deferred push
 * would otherwise leave behind.
 */
export default function Loading() {
  return <div className="min-h-screen bg-black_01" />;
}
