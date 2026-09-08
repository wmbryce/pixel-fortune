// Reach a protected Vercel preview deployment without handling the bypass
// secret by hand. Read docs/preview-access.md first — it covers what the secret
// is, what it exposes, and the dashboard steps that must happen before any of
// this works.
//
//   npm run preview -- fetch https://pixel-fortune-<hash>-dpoch.vercel.app/api/status
//   npm run preview -- open  https://pixel-fortune-<hash>-dpoch.vercel.app/tarot
//
// `fetch` sends the secret as a header, which keeps it out of URLs and the logs
// that record them. `open` cannot: chrome-devtools-axi has no way to attach a
// header to a navigation, so the secret goes in the query string of the first
// request, along with the cookie flag that spares every request after it.
//
// The secret comes from VERCEL_AUTOMATION_BYPASS_SECRET, or from `.env.local`,
// which is gitignored. It is never printed.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SECRET_KEY = 'VERCEL_AUTOMATION_BYPASS_SECRET';
const BYPASS_PARAM = 'x-vercel-protection-bypass';
const COOKIE_PARAM = 'x-vercel-set-bypass-cookie';

/**
 * The secret is a key to every protected deployment in the project, so it is
 * only ever sent to this project's own hosts: production, and previews of the
 * shape `pixel-fortune-<hash>-dpoch.vercel.app`. Anyone can deploy under
 * `.vercel.app`, so a bare suffix test would hand a URL pasted from a PR
 * comment or a CI log the secret in full.
 *
 * Renaming the project or moving it to a custom domain means updating these,
 * and until then the helper refuses — loud and safe. Do not widen them back to
 * a suffix to make a rename go quietly.
 */
const PRODUCTION_HOST = 'pixel-fortune.vercel.app';
const PREVIEW_HOST = /^pixel-fortune-[a-z0-9-]+-dpoch\.vercel\.app$/;
const ACCEPTED_HOSTS = `${PRODUCTION_HOST} or pixel-fortune-<hash>-dpoch.vercel.app`;

/**
 * The URL to navigate a browser to first. Both parameters are load-bearing:
 * without the cookie one, the bypass covers this request and nothing the page
 * does afterwards — a click inside the page carries neither our header nor our
 * query string, and lands back on the SSO redirect.
 */
export function primePreviewUrl(rawUrl, secret) {
  const url = requireVercelUrl(rawUrl);
  url.searchParams.set(BYPASS_PARAM, secret);
  url.searchParams.set(COOKIE_PARAM, 'true');
  return url.toString();
}

/** Rejects anything that is not an https deployment of this project. */
export function requireVercelUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Not a URL: ${rawUrl}`);
  }
  const isOwnHost =
    url.hostname === PRODUCTION_HOST || PREVIEW_HOST.test(url.hostname);
  if (url.protocol !== 'https:' || !isOwnHost) {
    throw new Error(
      `Refusing to send the bypass secret to ${url.origin} — it is a key to ` +
        `every protected deployment in the project, so it only goes over ` +
        `https to ${ACCEPTED_HOSTS}. If the project was renamed, update the ` +
        `hosts in scripts/preview.mjs.`
    );
  }
  return url;
}

/**
 * Env first, then `.env.local`. Absent is fatal, and says what to do about it.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [envFile]
 */
export function readSecret(env = process.env, envFile = '.env.local') {
  const fromEnv = env[SECRET_KEY]?.trim();
  if (fromEnv) return fromEnv;

  const fromFile = readEnvFile(envFile)[SECRET_KEY];
  if (fromFile) return fromFile;

  throw new Error(
    `${SECRET_KEY} is not set. Put it in ${envFile} (gitignored) or the ` +
      `environment. It has to be created in the Vercel dashboard first — ` +
      `docs/preview-access.md has the steps.`
  );
}

/** Enough of dotenv for one quoted-or-bare `KEY=value` per line. */
function readEnvFile(path) {
  let contents;
  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
  const parsed = {};
  for (const line of contents.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    parsed[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return parsed;
}

async function runFetch(rawUrl, secret) {
  const url = requireVercelUrl(rawUrl);
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { [BYPASS_PARAM]: secret },
  });
  console.log(`${response.status} ${response.statusText}`);
  for (const name of ['location', 'content-type']) {
    const value = response.headers.get(name);
    if (value) console.log(`${name}: ${value}`);
  }
  console.log('');
  console.log(await response.text());
  // A redirect to the SSO gate means the secret did not work; say so loudly
  // rather than leaving a 302 to be read as success.
  const gated = response.headers.get('location')?.includes('/sso-api');
  if (gated) {
    console.error(
      `\nStill gated: the ${BYPASS_PARAM} value was not accepted. See the ` +
        `"Verifying" section of docs/preview-access.md.`
    );
    process.exitCode = 1;
  }
}

function runOpen(rawUrl, secret) {
  const primed = primePreviewUrl(rawUrl, secret);
  // The secret reaches the child through argv, never through this process's
  // stdout, so it stays out of the transcript that drives the browser.
  const child = spawn('chrome-devtools-axi', ['open', primed], {
    stdio: 'inherit',
  });
  child.on('error', error => {
    console.error(`Could not run chrome-devtools-axi: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', code => {
    process.exitCode = code ?? 1;
  });
}

const USAGE = `usage:
  npm run preview -- fetch <deployment-url>   request it with the bypass header
  npm run preview -- open  <deployment-url>   drive it in chrome-devtools-axi`;

async function main(argv) {
  const [command, rawUrl] = argv;
  if (!command || !rawUrl) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (command !== 'fetch' && command !== 'open') {
    console.error(`Unknown command: ${command}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  const secret = readSecret();
  if (command === 'fetch') return runFetch(rawUrl, secret);
  return runOpen(rawUrl, secret);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
