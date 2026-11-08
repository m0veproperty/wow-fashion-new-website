import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { HttpError } from './auth.js';
import { scoreProduct } from '../public/scoring.js';

export const WORKSPACE_PATH = 'wow-fashion/workspace-v1.json';
export const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024;
const ROOT_KEYS = ['schemaVersion', 'revision', 'updatedAt', 'products', 'suppliers', 'pagePlans', 'promptOverrides', 'roadmap', 'settings', 'activity'];
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const PRODUCT_KEYS = ['id', 'name', 'sourceUrl', 'categoryId', 'supplierId', 'rating', 'reviews', 'sold', 'recentReviewScore', 'sellerScore', 'specificationScore', 'valueScore', 'deliveryScore', 'evidenceDate', 'destination', 'price', 'shipping', 'currency', 'hardGate', 'gateNotes', 'notes', 'status', 'createdAt', 'updatedAt', 'categoryIds', 'keywordTargets', 'variants'];
const SUPPLIER_KEYS = ['id', 'name', 'url', 'type', 'country', 'status', 'categories', 'storeSince', 'rating', 'contact', 'evidenceUrl', 'checkedAt', 'notes', 'sampleStatus', 'manufacturingEvidence', 'createdAt', 'updatedAt', 'leadTime', 'shippingDestinations', 'orderTerms', 'returnsPolicy'];
const PRODUCT_NUMBERS = ['rating', 'reviews', 'sold', 'recentReviewScore', 'sellerScore', 'specificationScore', 'valueScore', 'deliveryScore', 'price', 'shipping'];
const PRODUCT_STATUSES = ['Researching', 'Shortlisted', 'Sample requested', 'Approved', 'Rejected'];
const SUPPLIER_STATUSES = ['Researching', 'Contacted', 'Sample requested', 'Approved', 'Paused', 'Rejected'];

function invalid(message) { throw new HttpError(400, 'invalid_workspace', message); }
function isRecord(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)); }
function validCheckDate(value) {
  if (typeof value !== 'string' || (!/^\d{4}-\d{2}-\d{2}$/.test(value) && !validDate(value))) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}

export function emptyWorkspace(now = new Date().toISOString()) {
  return { schemaVersion: 1, revision: 0, updatedAt: now, products: [], suppliers: [], pagePlans: {}, promptOverrides: {}, roadmap: {}, settings: { businessModel: 'undecided', market: 'United Kingdom', currency: 'GBP' }, activity: [] };
}

function validateUrl(value, path, allowRelative = false) {
  if (value === '' || value === null) return;
  if (typeof value !== 'string' || value.length > 4096) invalid(`${path} must contain a valid web URL.`);
  if (allowRelative && /^\/(?!\/)[^\\\u0000-\u0020]*$/.test(value)) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
  } catch { invalid(`${path} must contain an http or https URL.`); }
}

function validateJson(value, path, depth = 0, field = '') {
  if (depth > 8) invalid('Workspace records are nested too deeply.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) invalid(`${path} must contain a finite number.`);
    if (/(?:^|_)(?:rating)$/i.test(field) && (value < 0 || value > 5)) invalid(`${path} must be between 0 and 5.`);
    if (/^(?:orders|sold|sales|reviews|reviewCount|orderCount|salesCount|soldCount|productTarget|targetProducts|target|count|moq)$/i.test(field) && (!Number.isSafeInteger(value) || value < 0)) invalid(`${path} must be a non-negative whole number.`);
    if (/^(?:price|shipping|shippingCost|shippingPrice|cost|landedCost|totalCost|unitPrice|minPrice|maxPrice)$/i.test(field) && value < 0) invalid(`${path} cannot be negative.`);
    if (/(?:Score|score)$/.test(field) && (!Number.isInteger(value) || value < 0 || value > 5)) invalid(`${path} must be a whole-number evidence grade from 0 to 5.`);
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 100000) invalid(`${path} is too long.`);
    if (/(?:url|link|website)$/i.test(field)) validateUrl(value, path, field === 'proposedUrl');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 5000) invalid(`${path} contains too many items.`);
    for (let i = 0; i < value.length; i++) validateJson(value[i], `${path}[${i}]`, depth + 1, field);
    return;
  }
  if (!isRecord(value)) invalid(`${path} must contain JSON data.`);
  const entries = Object.entries(value);
  if (entries.length > 2000) invalid(`${path} contains too many fields.`);
  for (const [key, item] of entries) {
    if (FORBIDDEN_KEYS.has(key) || !key || key.length > 200 || /[\u0000-\u001f\u007f]/.test(key)) invalid(`${path} contains an invalid field name.`);
    validateJson(item, `${path}.${key}`, depth + 1, key);
  }
}

