import { HttpError, isAuthConfigured, isAuthenticated, verifyAccessCode, createSessionToken, sessionCookie, requireSameOrigin, readJson, sendJson, sendError } from '../lib/auth.js';

export function createSessionHandler({ env = process.env } = {}) {
  return async function session(req, res) {
    try {
      if (req.method === 'GET') {
        return sendJson(res, 200, { authenticated: isAuthenticated(req, env), configured: isAuthConfigured(env) });
      }
      if (!['POST', 'DELETE'].includes(req.method)) return sendJson(res, 405, { error: 'Method not allowed.', code: 'method_not_allowed' }, { Allow: 'GET, POST, DELETE' });
      requireSameOrigin(req, env);
      if (req.method === 'DELETE') {
        return sendJson(res, 200, { authenticated: false, configured: isAuthConfigured(env) }, { 'Set-Cookie': sessionCookie('', 0) });
      }
      if (!isAuthConfigured(env)) throw new HttpError(503, 'auth_unconfigured', 'Workspace access is not configured yet.');
      const body = await readJson(req, 4096);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.code !== 'string' || body.code.length > 512) {
        throw new HttpError(400, 'invalid_request', 'Enter your workspace access code.');
      }
      if (!verifyAccessCode(body.code, env)) throw new HttpError(401, 'invalid_code', 'That access code is not recognised.');
      return sendJson(res, 200, { authenticated: true, configured: true }, { 'Set-Cookie': sessionCookie(createSessionToken(env)) });
    } catch (error) { return sendError(res, error); }
  };
}

export default createSessionHandler();

