import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {normalizeQuery, searchCatalog, readSaved, toggleSaved} from '../dist/homepage-state.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const json = async path => JSON.parse(await read(path));
const html = await read('dist/index.html');
const configMatch = html.match(/<script type="application\/json" id="homepage-data">([\s\S]*?)<\/script>/);
assert.ok(configMatch, 'The generated homepage includes its interaction data');
const config = JSON.parse(configMatch[1]);
const home = await json('data/homepage.json');
const departmentFiles = [
  ['blouses', 'data/blouse-parent.json', 'data/products.json', 'data/collections.json'],
  ['cardigans', 'data/cardigans.json', 'data/cardigan-products.json'],
  ['coats-and-jackets', 'data/outerwear.json', 'data/outerwear-products.json'],
  ['dresses', 'data/dresses.json', 'data/dress-products.json'],
  ['pants', 'data/pants.json', 'data/pants-products.json'],
  ['skirts', 'data/skirts.json', 'data/skirts-products.json'],
  ['sweaters', 'data/sweaters.json', 'data/sweaters-products.json']
];
const departments = await Promise.all(departmentFiles.map(async ([slug, file, productsFile, collectionsFile]) => {
  const data = await json(file);
  return {
    slug,
    parent: collectionsFile ? data : data.parent,
    collections: collectionsFile ? await json(collectionsFile) : data.collections,
    products: await json(productsFile)
  };
}));
const localFile = async href => {
  assert.ok(href.startsWith('/') && !href.startsWith('//'), 'Expected a local destination: ' + href);
  const pathname = new URL(href, 'https://wow.test').pathname;
  const path = 'dist' + pathname + (pathname.endsWith('/') ? 'index.html' : '');
  assert.ok((await stat(new URL('../' + path, import.meta.url))).isFile(), 'Missing built file: ' + href);
};
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('homepage links, campaign media, fonts and interaction modules resolve in the build', async () => {
  const references = new Set([...html.matchAll(/(?:src|href|poster|data-src)="(\/[^"#?]*)"/g)].map(match => match[1]));
  for (const item of config.search) if (item.href.startsWith('/')) references.add(item.href);
  for (const item of config.products) references.add(item.image);
  const css = await read('dist/homepage.css');
  for (const match of css.matchAll(/url\(['"]?(\/[^)'"\s]+)['"]?\)/g)) references.add(match[1]);
  references.add('/homepage-state.js');
  await Promise.all([...references].map(localFile));

  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes('id="' + match[1] + '"'), 'Missing in-page destination: ' + match[1]);
  }
  for (const match of html.matchAll(/data-open="([^"]+)"/g)) {
    assert.ok(html.includes('<dialog id="' + match[1] + '"'), 'Missing dialog: ' + match[1]);
  }
  for (const match of html.matchAll(/<a\b[^>]*href="(https?:[^"\s]+)"/g)) {
    assert.equal(new URL(match[1]).hostname, 'wowfashion.com', 'Unexpected external shopping destination');
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.includes('data-src="/dresses/club-dresses/assets/hero.mp4"'));
  assert.ok(html.includes('poster="/dresses/club-dresses/assets/hero-poster.jpg"'));
});

test('the selected edit uses the eight approved catalogue pieces and their real destinations', async () => {
  assert.deepEqual(config.products.map(product => product.id), [
    'blouses-31', 'cardigans-6', 'dresses-20', 'pants-95',
    'skirts-34', 'sweaters-2', 'dresses-31', 'coats-and-jackets-15'
  ]);
  assert.equal(home.products.length, config.products.length);
  for (const selection of home.products) {
    const department = departments.find(item => item.slug === selection.department);
    const source = department.products.find(item => item.id === selection.id);
    assert.ok(source && !source.url.includes('__trashed'), 'Selected item must be a valid catalogue record');
    const product = config.products.find(item => item.id === `${department.slug}-${source.id}`);
    assert.equal(product.name, source.name);
    assert.equal(product.category, department.parent.name);
    assert.equal(product.group, selection.group);
    assert.ok(['everyday', 'dresses', 'layers'].includes(product.group));
    assert.equal(product.image, `/assets/${department.slug}/${source.id}.webp`);
    assert.ok(html.includes(`data-product-id="${product.id}"`));
    assert.ok(html.includes(`data-save="${product.id}"`));
    assert.ok(html.includes(escape(source.name)));
    assert.ok(!Object.hasOwn(product, 'price'), 'Current prices are provided by the shop');
    if (product.id === 'cardigans-6') {
      assert.equal(product.href, '/products/cotton-button-down-cardigan/');
      const preview = await read('dist' + product.href + 'index.html');
      assert.ok(preview.includes(`href="${source.url}"`), 'The local product preview links to the real source listing');
      assert.ok(preview.includes(source.name));
      assert.ok(preview.includes(product.image));
    } else {
      assert.equal(product.href, source.url);
    }
  }
  assert.doesNotMatch(html, /Example price|wow-test-001|everyday-rib-cardigan|__trashed|(?:[$£€]|&pound;|&euro;)\s*\d/i);
});