function allowedKeys(record, keys, path) {
  if (!isRecord(record) || Object.keys(record).some(key => !keys.includes(key))) invalid(`${path} contains an unsupported field.`);
}

function validateFields(record, keys, numeric, path) {
  allowedKeys(record, keys, path);
  for (const [key, value] of Object.entries(record)) {
    if (numeric.includes(key)) {
      if (value !== null && typeof value !== 'number') invalid(`${path}.${key} must be a number or empty.`);
    } else if (typeof value !== 'string') invalid(`${path}.${key} must contain text.`);
  }
}

function validateRecords(records, name, limit) {
  if (!Array.isArray(records) || records.length > limit) invalid(`${name} must be an array with at most ${limit} records.`);
  const ids = new Set();
  for (const record of records) {
    if (!isRecord(record) || typeof record.id !== 'string' || !ID_PATTERN.test(record.id)) invalid(`Every ${name} record needs a valid ID.`);
    if (ids.has(record.id)) invalid(`${name} contains a duplicate ID.`);
    ids.add(record.id);
    if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 300) invalid(`Every ${name} record needs a name of no more than 300 characters.`);
    const product = name === 'products';
    if (product) {
      allowedKeys(record, PRODUCT_KEYS, name);
      const { categoryIds, keywordTargets, variants, ...legacy } = record;
      validateFields(legacy, PRODUCT_KEYS, PRODUCT_NUMBERS, name);
      if (categoryIds !== undefined && (!Array.isArray(categoryIds) || categoryIds.length > 250 || categoryIds.some(id => typeof id !== 'string' || !ID_PATTERN.test(id)) || new Set(categoryIds).size !== categoryIds.length)) invalid('Product categories must contain unique valid category IDs.');
      if (keywordTargets !== undefined) {
        if (!Array.isArray(keywordTargets) || keywordTargets.length > 100) invalid('Choose at most 100 keyword-led pages per product.');
        const seen = new Set();
        for (const target of keywordTargets) {
          validateFields(target, ['slug', 'keyword', 'categoryId'], [], 'Keyword page');
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.slug || '') || target.slug.length > 300 || !target.keyword?.trim() || target.keyword.length > 300 || !ID_PATTERN.test(target.categoryId || '') || seen.has(target.slug)) invalid('Keyword page mappings must be unique and include a keyword, slug and parent category.');
          seen.add(target.slug);
        }
      }
      if (variants !== undefined) {
        if (!Array.isArray(variants) || variants.length > 250) invalid('A product can contain at most 250 variation combinations.');
        const ids = new Set();
        for (const variant of variants) {
          validateFields(variant, ['id', 'colour', 'style', 'size', 'option', 'sku', 'price', 'availability'], ['price'], 'Variation');
          if (!ID_PATTERN.test(variant.id || '') || ids.has(variant.id)) invalid('Every variation needs a unique valid ID.');
          ids.add(variant.id);
          for (const key of ['colour','style','size','option','sku']) if (variant[key] !== undefined && variant[key].length > 200) invalid('Variation descriptions must be at most 200 characters.');
          if (![variant.colour,variant.style,variant.size,variant.option,variant.sku].some(x=>x?.trim())) invalid('Describe each variation using colour, style, size, another option or SKU.');
          if (variant.price !== undefined && variant.price !== null && (variant.price < 0 || !Number.isFinite(variant.price))) invalid('Variation prices must be non-negative numbers or unknown.');
          if (variant.availability !== undefined && !['Unknown','Available','Out of stock','Discontinued'].includes(variant.availability)) invalid('Variation availability is invalid.');
        }
      }
    } else validateFields(record, SUPPLIER_KEYS, ['rating'], name);
    if (record.status !== undefined && !(product ? PRODUCT_STATUSES : SUPPLIER_STATUSES).includes(record.status)) invalid(`${name} has an unsupported status.`);
    if (product && record.hardGate !== undefined && !['clear', 'review', 'reject'].includes(record.hardGate)) invalid('Product review status is invalid.');
    if (!product && record.type !== undefined && !['Marketplace seller', 'Brand', 'Wholesaler', 'Manufacturer claimed', 'Manufacturer verified'].includes(record.type)) invalid('Supplier type is invalid.');
    if (!product && record.sampleStatus !== undefined && !['Not requested', 'Requested', 'Received', 'Passed', 'Failed'].includes(record.sampleStatus)) invalid('Supplier sample status is invalid.');
    if (record.status === 'Approved') {
      const date = product ? record.evidenceDate : record.checkedAt;
      if (!date || !Number.isFinite(Date.parse(date)) || !(record.notes?.trim() || record.gateNotes?.trim())) invalid(`Approved ${name} need dated evidence and review notes.`);
      if (product && record.hardGate !== 'clear') invalid('An approved product must pass the evidence checks.');
    }
    if (!product && record.type === 'Manufacturer verified') {
      if (!record.manufacturingEvidence?.trim() || !record.evidenceUrl?.trim() || !validCheckDate(record.checkedAt)) invalid('Verified manufacturers need manufacturing evidence, a source URL and a valid check date.');
      validateUrl(record.evidenceUrl, 'Supplier manufacturing evidence');
    }
  }
}

