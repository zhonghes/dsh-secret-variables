/**
 * Authenticated JSON route for the Web client. Metadata only: secret values are
 * read and written through the shipped credential Remote, never through here.
 * @module secret-variables/http
 */
import { SecretVariablesError } from './core.js'

/** Exact shared-channel path: the connection service matches the full pathname. */
export const ROUTE_PATH = '/api/secret-variables'

/** @param {number} status @param {unknown} body @returns {Response} */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** @param {SecretVariablesError} error @returns {number} */
function statusOf(error) {
  switch (error.code) {
    case 'INVALID_NAME':
    case 'INVALID_INPUT':
      return 422
    case 'DUPLICATE_NAME':
      return 409
    case 'NOT_FOUND':
      return 404
    case 'UNKNOWN_OP':
      return 400
    default:
      return 500
  }
}

/** @param {unknown} error @returns {Response} */
function failure(error) {
  if (error instanceof SecretVariablesError) {
    return json(statusOf(error), { ok: false, error: error.code, message: error.message })
  }
  return json(500, { ok: false, error: 'INTERNAL', message: 'secret variables request failed' })
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new SecretVariablesError('INVALID_INPUT', `${field} is required`)
  return value
}

/**
 * Build the Fetch handler mounted by the connection service.
 * @param {object} service - the secret-variable service.
 * @returns {(request: Request) => Promise<Response>} route handler.
 */
export function createHttpHandler(service) {
  return async function handle(request) {
    try {
      if (request.method === 'GET') {
        const url = new URL(request.url)
        const op = url.searchParams.get('op')
        switch (op) {
          case 'workspaces':
            return json(200, { ok: true, data: { workspaces: service.listWorkspaces() } })
          case 'globals':
            return json(200, { ok: true, data: await service.listGlobals() })
          case 'workspace':
            return json(200, { ok: true, data: await service.getWorkspace(requireString(url.searchParams.get('workspaceId'), 'workspaceId')) })
          case 'session':
            return json(200, { ok: true, data: await service.getSession(requireString(url.searchParams.get('sessionId'), 'sessionId')) })
          default:
            throw new SecretVariablesError('UNKNOWN_OP', `unknown operation ${String(op)}`)
        }
      }

      if (request.method === 'POST') {
        let body
        try {
          body = await request.json()
        } catch {
          throw new SecretVariablesError('INVALID_INPUT', 'request body must be JSON')
        }
        if (typeof body !== 'object' || body === null) throw new SecretVariablesError('INVALID_INPUT', 'request body must be an object')
        switch (body.op) {
          case 'addGlobal':
            return json(200, { ok: true, data: { global: await service.upsertGlobal({
              name: requireString(body.name, 'name'),
              description: body.description,
              availability: body.availability ?? 'all',
              enabledByDefault: body.enabledByDefault === true,
            }) } })
          case 'updateGlobal':
            return json(200, { ok: true, data: { global: await service.upsertGlobal({
              id: requireString(body.id, 'id'),
              name: requireString(body.name, 'name'),
              description: body.description,
              availability: body.availability ?? 'all',
              enabledByDefault: body.enabledByDefault === true,
            }) } })
          case 'removeGlobal':
            await service.removeGlobal(requireString(body.id, 'id'))
            return json(200, { ok: true, data: {} })
          case 'addWorkspaceVar':
            return json(200, { ok: true, data: { variable: await service.addWorkspaceVariable(
              requireString(body.workspaceId, 'workspaceId'),
              { name: requireString(body.name, 'name'), description: body.description, enabledByDefault: body.enabledByDefault !== false },
            ) } })
          case 'removeWorkspaceVar':
            await service.removeWorkspaceVariable(requireString(body.workspaceId, 'workspaceId'), requireString(body.id, 'id'))
            return json(200, { ok: true, data: {} })
          case 'setWorkspaceOverride':
            return json(200, { ok: true, data: { workspace: await service.setWorkspaceOverride(
              requireString(body.workspaceId, 'workspaceId'),
              requireString(body.variableId, 'variableId'),
              body.enabled === true,
            ) } })
          case 'addSessionVar':
            return json(200, { ok: true, data: { variable: await service.addSessionVariable(
              requireString(body.sessionId, 'sessionId'),
              { name: requireString(body.name, 'name'), description: body.description, enabledByDefault: body.enabledByDefault !== false },
            ) } })
          case 'removeSessionVar':
            await service.removeSessionVariable(requireString(body.sessionId, 'sessionId'), requireString(body.id, 'id'))
            return json(200, { ok: true, data: {} })
          case 'setSessionOverride':
            return json(200, { ok: true, data: { session: await service.setSessionOverride(
              requireString(body.sessionId, 'sessionId'),
              requireString(body.variableId, 'variableId'),
              body.enabled === true,
            ) } })
          case 'clearValue':
            await service.clearValue(requireString(body.ref, 'ref'))
            return json(200, { ok: true, data: {} })
          default:
            throw new SecretVariablesError('UNKNOWN_OP', `unknown operation ${String(body.op)}`)
        }
      }

      return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED', message: 'only GET and POST are supported' })
    } catch (error) {
      return failure(error)
    }
  }
}
