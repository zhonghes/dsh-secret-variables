/**
 * Pure domain logic for scoped secret variables: name normalization, env-name
 * assignment, and precedence-based effective resolution. No I/O, no Cordis.
 * @module secret-variables/core
 */

/** Prefix every injected environment variable carries. */
export const ENV_PREFIX = 'DSH_SECRET_'

/** Environment keys owned by the shell registry itself. */
export const RESERVED_ENV_KEYS = new Set([
  'DSH_HOME',
  'DSH_SHELL',
  'DSH_SESSION_ID',
  'DSH_PROFILE',
  'DSH_PROFILE_DIR',
])

/** Longest accepted sanitized name. */
const MAX_SANITIZED = 40

/** One categorized failure with a stable machine code. */
export class SecretVariablesError extends Error {
  /**
   * @param {string} code - stable machine code.
   * @param {string} message - human-readable summary.
   */
  constructor(code, message) {
    super(message)
    this.name = 'SecretVariablesError'
    this.code = code
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** FNV-1a over code points; stable across processes. */
function hash8(text) {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).toUpperCase().padStart(8, '0')
}

/**
 * Normalize a user-facing variable name into its environment suffix.
 * @param {unknown} raw - candidate name.
 * @returns {string | null} `[A-Z0-9_]` suffix, or null when nothing usable remains.
 */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  let out = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
  if (out.length === 0) {
    // Names written in a non-Latin script keep a stable derived suffix; text
    // with no letter or digit at all is rejected instead of hashed.
    if (!/[\p{L}\p{N}]/u.test(trimmed)) return null
    out = `SECRET_${hash8(trimmed)}`
  }
  if (out.length > MAX_SANITIZED) out = out.slice(0, MAX_SANITIZED).replace(/_+$/u, '')
  return out.length === 0 ? null : out
}

/**
 * Require a usable name or fail with `INVALID_NAME`.
 * @param {unknown} raw - candidate name.
 * @returns {string} the sanitized suffix.
 */
export function requireName(raw) {
  const name = sanitizeName(raw)
  if (name === null) throw new SecretVariablesError('INVALID_NAME', 'variable name must contain letters or digits')
  return name
}

/**
 * Assign one environment name per variable identity. The name is a function of
 * the sanitized spelling, so the same declared name at several scopes shares
 * one reference (matching how effective resolution collapses them).
 * @param {ReadonlyArray<{ id: string, name: string }>} definitions
 * @returns {Map<string, string>} variable id → environment name.
 */
export function assignEnvNames(definitions) {
  const names = new Map()
  for (const definition of definitions) {
    const base = sanitizeName(definition.name) ?? `SECRET_${hash8(String(definition.id))}`
    names.set(String(definition.id), `${ENV_PREFIX}${base}`)
  }
  return names
}

/** @returns {{ version: 1, globals: [], workspaces: {}, sessions: {} }} a fresh empty snapshot. */
export function emptySnapshot() {
  return { version: 1, globals: [], workspaces: {}, sessions: {} }
}

function normalizeGlobal(raw) {
  if (!isRecord(raw)) throw new SecretVariablesError('INVALID_RECORD', 'global variable must be an object')
  if (typeof raw.id !== 'string' || raw.id.length === 0) throw new SecretVariablesError('INVALID_RECORD', 'global variable needs an id')
  if (typeof raw.name !== 'string') throw new SecretVariablesError('INVALID_RECORD', 'global variable needs a name')
  const availability = raw.availability === undefined || raw.availability === 'all'
    ? 'all'
    : Array.isArray(raw.availability) && raw.availability.every((id) => typeof id === 'string')
      ? [...raw.availability]
      : (() => { throw new SecretVariablesError('INVALID_RECORD', 'global availability must be "all" or a workspace id list') })()
  return {
    id: raw.id,
    name: raw.name,
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    availability,
    enabledByDefault: raw.enabledByDefault === true,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
  }
}

function normalizeVariable(raw) {
  if (!isRecord(raw)) throw new SecretVariablesError('INVALID_RECORD', 'variable must be an object')
  if (typeof raw.id !== 'string' || raw.id.length === 0) throw new SecretVariablesError('INVALID_RECORD', 'variable needs an id')
  if (typeof raw.name !== 'string') throw new SecretVariablesError('INVALID_RECORD', 'variable needs a name')
  return {
    id: raw.id,
    name: raw.name,
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    enabledByDefault: raw.enabledByDefault !== false,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
  }
}

