/**
 * Two origins, and they are deliberately different values.
 *
 * They used to sit in two files with no acknowledgement of each other, which
 * read as drift. It is not: each has one job, and collapsing them into a single
 * constant breaks whichever one loses.
 *
 * `SITE_URL` is the canonical public origin — what `metadataBase` and the Open
 * Graph `url` are built from. It stays production on a preview deployment on
 * purpose: previews are SSO-gated, so an OG image URL pointing at the preview
 * answers a crawler with a login page and renders the link preview broken
 * rather than plain. `public/robots.txt` and `public/sitemap.xml` restate it
 * because neither can import; `test/site-metadata.test.ts` pins that.
 *
 * `selfOrigin()` is the origin the running deployment reaches its *own* API on.
 * A preview must call the preview's `/api/trpc` rather than production's, so it
 * is derived per-deployment, and is empty — relative, whatever origin served
 * the page — in the browser.
 *
 * A change to one is never a change to the other.
 */

/** The canonical public origin. Also in `robots.txt` and `sitemap.xml`. */
export const SITE_URL = 'https://pixel-fortune.vercel.app';

/** The origin this deployment reaches its own API on. */
export function selfOrigin() {
  // browser should use relative path
  if (typeof window !== 'undefined') return '';
  // reference for vercel.com
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // reference for render.com
  if (process.env.RENDER_INTERNAL_HOSTNAME)
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
