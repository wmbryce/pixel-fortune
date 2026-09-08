// The preview helper's three invariants: both bypass parameters reach the
// browser, the secret never leaves Vercel, and a missing secret is loud.
// Background in docs/preview-access.md.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  primePreviewUrl,
  readSecret,
  requireVercelUrl,
} from '../scripts/preview.mjs';

const DEPLOYMENT = 'https://pixel-fortune-abc123-dpoch.vercel.app';
const SECRET = 'a-bypass-secret';

function tempEnvFile(contents: string) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'pf-')), '.env.local');
  writeFileSync(file, contents);
  return file;
}

describe('primePreviewUrl', () => {
  it('carries the bypass secret and asks for the cookie', () => {
    const primed = new URL(primePreviewUrl(`${DEPLOYMENT}/tarot`, SECRET));

    expect(primed.searchParams.get('x-vercel-protection-bypass')).toBe(SECRET);
    // Without this the bypass covers the first request only, and the first
    // click inside the page lands back on the SSO gate.
    expect(primed.searchParams.get('x-vercel-set-bypass-cookie')).toBe('true');
    expect(primed.pathname).toBe('/tarot');
  });

  it('keeps query the caller already had', () => {
    const primed = new URL(primePreviewUrl(`${DEPLOYMENT}/?debug=1`, SECRET));

    expect(primed.searchParams.get('debug')).toBe('1');
    expect(primed.searchParams.get('x-vercel-protection-bypass')).toBe(SECRET);
  });
});

describe('requireVercelUrl', () => {
  it('accepts an https Vercel deployment', () => {
    expect(requireVercelUrl(DEPLOYMENT).hostname).toBe(
      'pixel-fortune-abc123-dpoch.vercel.app'
    );
  });

  // The secret opens every protected deployment in the project, so a typo'd or
  // hostile host must never be handed it.
  it.each([
    ['a host that is not Vercel', 'https://example.com/'],
    ['a lookalike host', 'https://vercel.app.example.com/'],
    ['plaintext http', 'http://pixel-fortune-abc123-dpoch.vercel.app/'],
    ['not a URL at all', 'pixel-fortune.vercel.app'],
  ])('refuses %s', (_label, url) => {
    expect(() => requireVercelUrl(url)).toThrow();
  });
});

describe('readSecret', () => {
  it('prefers the environment', () => {
    const file = tempEnvFile('VERCEL_AUTOMATION_BYPASS_SECRET=from-file\n');
    const env = { VERCEL_AUTOMATION_BYPASS_SECRET: 'from-env' };

    expect(readSecret(env, file)).toBe('from-env');
  });

  it('falls back to the env file, quoted or bare', () => {
    const quoted = tempEnvFile('VERCEL_AUTOMATION_BYPASS_SECRET="quoted"\n');
    const bare = tempEnvFile('VERCEL_AUTOMATION_BYPASS_SECRET=bare\n');

    expect(readSecret({}, quoted)).toBe('quoted');
    expect(readSecret({}, bare)).toBe('bare');
  });

  it('fails loudly when there is no secret anywhere', () => {
    expect(() => readSecret({}, tempEnvFile('OPENAI_API_KEY=sk-x\n'))).toThrow(
      /VERCEL_AUTOMATION_BYPASS_SECRET/
    );
  });
});
