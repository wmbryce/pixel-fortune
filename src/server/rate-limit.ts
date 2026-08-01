/**
 * Per-visitor throttle. Not the spend protection — that is the cap in
 * `budget.ts` — this exists so one visitor cannot monopolise the live budget,
 * and so poisoning the reading cache is slow.
 *
 * Identity is IP *and* a server-set cookie, limited on both, because neither
 * alone works. IP alone punishes a shared NAT: an office or a campus would
 * share one allowance. A cookie alone is cleared in two clicks. Limiting the
 * (IP, cookie) pair gives every real visitor behind a NAT their own allowance,
 * and the coarser per-IP limit is what a cookie-clearing loop falls through to.
 * The IP comes from `x-real-ip`, which Vercel's proxy sets and a client cannot
 * forge — unlike `x-forwarded-for`, which is client-appendable.
 *
 * Exceeding the limit is not an error. The visitor is served from the reading
 * cache instead, which is indistinguishable from a live reading, so there is no
 * throttle UI to build and no dead end to fall into. Volumetric abuse of the
 * (AI-free) draw endpoint is left to Vercel's own firewall rather than
 * hand-rolled here.
 */
import { createHash } from 'node:crypto';
import { config } from './config';
import { getStore } from './store';

export type Visitor = { ip: string; visitorId: string };

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 16);

/** Fixed windows: cheap, and a boundary reset only ever helps a real visitor. */
const currentWindow = () =>
  Math.floor(Date.now() / (config.rateWindowSeconds * 1000));

/**
 * The (IP, cookie) pair as one opaque key. Shared with the budget's concurrent
 * hold bound so both throttles agree on who a visitor is.
 */
export const visitorIdentity = (visitor: Visitor) =>
  digest(`${visitor.ip}|${visitor.visitorId}`);

/**
 * Returns true when this visitor may still consume live budget. Both counters
 * are always incremented so a visitor cannot dodge the per-IP tally by hitting
 * the per-visitor limit first.
 */
export async function withinRateLimit(visitor: Visitor): Promise<boolean> {
  const store = getStore();
  const window = currentWindow();
  const ttl = config.rateWindowSeconds;

  const [perVisitor, perIp] = await Promise.all([
    store.incrWithTtl(`pf:rl:v:${visitorIdentity(visitor)}:${window}`, ttl),
    store.incrWithTtl(`pf:rl:i:${digest(visitor.ip)}:${window}`, ttl),
  ]);

  return perVisitor <= config.visitorRateLimit && perIp <= config.ipRateLimit;
}
