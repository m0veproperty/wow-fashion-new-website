import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = '__Host-wow_workspace';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isAuthConfigured(env = process.env) {
  return typeof env.WORKSPACE_ACCESS_CODE === 'string' && env.WORKSPACE_ACCESS_CODE.length >= 12;
}

export function verifyAccessCode(candidate, env = process.env) {
  if (!isAuthConfigured(env) || typeof candidate !== 'string' || candidate.length > 512) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(candidate), hash(env.WORKSPACE_ACCESS_CODE));
}

function signature(value, env) {
  const key = createHmac('sha256', env.WORKSPACE_ACCESS_CODE)
    .update('wow-fashion:workspace-session-key:v1').digest();
  return createHmac('sha256', key).update(value).digest('base64url');
}

export function createSessionToken(env = process.env, now = Date.now()) {
  if (!isAuthConfigured(env)) throw new HttpError(503, 'auth_unconfigured', 'Workspace access is not configured yet.');
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, iat: issuedAt, exp: issuedAt + SESSION_SECONDS, nonce: randomBytes(16).toString('base64url') })).toString('base64url');
  return `${payload}.${signature(payload, env)}`;
}

export function verifySessionToken(token, env = process.env, now = Date.now()) {
  if (!isAuthConfigured(env) || typeof token !== 'string' || token.length > 1024) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every(value => /^[A-Za-z0-9_-]+$/.test(value))) return false;
  const expected = Buffer.from(signature(parts[0], env));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    return value.v === 1 && Number.isSafeInteger(value.iat) && Number.isSafeInteger(value.exp)
      && value.iat <= seconds + 30 && value.exp > seconds
      && value.exp - value.iat === SESSION_SECONDS && typeof value.nonce === 'string';
  } catch { return false; }
}

export function isAuthenticated(req, env = process.env, now = Date.now()) {
  const cookie = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
  const matches = cookie.split(';').map(item => item.trim()).filter(item => item.startsWith(`${COOKIE_NAME}=`));
  if (matches.length !== 1) return false;
  return verifySessionToken(matches[0].slice(COOKIE_NAME.length + 1), env, now);
}

export function requireAuthentication(req, env = process.env) {
  if (!isAuthConfigured(env)) throw new HttpError(503, 'auth_unconfigured', 'Workspace access is not configured yet.');
  if (!isAuthenticated(req, env)) throw new HttpError(401, 'unauthenticated', 'Unlock the workspace to continue.');
}

export function sessionCookie(token = '', maxAge = SESSION_SECONDS) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

// Mutating requests must explicitly identify this origin, including CLI callers.
export function requireSameOrigin(req, env = process.env) {
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  const fetchSite = req.headers?.['sec-fetch-site'];
  if (typeof origin !== 'string' || typeof host !== 'string' || /[\s,\/@\\]/.test(host)
    || (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
    throw new HttpError(403, 'origin_rejected', 'This request must come from the workspace.');
  }
  try {
    const parsed = new URL(origin);
    const deployed = env.VERCEL === '1' || env.NODE_ENV === 'production';
    const protocol = deployed || req.headers?.['x-forwarded-proto'] === 'https' || req.socket?.encrypted ? 'https:' : 'http:';
    if (parsed.origin !== origin || parsed.host !== host || parsed.protocol !== protocol) throw new Error();
  } catch {
    throw new HttpError(403, 'origin_rejected', 'This request must come from the workspace.');
  }
}

export async function readJson(req, maxBytes = 2 * 1024 * 1024) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) {
    throw new HttpError(415, 'json_required', 'Send this request as JSON.');
  }
  const contentLength = Number(req.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new HttpError(413, 'body_too_large', 'The workspace is too large to save in one request.');
  let value = req.body;
  if (value === undefined) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.byteLength;
      if (length > maxBytes) throw new HttpError(413, 'body_too_large', 'The workspace is too large to save in one request.');
      chunks.push(buffer);
    }
    value = Buffer.concat(chunks).toString('utf8');
  }
  try {
    if (Buffer.isBuffer(value)) value = value.toString('utf8');
    const encoded = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof encoded !== 'string') throw new Error();
    if (Buffer.byteLength(encoded) > maxBytes) throw new HttpError(413, 'body_too_large', 'The workspace is too large to save in one request.');
    return JSON.parse(encoded);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_json', 'The request does not contain valid JSON.');
  }
}

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  const common = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie', ...headers };
  for (const [key, value] of Object.entries(common)) res.setHeader(key, value);
  res.end(JSON.stringify(data));
}

export function sendError(res, error) {
  const known = error instanceof HttpError;
  sendJson(res, known ? error.status : 503, {
    error: known ? error.message : 'The workspace service is temporarily unavailable. Please try again.',
    code: known ? error.code : 'service_unavailable',
  });
}

