import { HttpError, requireAuthentication, requireSameOrigin, readJson, sendJson, sendError } from '../lib/auth.js';
import { createWorkspaceStore, MAX_WORKSPACE_BYTES } from '../lib/workspace.js';

export function createWorkspaceHandler({ env = process.env, store = createWorkspaceStore({ env }) } = {}) {
  return async function workspace(req, res) {
    try {
      if (!['GET', 'PUT'].includes(req.method)) return sendJson(res, 405, { error: 'Method not allowed.', code: 'method_not_allowed' }, { Allow: 'GET, PUT' });
      requireAuthentication(req, env);
      if (req.method === 'GET') return sendJson(res, 200, await store.read());
      requireSameOrigin(req, env);
      const body = await readJson(req, MAX_WORKSPACE_BYTES + 4096);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'data') || !Object.hasOwn(body, 'etag')) {
        throw new HttpError(400, 'invalid_request', 'Save the workspace with its data and current etag.');
      }
      return sendJson(res, 200, await store.write(body.data, body.etag));
    } catch (error) { return sendError(res, error); }
  };
}

export default createWorkspaceHandler();

