import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { createSessionHandler } from '../api/session.js';
import { createWorkspaceHandler } from '../api/workspace.js';
import { COOKIE_NAME, SESSION_SECONDS, createSessionToken, verifySessionToken, verifyAccessCode, isAuthenticated, requireSameOrigin, readJson } from '../lib/auth.js';
import { emptyWorkspace, validateWorkspace, validateEtag, validateApprovalTransitions, createWorkspaceStore, WORKSPACE_PATH } from '../lib/workspace.js';

const env = { NODE_ENV: 'production', VERCEL: '1', WORKSPACE_ACCESS_CODE: 'test-only-workspace-code-with-enough-entropy', BLOB_READ_WRITE_TOKEN: 'test-only-blob-token' };
const iso = '2026-11-07T12:00:00.000Z';
const origin = 'https://portal.example.test';

function request(method = 'GET', body, overrides = {}) {
  return { method, body, headers: { host: 'portal.example.test', origin, 'content-type': 'application/json', ...overrides } };
}

function authorised(method = 'GET', body, overrides = {}) {
  return request(method, body, { cookie: `${COOKIE_NAME}=${createSessionToken(env)}`, ...overrides });
}

async function invoke(handler, req) {
  const response = { statusCode: 0, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
  await handler(req, response);
  return response;
}

function memoryBlob(initial = null) {
  let entry = initial && { text: JSON.stringify(initial), etag: 'version-1' };
  let version = initial ? 1 : 0;
  const writes = [];
  const reads = [];
  const blob = {
    async get(path, options) {
      reads.push({ path, options });
      if (!entry) return null;
      const snapshot = { ...entry };
      return { statusCode: 200, stream: new Response(snapshot.text).body, blob: { etag: snapshot.etag, size: Buffer.byteLength(snapshot.text) } };
    },
    async put(path, text, options) {
      writes.push({ path, text, options });
      if (options.allowOverwrite === false && entry) throw new Error('Already exists');
      if (options.ifMatch && options.ifMatch !== entry?.etag) throw new BlobPreconditionFailedError();
      if (entry && !options.ifMatch) throw new Error('Unsafe overwrite attempted');
      entry = { text, etag: `version-${++version}` };
      return { etag: entry.etag };
    },
  };
  return { blob, writes, reads, snapshot: () => entry && { data: JSON.parse(entry.text), etag: entry.etag }, corrupt: text => { entry = { text, etag: 'version-corrupt' }; } };
}

test('session signatures reject tampering, expiration and code rotation', () => {
  const now = Date.parse(iso);
  const token = createSessionToken(env, now);
  assert.equal(verifySessionToken(token, env, now), true);
  assert.equal(verifySessionToken(`${token}x`, env, now), false);
  assert.equal(verifySessionToken(token, env, now + SESSION_SECONDS * 1000), false);
  assert.equal(verifySessionToken(token, { ...env, WORKSPACE_ACCESS_CODE: 'a-different-long-workspace-access-code' }, now), false);
  assert.equal(verifySessionToken(token, {}, now), false);
  assert.equal(verifyAccessCode(env.WORKSPACE_ACCESS_CODE, env), true);
  assert.equal(verifyAccessCode('incorrect', env), false);
});

test('cookies are unambiguous and no environment bypass grants access', () => {
  const token = createSessionToken(env);
  assert.equal(isAuthenticated(request('GET', undefined, { cookie: `${COOKIE_NAME}=${token}` }), env), true);
  assert.equal(isAuthenticated(request('GET', undefined, { cookie: `${COOKIE_NAME}=${token}; ${COOKIE_NAME}=${token}` }), env), false);
  assert.equal(isAuthenticated(request(), { NODE_ENV: 'development' }), false);
});

test('session endpoint requires same origin and issues a secure seven-day cookie', async () => {
  const handler = createSessionHandler({ env });
  const initial = await invoke(handler, request());
  assert.deepEqual(initial.body, { authenticated: false, configured: true });
  const badOrigin = await invoke(handler, request('POST', { code: env.WORKSPACE_ACCESS_CODE }, { origin: 'https://other.example.test' }));
  assert.equal(badOrigin.statusCode, 403);
  assert.equal(badOrigin.headers['Set-Cookie'], undefined);
  const incorrect = await invoke(handler, request('POST', { code: 'incorrect' }));
  assert.equal(incorrect.statusCode, 401);
  const login = await invoke(handler, request('POST', { code: env.WORKSPACE_ACCESS_CODE }));
  assert.equal(login.statusCode, 200);
  assert.deepEqual(login.body, { authenticated: true, configured: true });
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', `Max-Age=${SESSION_SECONDS}`]) assert.ok(login.headers['Set-Cookie'].includes(flag));
  assert.match(login.headers['Cache-Control'], /no-store/);
  const logout = await invoke(handler, request('DELETE'));
  assert.equal(logout.body.authenticated, false);
  assert.ok(logout.headers['Set-Cookie'].includes('Max-Age=0'));
  const unconfigured = await invoke(createSessionHandler({ env: {} }), request());
  assert.deepEqual(unconfigured.body, { authenticated: false, configured: false });
});

test('origin and JSON request validation blocks malformed and cross-origin writes', async () => {
  assert.throws(() => requireSameOrigin(request('PUT', {}, { origin: undefined }), env), { status: 403 });
  assert.throws(() => requireSameOrigin(request('PUT', {}, { origin: 'http://portal.example.test' }), env), { status: 403 });
  assert.throws(() => requireSameOrigin(request('PUT', {}, { 'sec-fetch-site': 'cross-site' }), env), { status: 403 });
  assert.doesNotThrow(() => requireSameOrigin(request('PUT'), env));
  await assert.rejects(readJson(request('PUT', '{}', { 'content-type': 'text/plain' })), { status: 415 });
  await assert.rejects(readJson(request('PUT', '{bad json')), { status: 400 });
  await assert.rejects(readJson(request('PUT', { large: 'x'.repeat(20) }), 10), { status: 413 });
  assert.deepEqual(await readJson(request('PUT', '{"valid":true}')), { valid: true });
});

test('workspace endpoint protects all private data before invoking storage', async () => {
  let touched = false;
  const store = { read: async () => { touched = true; }, write: async () => { touched = true; } };
  const handler = createWorkspaceHandler({ env, store });
  const anonymous = await invoke(handler, request());
  assert.equal(anonymous.statusCode, 401);
  assert.equal(touched, false);
  const foreign = await invoke(handler, authorised('PUT', { data: emptyWorkspace(), etag: 'version-1' }, { origin: 'https://attacker.example.test' }));
  assert.equal(foreign.statusCode, 403);
  assert.equal(touched, false);
  const extra = await invoke(handler, authorised('PUT', { data: emptyWorkspace(), etag: 'version-1', unexpected: true }));
  assert.equal(extra.statusCode, 400);
  assert.equal(touched, false);
});

test('workspace validation accepts the frontend record contract', () => {
  const data = emptyWorkspace(iso);
  data.products.push({ id: 'p-1', name: 'Linen dress', sourceUrl: 'https://www.aliexpress.com/item/123.html', categoryId: 'dresses', supplierId: 's-1', rating: 4.7, reviews: 143, sold: 1200, recentReviewScore: 4, sellerScore: 4, specificationScore: 4, valueScore: 3, deliveryScore: 3, evidenceDate: '2026-11-07', destination: 'United Kingdom', price: 20, shipping: 3, currency: 'GBP', hardGate: 'clear', gateNotes: 'Size chart checked.', notes: 'Evidence recorded.', status: 'Researching', createdAt: iso, updatedAt: iso });
  data.suppliers.push({ id: 's-1', name: 'Example seller', url: 'https://www.aliexpress.com/store/123', type: 'Marketplace seller', country: 'China', status: 'Researching', categories: 'Dresses', storeSince: '2020', rating: 4.8, contact: 'Store messaging', evidenceUrl: 'https://www.aliexpress.com/store/123', checkedAt: '2026-11-07', notes: '', sampleStatus: 'Not requested', manufacturingEvidence: '', createdAt: iso, updatedAt: iso });
  data.pagePlans.dresses = { status: 'Draft', priority: 'High', owner: '', targetProducts: 12, proposedUrl: '/dresses/', keyword: 'dresses', notes: '', updatedAt: iso };
  data.promptOverrides.category = { body: 'Write from verified evidence.', updatedAt: iso };
  data.promptOverrides.product = 'Describe this product.';
  data.roadmap.research = true;
  data.activity.push({ id: 'a-1', text: 'Saved a product', date: iso });
  assert.equal(validateWorkspace(data), data);
});

test('workspace validation rejects unknown keys, unsafe links and invalid evidence', () => {
  const cases = [
    data => { data.extra = true; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', unknown: true }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', sourceUrl: 'javascript:alert(1)' }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', sourceUrl: 'https://user:password@example.com/' }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', rating: 8 }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', rating: '4.8' }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', sellerScore: 6 }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', reviews: -1 }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', price: -2 }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress' }, { id: 'p-1', name: 'Another' }]; },
    data => { data.products = [{ id: 'p-1', name: 'Dress', status: 'Approved', hardGate: 'review', evidenceDate: '2026-11-07', notes: 'Not checked yet' }]; },
    data => { data.suppliers = [{ id: 's-1', name: 'Seller', type: 'Manufacturer verified', manufacturingEvidence: '' }]; },
    data => { data.roadmap.research = 'done'; },
    data => { data.promptOverrides.category = 'x'.repeat(100001); },
    data => { data.settings.currency = 'Pounds'; },
  ];
  for (const change of cases) {
    const data = emptyWorkspace(iso);
    change(data);
    assert.throws(() => validateWorkspace(data), { status: 400 });
  }
  const poisoned = emptyWorkspace(iso);
  poisoned.pagePlans = JSON.parse('{"__proto__":{"status":"done"}}');
  assert.throws(() => validateWorkspace(poisoned), { status: 400 });
  for (const etag of [null, '', '*', 'one,two', 'W/"weak-tag"', '"one","two"', 'unsafe\r\nheader', '"unsafe\r\nheader"']) assert.throws(() => validateEtag(etag), { status: 400 });
  assert.equal(validateEtag('"opaque+/=value"'), '"opaque+/=value"');
});

test('concurrent first reads create once without an unconditional overwrite', async () => {
  const memory = memoryBlob();
  const store = createWorkspaceStore({ env, blob: memory.blob, now: () => iso });
  const [first, second] = await Promise.all([store.read(), store.read()]);
  assert.deepEqual(first, second);
  assert.equal(first.data.revision, 0);
  assert.equal(memory.snapshot().data.revision, 0);
  for (const write of memory.writes) {
    assert.equal(write.path, WORKSPACE_PATH);
    assert.equal(write.options.allowOverwrite, false);
    assert.equal(write.options.addRandomSuffix, false);
    assert.equal(write.options.access, 'private');
  }
  for (const read of memory.reads) {
    assert.equal(read.options.useCache, false);
    assert.equal(read.options.access, 'private');
    assert.deepEqual(read.options.headers, { 'Accept-Encoding': 'identity' });
  }
});

test('verified manufacturer imports require evidence notes, a valid URL and check date', () => {
  const supplier = { id: 's-manufacturer', name: 'Verified workshop', type: 'Manufacturer verified', manufacturingEvidence: 'Factory registration and sample production reviewed.', evidenceUrl: 'https://example.com/factory-evidence', checkedAt: '2026-11-07' };
  const complete = { ...emptyWorkspace(iso), suppliers: [supplier] };
  assert.doesNotThrow(() => validateWorkspace(complete));
  for (const change of [
    { manufacturingEvidence: '' },
    { evidenceUrl: '' },
    { evidenceUrl: 'javascript:alert(1)' },
    { checkedAt: '' },
    { checkedAt: 'not a date' },
    { checkedAt: '2026-02-31' },
  ]) {
    const imported = { ...emptyWorkspace(iso), suppliers: [{ ...supplier, ...change }] };
    assert.throws(() => validateWorkspace(imported), { status: 400, code: 'invalid_workspace' });
  }
});

test('successful writes increment revision and use the supplied ETag in Blob CAS', async () => {
  const memory = memoryBlob(emptyWorkspace(iso));
  const store = createWorkspaceStore({ env, blob: memory.blob, now: () => '2026-11-07T13:00:00.000Z' });
  const initial = await store.read();
  initial.data.roadmap.research = true;
  const saved = await store.write(initial.data, initial.etag);
  assert.equal(saved.data.revision, 1);
  assert.equal(saved.data.updatedAt, '2026-11-07T13:00:00.000Z');
  assert.equal(saved.data.roadmap.research, true);
  assert.notEqual(saved.etag, initial.etag);
  assert.equal(memory.writes.at(-1).options.ifMatch, initial.etag);
  assert.equal(memory.writes.at(-1).options.allowOverwrite, true);
});

test('stale versions are rejected without any write', async () => {
  const memory = memoryBlob(emptyWorkspace(iso));
  const store = createWorkspaceStore({ env, blob: memory.blob });
  const initial = await store.read();
  await assert.rejects(store.write(initial.data, 'stale-version'), { status: 409, code: 'workspace_conflict' });
  await assert.rejects(store.write({ ...initial.data, revision: 99 }, initial.etag), { status: 409 });
  await assert.rejects(store.write(initial.data, '*'), { status: 400 });
  assert.equal(memory.writes.length, 0);
});

test('two writers with the same version cannot lose each other’s changes', async () => {
  const memory = memoryBlob(emptyWorkspace(iso));
  const store = createWorkspaceStore({ env, blob: memory.blob, now: () => iso });
  const initial = await store.read();
  const first = structuredClone(initial.data);
  const second = structuredClone(initial.data);
  first.roadmap.first = true;
  second.roadmap.second = true;
  const results = await Promise.allSettled([store.write(first, initial.etag), store.write(second, initial.etag)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  const saved = memory.snapshot();
  assert.equal(saved.data.revision, 1);
  assert.equal(Object.keys(saved.data.roadmap).length, 1);
  for (const write of memory.writes) assert.equal(write.options.ifMatch, initial.etag);
});

test('corrupt stored data is never silently reset or overwritten', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const memory = memoryBlob(emptyWorkspace(iso));
  memory.corrupt('{not valid json');
  const store = createWorkspaceStore({ env, blob: memory.blob });
  await assert.rejects(store.read(), { status: 503, code: 'stored_data_invalid' });
  assert.equal(memory.writes.length, 0);
  const diagnostic = JSON.parse(log.mock.calls[0].arguments[1]);
  assert.equal(diagnostic.stage, 'json');
  assert.equal(diagnostic.errorName, 'SyntaxError');
  assert.ok(!JSON.stringify(log.mock.calls[0].arguments).includes('{not valid json'));
});

test('read diagnostics identify an unsupported ETag without logging tag or content', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const data = emptyWorkspace(iso);
  data.settings.market = 'PRIVATE_MARKER_DO_NOT_LOG';
  const tag = 'W/"PRIVATE_ETAG_DO_NOT_LOG"';
  const blob = { async get() { return { statusCode: 200, stream: new Response(JSON.stringify(data)).body, headers: new Headers({ 'content-encoding': 'gzip' }), blob: { etag: tag, size: 100 } }; } };
  const store = createWorkspaceStore({ env, blob });
  await assert.rejects(store.read(), { status: 503, code: 'stored_data_invalid' });
  const diagnostic = JSON.parse(log.mock.calls[0].arguments[1]);
  assert.equal(diagnostic.stage, 'etag');
  assert.equal(diagnostic.errorCode, 'etag_required');
  assert.equal(diagnostic.etagFormat, 'weak-quoted');
  assert.equal(diagnostic.contentEncoding, 'gzip');
  const emitted = JSON.stringify(log.mock.calls[0].arguments);
  assert.ok(!emitted.includes('PRIVATE_'));
  assert.ok(!emitted.includes(env.BLOB_READ_WRITE_TOKEN));
});

test('approval uses the shared rubric and stale historical approvals remain readable', async () => {
  const previous = emptyWorkspace(iso);
  const product = { id: 'p-1', name: 'Checked dress', rating: 4.9, reviews: 1000, sold: 5000, recentReviewScore: 5, sellerScore: 5, specificationScore: 5, valueScore: 5, deliveryScore: 5, evidenceDate: '2026-11-07', destination: 'United Kingdom', sourceUrl: 'https://www.aliexpress.com/item/123.html', price: 20, shipping: 3, currency: 'GBP', hardGate: 'clear', gateNotes: 'Listing evidence recorded; sample reviewed.', notes: 'Human review complete.', status: 'Approved' };
  const next = { ...previous, products: [product] };
  assert.doesNotThrow(() => validateWorkspace(next));
  assert.doesNotThrow(() => validateApprovalTransitions(next, previous, iso));
  assert.throws(() => validateApprovalTransitions({ ...next, products: [{ ...product, reviews: 2 }] }, previous, iso), { code: 'approval_evidence_required' });
  assert.throws(() => validateApprovalTransitions(next, previous, '2026-12-01'), { code: 'approval_evidence_required' });
  const memory = memoryBlob(next);
  const store = createWorkspaceStore({ env, blob: memory.blob, now: () => '2026-12-01T12:00:00.000Z' });
  const historical = await store.read();
  historical.data.roadmap.otherWork = true;
  const saved = await store.write(historical.data, historical.etag);
  assert.equal(saved.data.products[0].status, 'Approved');
  assert.equal(saved.data.roadmap.otherWork, true);
  const edited = structuredClone(saved.data);
  edited.products[0].notes = 'Changed an approved record without refreshing evidence';
  await assert.rejects(store.write(edited, saved.etag), { code: 'approval_evidence_required' });
});

test('workspace API returns data and ETag and exposes conflict without secrets', async () => {
  const memory = memoryBlob(emptyWorkspace(iso));
  const store = createWorkspaceStore({ env, blob: memory.blob, now: () => iso });
  const handler = createWorkspaceHandler({ env, store });
  const read = await invoke(handler, authorised());
  assert.equal(read.statusCode, 200);
  assert.deepEqual(Object.keys(read.body).sort(), ['data', 'etag']);
  const saved = await invoke(handler, authorised('PUT', read.body));
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.data.revision, 1);
  const stale = await invoke(handler, authorised('PUT', read.body));
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.code, 'workspace_conflict');
  assert.ok(!JSON.stringify(stale.body).includes(env.BLOB_READ_WRITE_TOKEN));
});


test('page build flags and preview URL survive validation alongside legacy plans', () => {
 const data=emptyWorkspace(iso);data.pagePlans['editorial-46521']={status:'Drafting',pageBuilt:'Yes',animatedHeader:'No',previewUrl:'https://wow-fashion-new-website.vercel.app/blouses/'};
 assert.doesNotThrow(()=>validateWorkspace(data));
 data.pagePlans['editorial-46521'].pageBuilt='Maybe';assert.throws(()=>validateWorkspace(data));
 data.pagePlans['editorial-46521'].pageBuilt='Yes';data.pagePlans['editorial-46521'].previewUrl='javascript:alert(1)';assert.throws(()=>validateWorkspace(data));
 data.pagePlans['editorial-46521']={status:'Drafting',notes:'Existing shared plan'};assert.doesNotThrow(()=>validateWorkspace(data));
});
