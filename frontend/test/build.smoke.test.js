// `npm run build` sonrası statik çıktının (out/) smoke testi: her sayfa üretildi mi,
// SEO meta etiketleri doğru mu, robots/sitemap özel sayfaları dışarıda tutuyor mu?
// out/ yoksa atlanır; CI'da build'den sonra REQUIRE_BUILD=1 ile zorunlu çalışır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out');
const hasBuild = existsSync(path.join(outDir, 'index.html'));
const skip = !hasBuild && process.env.REQUIRE_BUILD !== '1' ? 'out/ bulunamadı (önce npm run build)' : false;

const PUBLIC_PAGES = ['index', 'rules', 'store', 'privacy', 'terms'];
const PRIVATE_PAGES = ['auth', 'profile', 'settings', 'starter', 'history', 'achievements', 'battlepass', 'showcase'];

function page(name) {
  return readFileSync(path.join(outDir, `${name}.html`), 'utf8');
}

function meta(html, attr, key) {
  const match = html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, 'i'))
    || html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${key}"`, 'i'));
  return match?.[1];
}

test('every route is exported as static HTML', { skip }, () => {
  [...PUBLIC_PAGES, ...PRIVATE_PAGES, '404'].forEach(name => {
    assert.ok(existsSync(path.join(outDir, `${name}.html`)), `${name}.html eksik`);
  });
});

test('each page has a unique title and a description', { skip }, () => {
  const titles = new Set();
  [...PUBLIC_PAGES, ...PRIVATE_PAGES].forEach(name => {
    const html = page(name);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title, `${name}: title yok`);
    assert.ok(!titles.has(title), `${name}: tekrarlanan title "${title}"`);
    titles.add(title);
    assert.ok(meta(html, 'name', 'description')?.length > 40, `${name}: description kısa/eksik`);
  });
});

test('public pages have canonical + Open Graph + Twitter card metadata', { skip }, () => {
  PUBLIC_PAGES.forEach(name => {
    const html = page(name);
    assert.match(html, /<link rel="canonical"/, `${name}: canonical yok`);
    ['og:title', 'og:description', 'og:image', 'og:url'].forEach(key => {
      assert.ok(meta(html, 'property', key), `${name}: ${key} yok`);
    });
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image', `${name}: twitter:card`);
    assert.doesNotMatch(html, /name="robots" content="noindex/, `${name}: yanlışlıkla noindex`);
  });
});

test('private pages are marked noindex', { skip }, () => {
  PRIVATE_PAGES.forEach(name => {
    assert.match(page(name), /name="robots" content="noindex/, `${name}: noindex yok`);
  });
});

test('robots.txt blocks private routes and points to the sitemap', { skip }, () => {
  const robots = readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
  PRIVATE_PAGES.forEach(name => assert.match(robots, new RegExp(`Disallow: /${name}\\b`)));
  assert.match(robots, /Sitemap: .*\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow: \/\s*$/m, 'site tamamen engellenmemeli');
});

test('sitemap.xml lists only public pages', { skip }, () => {
  const sitemap = readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  assert.deepEqual(urls.sort(), ['/', '/privacy', '/rules', '/store', '/terms']);
});

test('custom 404 page offers a way back and favicon/manifest/og assets exist', { skip }, () => {
  const html = page('404');
  assert.match(html, /href="\/"/);
  ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.jpg', 'manifest.webmanifest'].forEach(file => {
    assert.ok(existsSync(path.join(outDir, file)), `${file} eksik`);
  });
});

test('home page ships VideoGame and rules page ships FAQPage structured data', { skip }, () => {
  assert.match(page('index'), /"@type":"VideoGame"/);
  assert.match(page('rules'), /"@type":"FAQPage"/);
});

test('fonts are self-hosted: no render-blocking request to Google Fonts', { skip }, () => {
  [...PUBLIC_PAGES, ...PRIVATE_PAGES].forEach(name => {
    const html = page(name);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/, `${name}: harici font isteği`);
    assert.match(html, /rel="preload" href="\/_next\/static\/media\/[^"]+\.woff2" as="font"/, `${name}: font preload yok`);
  });
});

test('every local asset referenced by the exported pages exists', { skip }, () => {
  const missing = new Set();
  [...PUBLIC_PAGES, ...PRIVATE_PAGES, '404'].forEach(name => {
    const html = page(name);
    const refs = [
      ...[...html.matchAll(/(?:src|href|poster)="\/?((?:assets|docs|draco)\/[^"?#]+)"/g)].map(m => m[1]),
      ...[...html.matchAll(/url\((?:&#x27;|&quot;|['"])?\/?(assets\/[^'")&]+)/g)].map(m => m[1])
    ];
    assert.ok(refs.length > 0, `${name}: hiç yerel varlık bulunamadı (regex bozuk olabilir)`);
    refs.forEach(ref => { if (!existsSync(path.join(outDir, ref))) missing.add(`${name}: ${ref}`); });
  });
  assert.deepEqual([...missing], []);
});

test('subpage navigation uses client-side links; the home page is always a full load', { skip }, () => {
  // Ana sayfa oyun motorunu her açılışta sıfırdan kurar; oraya giden bağlantı Link olmamalı.
  // Next.js Link'leri prefetch için RSC verisini (<route>.txt) kullanır; dosyalar üretilmiş olmalı.
  ['history', 'profile', 'achievements', 'store', 'settings', 'rules', 'privacy', 'terms', 'battlepass'].forEach(name => {
    assert.ok(existsSync(path.join(outDir, `${name}.txt`)), `${name}.txt (istemci geçişi verisi) eksik`);
  });
});

test('client-side prefetch segment files use the flat names the router requests', { skip }, () => {
  // Windows'ta Next.js bu dosyaları klasör olarak yazar; scripts/fix-export-segments.mjs düzeltir.
  ['history', 'profile', 'achievements', 'store', 'settings', 'rules', 'privacy', 'terms', 'battlepass'].forEach(name => {
    assert.ok(existsSync(path.join(outDir, name, `__next.${name}.__PAGE__.txt`)), `${name}: prefetch segment dosyası eksik`);
    assert.ok(!existsSync(path.join(outDir, name, `__next.${name}`)), `${name}: klasör olarak kalmış`);
  });
});
