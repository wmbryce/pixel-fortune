/**
 * Per-request identity for the rate limiter. See `rate-limit.ts` for why it is
 * IP *and* cookie rather than either alone.
 */
import { randomUUID } from 'node:crypto';
import { Visitor } from './rate-limit';

const COOKIE_NAME = 'pf_visitor';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type Context = {
  visitor: Visitor;
  /** Set when this request had no visitor cookie yet; the route attaches it. */
  setCookie?: string;
};

const readCookie = (header: string | null, name: string) =>
  header
    ?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;

export function createContext(req: Request): Context {
  // `x-real-ip` is set by Vercel's proxy and cannot be forged by the client;
  // `x-forwarded-for` is client-appendable and only used off-platform.
  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local';

  const existing = readCookie(req.headers.get('cookie'), COOKIE_NAME);
  const visitorId = existing ?? randomUUID();

  const attributes = [
    `${COOKIE_NAME}=${visitorId}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');

  return {
    visitor: { ip, visitorId },
    setCookie: existing ? undefined : attributes.join('; '),
  };
}