export function validateWorkspace(data) {
  if (!isRecord(data) || Object.keys(data).length !== ROOT_KEYS.length || ROOT_KEYS.some(key => !Object.hasOwn(data, key)) || Object.keys(data).some(key => !ROOT_KEYS.includes(key))) invalid('The workspace has an unsupported structure.');
  if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !validDate(data.updatedAt)) invalid('The workspace version, revision or updated date is invalid.');
  validateRecords(data.products, 'products', 5000);
  validateRecords(data.suppliers, 'suppliers', 2000);
  for (const key of ['pagePlans', 'promptOverrides', 'roadmap', 'settings']) if (!isRecord(data[key])) invalid(`${key} must contain an object.`);
  if (!Array.isArray(data.activity) || data.activity.length > 500) invalid('Activity must contain at most 500 entries.');
  for (const [id, prompt] of Object.entries(data.promptOverrides)) {
    if (!ID_PATTERN.test(id)) invalid('Prompt overrides need valid IDs.');
    if (typeof prompt === 'string') {
      if (prompt.length > 100000) invalid('A prompt override is too long.');
    } else {
      allowedKeys(prompt, ['body', 'updatedAt'], 'Prompt override');
      if (typeof prompt.body !== 'string' || prompt.body.length > 100000 || !validDate(prompt.updatedAt)) invalid('Prompt overrides need body text and an updated date.');
    }
  }
  for (const [id, plan] of Object.entries(data.pagePlans)) {
    if (!ID_PATTERN.test(id)) invalid('Page plans need valid page IDs.');
    validateFields(plan, ['status', 'priority', 'owner', 'targetProducts', 'proposedUrl', 'keyword', 'notes', 'updatedAt', 'pageBuilt', 'animatedHeader', 'previewUrl'], ['targetProducts'], 'Page plan');
    for (const field of ['pageBuilt', 'animatedHeader']) if (plan[field] !== undefined && !['Yes', 'No'].includes(plan[field])) invalid('Page build flags must be Yes or No.');
  }
  for (const [id, done] of Object.entries(data.roadmap)) if (!ID_PATTERN.test(id) || typeof done !== 'boolean') invalid('Roadmap entries need a valid ID and a completion value.');
  for (const entry of data.activity) {
    validateFields(entry, ['id', 'text', 'date'], [], 'Activity');
    if (!ID_PATTERN.test(entry.id || '') || typeof entry.text !== 'string' || !validDate(entry.date)) invalid('Activity entries need an ID, text and date.');
  }
  const settings = data.settings;
  allowedKeys(settings, ['businessModel', 'market', 'currency'], 'Settings');
  if (typeof settings.businessModel !== 'string' || !settings.businessModel || settings.businessModel.length > 60
    || typeof settings.market !== 'string' || !settings.market || settings.market.length > 120
    || typeof settings.currency !== 'string' || !/^[A-Z]{3}$/.test(settings.currency)) invalid('Workspace settings need a business model, market and three-letter currency.');
  if (!['undecided', 'affiliate', 'retail', 'hybrid'].includes(settings.businessModel)) invalid('Choose a supported business model.');
  validateJson(data, 'workspace');
  let size;
  try { size = Buffer.byteLength(JSON.stringify(data)); } catch { invalid('The workspace must contain valid JSON.'); }
  if (size > MAX_WORKSPACE_BYTES) throw new HttpError(413, 'workspace_too_large', 'The workspace is too large. Export older records before adding more.');
  return data;
}

export function validateEtag(etag) {
  // Strong HTTP entity tags are opaque. Preserve their bytes, including valid
  // punctuation, while rejecting weak validators, lists and control characters.
  if (typeof etag !== 'string' || !/^(?:"[\x21\x23-\x7e]+"|[A-Za-z0-9._:-]+)$/.test(etag) || etag.length > 256) {
    throw new HttpError(400, 'etag_required', 'Reload the workspace before saving so its current version can be checked.');
  }
  return etag;
}

export function validateApprovalTransitions(next, previous, now = new Date()) {
  const oldProducts = new Map(previous.products.map(product => [product.id, product]));
  for (const product of next.products) {
    if (product.status !== 'Approved') continue;
    const old = oldProducts.get(product.id);
    if (old?.status === 'Approved' && JSON.stringify(old) === JSON.stringify(product)) continue;
    // Use exactly the same scoring decision as the browser. Aging evidence can
    // flag historical approvals without making the stored workspace unreadable.
    const assessment = scoreProduct(product, now);
    if (!assessment.approvalEligible) {
      throw new HttpError(400, 'approval_evidence_required', `${product.name} needs current, complete evidence and a priority shortlist score before approval. ${assessment.eligibility}.`);
    }
  }
}

