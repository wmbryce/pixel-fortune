/**
 * The deployed origin is written down in three places — `SITE_URL` in
 * `src/app/layout.tsx`, `public/robots.txt` and `public/sitemap.xml` — and a
 * domain change is all three or none. Nothing else can catch a partial one:
 * the app renders identically with a stale origin in the sitemap.
 *
 * The other half is the OG image. `metadataBase` is what makes the emitted
 * image URL absolute, and a tag pointing at a file that isn't there renders
 * link previews broken rather than plain, so the file and its declared
 * dimensions are pinned against the metadata that advertises them.
 *
 * Read as source rather than imported: `layout.tsx` pulls `next/font/google`,
 * which only resolves inside a Next build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const layout = read('src/app/layout.tsx');
const robots = read('public/robots.txt');
const sitemap = read('public/sitemap.xml');

const siteUrl = /const SITE_URL = '([^']+)'/.exec(layout)?.[1];
const ogImage = /images: \[\s*\{\s*url: '([^']+)'/.exec(layout)?.[1];

describe('the deployed origin', () => {
  it('is declared in layout.tsx and is an absolute https origin', () => {
    expect(siteUrl).toBeDefined();
    const url = new URL(siteUrl!);
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe('/');
  });

  it('is what metadataBase is built from, so image URLs are absolute', () => {
    expect(layout).toContain('metadataBase: new URL(SITE_URL)');
    expect(new URL(ogImage!, siteUrl).href).toBe(`${siteUrl}${ogImage}`);
  });

  it('is the origin robots.txt points its sitemap at', () => {
    expect(robots).toContain(`Sitemap: ${siteUrl}/sitemap.xml`);
  });

  it('is the origin every sitemap <loc> uses', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) expect(new URL(loc).origin).toBe(siteUrl);
  });
});

describe('the sitemap', () => {
  it('uses the real sitemaps.org namespace', () => {
    expect(sitemap).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
  });

  it('lists no path that only redirects', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      m => new URL(m[1]).pathname
    );
    expect(locs).not.toContain('/');
  });
});

describe('the OG image', () => {
  it('is a real file behind the tag, at the dimensions declared', () => {
    const png = readFileSync(path.join(root, 'public', ogImage!));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    // IHDR: width and height are the two big-endian words after the chunk name.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(layout).toContain('width: 1200');
    expect(layout).toContain('height: 630');
  });

  it('is what the twitter card points at too', () => {
    expect(layout).toContain(`images: ['${ogImage}']`);
    expect(layout).toContain("card: 'summary_large_image'");
  });
});