function normalizeOverrides(raw) {
  if (raw === undefined) return {}
  if (!isRecord(raw)) throw new SecretVariablesError('INVALID_RECORD', 'overrides must be an object')
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'boolean') throw new SecretVariablesError('INVALID_RECORD', 'override values must be booleans')
    out[key] = value
  }
  return out
}

function normalizeScopeMap(raw, normalizeItem) {
  if (raw === undefined) return {}
  if (!isRecord(raw)) throw new SecretVariablesError('INVALID_RECORD', 'scope table must be an object')
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) throw new SecretVariablesError('INVALID_RECORD', 'scope record must be an object')
    out[key] = {
      overrides: normalizeOverrides(value.overrides),
      variables: Array.isArray(value.variables) ? value.variables.map(normalizeItem) : [],
    }
  }
  return out
}

/**
 * Validate and detach one stored snapshot.
 * @param {unknown} raw - untrusted stored value.
 * @returns {{ version: 1, globals: object[], workspaces: object, sessions: object }} normalized snapshot.
 */
export function normalizeSnapshot(raw) {
  if (!isRecord(raw)) throw new SecretVariablesError('INVALID_RECORD', 'snapshot must be an object')
  if (raw.version !== undefined && raw.version !== 1) throw new SecretVariablesError('INVALID_RECORD', 'unsupported snapshot version')
  if (raw.globals !== undefined && !Array.isArray(raw.globals)) throw new SecretVariablesError('INVALID_RECORD', 'globals must be an array')
  return {
    version: 1,
    globals: (raw.globals ?? []).map(normalizeGlobal),
    workspaces: normalizeScopeMap(raw.workspaces, normalizeVariable),
    sessions: normalizeScopeMap(raw.sessions, normalizeVariable),
  }
}

function allDefinitions(snapshot) {
  const out = [...snapshot.globals]
  for (const record of Object.values(snapshot.workspaces)) out.push(...record.variables)
  for (const record of Object.values(snapshot.sessions)) out.push(...record.variables)
  return out
}

/** @returns {Map<string, string>} every defined variable id → environment name. */
export function envNamesFor(snapshot) {
  return assignEnvNames(allDefinitions(snapshot))
}

/**
 * Resolve every variable visible to one session, applying scope precedence.
 * The same sanitized name at several scopes collapses to one entry.
 * @param {ReturnType<typeof normalizeSnapshot>} snapshot - stored definitions.
 * @param {{ workspaceId?: string, sessionId: string }} scope - addressed session.
 * @returns {Array<{ id: string, name: string, source: 'global'|'workspace'|'session', envName: string, enabled: boolean, available: boolean }>}
 */
export function effectiveVariables(snapshot, { workspaceId, sessionId }) {
  const envNames = envNamesFor(snapshot)
  const workspace = workspaceId === undefined ? undefined : snapshot.workspaces[workspaceId]
  const session = snapshot.sessions[sessionId]
  const byName = new Map()

  const put = (item) => {
    byName.set(sanitizeName(item.name) ?? item.id, item)
  }

  for (const global of snapshot.globals) {
    const available = global.availability === 'all' || (workspaceId !== undefined && global.availability.includes(workspaceId))
    if (!available) continue
    const enabled = session?.overrides[global.id] ?? workspace?.overrides[global.id] ?? global.enabledByDefault
    put({
      id: global.id,
      name: global.name,
      source: 'global',
      envName: envNames.get(global.id),
      enabled,
      available,
    })
  }

  if (workspace !== undefined) {
    for (const variable of workspace.variables) {
      const enabled = session?.overrides[variable.id] ?? workspace.overrides[variable.id] ?? variable.enabledByDefault
      put({
        id: variable.id,
        name: variable.name,
        source: 'workspace',
        envName: envNames.get(variable.id),
        enabled,
        available: true,
      })
    }
  }

  for (const variable of session?.variables ?? []) {
    const enabled = session.overrides[variable.id] ?? variable.enabledByDefault !== false
    put({
      id: variable.id,
      name: variable.name,
      source: 'session',
      envName: envNames.get(variable.id),
      enabled,
      available: true,
    })
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name))
}