function conflict() { return new HttpError(409, 'workspace_conflict', 'Someone else saved changes first. Reload the workspace and apply your changes again.'); }

async function streamText(stream) {
  const chunks = [];
  let length = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_WORKSPACE_BYTES) throw new Error('Stored workspace is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createWorkspaceStore({ blob = { get, put }, env = process.env, now = () => new Date().toISOString() } = {}) {
  const options = () => ({ access: 'private', ...(env.BLOB_READ_WRITE_TOKEN ? { token: env.BLOB_READ_WRITE_TOKEN } : {}), ...(env.BLOB_STORE_ID ? { storeId: env.BLOB_STORE_ID } : {}) });
  const configured = () => !!(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
  const ensureConfigured = () => { if (!configured()) throw new HttpError(503, 'storage_unconfigured', 'Shared workspace storage is not configured yet.'); };

  async function existing() {
    // A compressed representation may carry a weak ETag that cannot be used
    // for an object-level conditional write. Request the original bytes.
    const result = await blob.get(WORKSPACE_PATH, { ...options(), useCache: false, headers: { 'Accept-Encoding': 'identity' } });
    if (!result) return null;
    let stage = 'response';
    let bodyBytes = null;
    try {
      if (result.statusCode !== 200 || !result.stream || result.blob.size > MAX_WORKSPACE_BYTES) throw new Error();
      stage = 'stream';
      const body = await streamText(result.stream);
      bodyBytes = Buffer.byteLength(body);
      stage = 'json';
      const data = JSON.parse(body);
      stage = 'schema';
      validateWorkspace(data);
      stage = 'etag';
      validateEtag(result.blob.etag);
      return { data, etag: result.blob.etag };
    } catch (error) {
      const tag = result.blob?.etag;
      const encoding = result.headers?.get?.('content-encoding');
      // Bounded diagnostics only: never log content, tags, URLs, credentials or
      // raw error messages. Retain the strict validation and preserve the blob.
      console.error('workspace_read_validation', JSON.stringify({
        stage,
        errorName: ['Error', 'TypeError', 'SyntaxError', 'RangeError'].includes(error?.name) ? error.name : 'OtherError',
        errorCode: ['invalid_workspace', 'workspace_too_large', 'etag_required'].includes(error?.code) ? error.code : 'unclassified',
        status: Number.isInteger(result.statusCode) ? result.statusCode : null,
        declaredBytes: Number.isFinite(result.blob?.size) ? result.blob.size : null,
        bodyBytes,
        etagFormat: typeof tag !== 'string' || !tag ? 'missing' : tag.startsWith('W/"') ? 'weak-quoted' : tag.startsWith('"') ? 'quoted' : 'unquoted',
        etagLength: typeof tag === 'string' ? tag.length : null,
        contentEncoding: ['gzip', 'br', 'deflate', 'identity'].includes(encoding) ? encoding : encoding ? 'other' : 'none',
      }));
      throw new HttpError(503, 'stored_data_invalid', 'The saved workspace needs attention before it can be opened.');
    }
  }

  async function read() {
    ensureConfigured();
    const current = await existing();
    if (current) return current;
    const data = emptyWorkspace(now());
    try {
      const result = await blob.put(WORKSPACE_PATH, JSON.stringify(data), { ...options(), addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 60 });
      return { data, etag: validateEtag(result.etag) };
    } catch (error) {
      // Two first readers may both see a missing blob. The second create cannot overwrite.
      // Read the successful creator's state instead of repeating an unconditional write.
      const concurrent = await existing();
      if (concurrent) return concurrent;
      throw error;
    }
  }

  async function write(data, etag) {
    ensureConfigured();
    validateWorkspace(data);
    validateEtag(etag);
    const current = await read();
    if (current.etag !== etag || current.data.revision !== data.revision) throw conflict();
    const updatedAt = now();
    validateApprovalTransitions(data, current.data, updatedAt);
    const next = { ...data, revision: current.data.revision + 1, updatedAt };
    validateWorkspace(next);
    try {
      const result = await blob.put(WORKSPACE_PATH, JSON.stringify(next), { ...options(), addRandomSuffix: false, allowOverwrite: true, ifMatch: etag, contentType: 'application/json', cacheControlMaxAge: 60 });
      return { data: next, etag: validateEtag(result.etag) };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || error?.name === 'BlobPreconditionFailedError' || error?.status === 412 || error?.statusCode === 412) throw conflict();
      throw error;
    }
  }

  return { read, write, configured };
}