test('search covers every built department and subcategory, including both preserved dress pages', async () => {
  const expected = departments.flatMap(department => [
    {name: department.parent.name, href: `/${department.slug}/`},
    ...department.collections.map(collection => ({name: collection.name, href: `/${department.slug}/${collection.slug}/`}))
  ]);
  const indexed = config.search.filter(item => item.type === 'Collection');
  assert.equal(indexed.length, 129);
  assert.equal(new Set(indexed.map(item => item.href)).size, indexed.length);
  assert.deepEqual(indexed.map(({name, href}) => ({name, href})), expected);
  assert.deepEqual(new Set(home.collections.map(item => item.slug)), new Set(departments.map(item => item.slug)));
  for (const collection of expected) {
    await localFile(collection.href);
    assert.ok(searchCatalog(config.search, collection.name).some(item => item.href === collection.href), 'Exact collection search must find ' + collection.href);
  }
  assert.deepEqual(new Set(searchCatalog(config.search, '').map(item => item.href)), new Set(departments.map(item => `/${item.slug}/`)));
  assert.equal(searchCatalog(config.search, 'club dresses')[0].href, '/dresses/club-dresses/');
  assert.equal(config.search.filter(item => item.type === 'Selected piece').length, config.products.length);
  for (const product of config.products) {
    assert.ok(searchCatalog(config.search, product.name).some(item => item.href === product.href && item.type === 'Selected piece'));
  }
});

test('search accepts case, accents, Unicode compatibility forms and punctuation', () => {
  assert.equal(normalizeQuery('  CÁBLÉ—KNIT & ＳＷＥＡＴＥＲＳ  '), 'cable knit sweaters');
  assert.equal(normalizeQuery('Ｃａｆé\t\n１２３'), 'cafe 123');
  assert.equal(normalizeQuery(null), '');
  assert.equal(normalizeQuery(undefined), '');
  assert.equal(normalizeQuery(123), '123');
  assert.equal(normalizeQuery('— & !'), '');
  assert.equal(searchCatalog(config.search, '  CLUB—DRESSES  ')[0].href, '/dresses/club-dresses/');
  assert.ok(searchCatalog(config.search, 'LINÉN').some(item => item.href === '/pants/linen-pants/'));
  assert.ok(searchCatalog(config.search, 'trousers').some(item => item.href === '/pants/'));
  assert.deepEqual(searchCatalog(config.search, 'no-such-collection-987654'), []);
});

test('search ranks exact names first, requires every query term and respects its limit without mutating data', () => {
  const index = [
    {name: 'Cotton layer', keywords: 'linen', href: '/a/', type: 'Collection'},
    {name: 'Ivory linen', keywords: 'relaxed', href: '/b/', type: 'Collection'},
    {name: 'Linen pants', keywords: 'easy', href: '/c/', type: 'Collection'},
    {name: 'Linen', keywords: 'natural', href: '/d/', type: 'Collection'}
  ];
  const original = structuredClone(index);
  assert.deepEqual(searchCatalog(index, 'linen').map(item => item.href), ['/d/', '/c/', '/b/', '/a/']);
  assert.deepEqual(searchCatalog(index, 'linen', 2).map(item => item.href), ['/d/', '/c/']);
  assert.deepEqual(searchCatalog(index, 'pants easy linen').map(item => item.href), ['/c/']);
  assert.deepEqual(searchCatalog(index, 'cotton linen pants'), []);
  assert.deepEqual(index, original);
});

test('saved-piece storage recovers safely from malformed data, removes duplicates and rejects unknown IDs', () => {
  const validIds = config.products.map(product => product.id);
  for (const raw of [null, undefined, '', '{broken', '{}', 'null', 'false', '123', '"blouses-31"']) {
    assert.deepEqual(readSaved(raw, validIds), [], 'Invalid storage should produce an empty shortlist');
  }
  const first = validIds[0];
  const second = validIds[1];
  const stored = [first, 'missing-product', first, 31, null, {}, [second], second, '__proto__'];
  assert.deepEqual(readSaved(JSON.stringify(stored), validIds), [first, second]);
  assert.deepEqual(readSaved(JSON.stringify(validIds), []), []);
  assert.deepEqual(readSaved(JSON.stringify(validIds), validIds), validIds);
});

test('saved-piece toggling adds and removes valid products without mutating input or accepting unknown IDs', () => {
  const validIds = config.products.map(product => product.id);
  const saved = [validIds[1]];
  assert.deepEqual(toggleSaved(saved, validIds[0], validIds), [validIds[0], validIds[1]]);
  assert.deepEqual(toggleSaved(saved, validIds[1], validIds), []);
  assert.deepEqual(toggleSaved(saved, 'missing-product', validIds), saved);
  assert.deepEqual(toggleSaved(saved, null, validIds), saved);
  assert.deepEqual(saved, [validIds[1]]);
  assert.notEqual(toggleSaved(saved, 'missing-product', validIds), saved);
  assert.deepEqual(toggleSaved(toggleSaved([], validIds[0], validIds), validIds[0], validIds), []);
});
