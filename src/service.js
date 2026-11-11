/**
 * Scoped secret-variable service: definitions in a snapshot store, values in
 * the Host credential store, and synchronous derived views for the shell-env
 * contributor and the prompt section.
 * @module secret-variables/service
 */
import { randomUUID } from 'node:crypto'
import {
  effectiveVariables,
  envNamesFor,
  requireName,
  sanitizeName,
  SecretVariablesError,
} from './core.js'
import { replaceValues, scanCredentials } from './fallback.js'

const AUTO_ENV_PREFIX = 'DSH_SECRET_AUTO_'

/**
 * Shortest value used for textual replacement. Shorter values are still
 * injected into the shell but never matched against arbitrary text, where a
 * short run would corrupt unrelated paths, ids, or digits.
 */
export const MIN_REDACTABLE_VALUE = 12

/**
 * Reject a name another definition in the same scope already uses. Comparison
 * runs on the sanitized suffix, so `a`, `A`, and `a!` collide; the same name in
 * a different scope is the supported override mechanism and stays allowed.
 * @param {ReadonlyArray<{ id: string, name: string }>} definitions - rows of one scope.
 * @param {string} name - candidate name.
 * @param {string} [exceptId] - row being updated, never compared with itself.
 * @returns {string} the sanitized suffix.
 */
function requireUniqueName(definitions, name, exceptId) {
  const wanted = requireName(name)
  const clash = definitions.find((item) => item.id !== exceptId && sanitizeName(item.name) === wanted)
  if (clash !== undefined) {
    throw new SecretVariablesError('DUPLICATE_NAME', `variable "${clash.name}" already exists in this scope`)
  }
  return wanted
}

/** @returns {string} a compact identifier usable inside a credential ref. */
function freshId() {
  return randomUUID().replace(/-/gu, '').slice(0, 12)
}

/**
 * @param {object} ports - injected dependencies.
 * @param {{ read(): Promise<object>, write(snapshot: object): Promise<void> }} ports.store - snapshot persistence.
 * @param {object} ports.values - credential value port.
 * @param {(sessionId: string) => string | undefined} [ports.resolveWorkspaceId] - session → workspace lookup.
 * @param {() => Array<{ id: string, title?: string, path?: string }>} [ports.listWorkspaces] - project directory.
 * @param {() => number} [ports.now] - clock.
 * @param {() => string} [ports.newId] - identity source.
 * @param {number} [ports.maxAuto] - auto-claimed secret budget per session.
 */
export function createSecretVariables({
  store,
  values,
  resolveWorkspaceId,
  listWorkspaces,
  now = () => Date.now(),
  newId = freshId,
  maxAuto = 16,
}) {
  let cache = null
  const listeners = new Set()
  const overlays = new Map()
  const autos = new Map()

  const emit = () => {
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        // A derived registration must not break a committed write.
      }
    }
  }

  async function load() {
    if (cache !== null) return cache
    cache = await store.read()
    return cache
  }

  async function mutate(mutator) {
    const current = await load()
    const draft = structuredClone(current)
    const result = mutator(draft)
    const next = structuredClone(draft)
    await store.write(next)
    cache = next
    overlays.clear()
    emit()
    return result
  }

  const refOf = (id) => values.ref(id)

  function projectList() {
    return (listWorkspaces?.() ?? []).map((workspace) => ({
      id: String(workspace.id),
      title: workspace.title ?? workspace.path ?? String(workspace.id),
      ...(workspace.path === undefined ? {} : { path: workspace.path }),
    }))
  }

  function scopeOf(sessionId, workspaceId) {
    return {
      sessionId: String(sessionId),
      workspaceId: workspaceId ?? resolveWorkspaceId?.(String(sessionId)),
    }
  }

  async function describeRefs(ids) {
    if (ids.length === 0) return {}
    const refs = ids.map(refOf)
    try {
      const described = await values.describe(refs)
      return Object.fromEntries(ids.map((id) => [id, described[refOf(id)]?.configured === true]))
    } catch {
      return Object.fromEntries(ids.map((id) => [id, false]))
    }
  }

  function autoEntries(sessionId) {
    return [...(autos.get(String(sessionId))?.entries ?? [])]
  }

  function claimAuto(sessionId, secret) {
    const key = String(sessionId)
    let state = autos.get(key)
    if (state === undefined) {
      state = { entries: [], byValue: new Map() }
      autos.set(key, state)
    }
    const existing = state.byValue.get(secret)
    if (existing !== undefined) return existing.ref
    if (state.entries.length >= maxAuto) return null
    const index = state.entries.length + 1
    const entry = { ref: `${AUTO_ENV_PREFIX}${index}`, name: `AUTO_${index}`, value: secret }
    state.entries.push(entry)
    state.byValue.set(secret, entry)
    overlays.delete(key)
    return entry.ref
  }

  /**
   * @param {string} sessionId - owning session.
   * @param {string} [workspaceId] - explicit workspace override.
   * @returns {Promise<Array<{ value: string, ref: string, envName: string }>>} enabled values.
   */
  async function enabledPairs(sessionId, workspaceId) {
    const snapshot = await load()
    const items = effectiveVariables(snapshot, scopeOf(sessionId, workspaceId))
    const pairs = []
    for (const item of items) {
      if (!item.enabled) continue
      const value = await values.resolve(refOf(item.id))
      if (value === undefined) continue
      pairs.push({ value, ref: `$${item.envName}`, envName: item.envName })
    }
    return pairs
  }

  async function listGlobals() {
    const snapshot = await load()
    const stored = await describeRefs(snapshot.globals.map((item) => item.id))
    const envNames = envNamesFor(snapshot)
    return {
      globals: snapshot.globals
        .map((global) => ({
          ...global,
          envName: envNames.get(global.id),
          ref: refOf(global.id),
          set: stored[global.id] === true,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }
  }

  async function upsertGlobal({ id, name, description, availability = 'all', enabledByDefault = false }) {
    requireName(name)
    const created = await mutate((draft) => {
      requireUniqueName(draft.globals, name, id)
      const existing = id === undefined ? undefined : draft.globals.find((item) => item.id === id)
      if (existing !== undefined) {
        existing.name = name
        if (description !== undefined) existing.description = description
        existing.availability = availability
        existing.enabledByDefault = enabledByDefault === true
        return { id: existing.id }
      }
      const row = {
        id: newId(),
        name,
        ...(description === undefined ? {} : { description }),
        availability,
        enabledByDefault: enabledByDefault === true,
        createdAt: now(),
      }
      draft.globals.push(row)
      return { id: row.id }
    })
    const snapshot = await load()
    const global = snapshot.globals.find((item) => item.id === created.id)
    if (global === undefined) throw new SecretVariablesError('NOT_FOUND', 'global variable disappeared')
    return {
      ...global,
      envName: envNamesFor(snapshot).get(global.id),
      ref: refOf(global.id),
      set: (await describeRefs([global.id]))[global.id] === true,
    }
  }

  async function removeGlobal(id) {
    let found = false
    await mutate((draft) => {
      const index = draft.globals.findIndex((item) => item.id === id)
      if (index < 0) return
      found = true
      draft.globals.splice(index, 1)
      for (const record of Object.values(draft.workspaces)) delete record.overrides[id]
      for (const record of Object.values(draft.sessions)) delete record.overrides[id]
    })
    if (!found) throw new SecretVariablesError('NOT_FOUND', `unknown global variable ${id}`)
    await values.unset(refOf(id))
  }

  async function getWorkspace(workspaceId) {
    const snapshot = await load()
    const key = String(workspaceId)
    const record = snapshot.workspaces[key] ?? { overrides: {}, variables: [] }
    const envNames = envNamesFor(snapshot)
    const ids = [...snapshot.globals.map((item) => item.id), ...record.variables.map((item) => item.id)]
    const stored = await describeRefs(ids)
    const decorate = (item) => ({
      ...item,
      envName: envNames.get(item.id),
      ref: refOf(item.id),
      set: stored[item.id] === true,
      override: record.overrides[item.id] ?? null,
      effective: record.overrides[item.id] ?? item.enabledByDefault,
    })
    return {
      workspaceId: key,
      globals: snapshot.globals
        .filter((global) => global.availability === 'all' || global.availability.includes(key))
        .map(decorate)
        .sort((left, right) => left.name.localeCompare(right.name)),
      variables: record.variables.map(decorate).sort((left, right) => left.name.localeCompare(right.name)),
    }
  }

  async function addWorkspaceVariable(workspaceId, { name, description, enabledByDefault = true }) {
    requireName(name)
    const created = await mutate((draft) => {
      const key = String(workspaceId)
      draft.workspaces[key] ??= { overrides: {}, variables: [] }
      requireUniqueName(draft.workspaces[key].variables, name)
      const row = {
        id: newId(),
        name,
        ...(description === undefined ? {} : { description }),
        enabledByDefault: enabledByDefault !== false,
        createdAt: now(),
      }
      draft.workspaces[key].variables.push(row)
      return { id: row.id }
    })
    const workspace = await getWorkspace(workspaceId)
    const found = workspace.variables.find((item) => item.id === created.id)
    if (found === undefined) throw new SecretVariablesError('NOT_FOUND', 'workspace variable disappeared')
    return found
  }

  async function removeWorkspaceVariable(workspaceId, id) {
    let found = false
    await mutate((draft) => {
      const record = draft.workspaces[String(workspaceId)]
      if (record === undefined) return
      const index = record.variables.findIndex((item) => item.id === id)
      if (index < 0) return
      found = true
      record.variables.splice(index, 1)
      delete record.overrides[id]
    })
    if (!found) throw new SecretVariablesError('NOT_FOUND', `unknown workspace variable ${id}`)
    await values.unset(refOf(id))
  }

  async function setWorkspaceOverride(workspaceId, variableId, enabled) {
    await mutate((draft) => {
      const key = String(workspaceId)
      draft.workspaces[key] ??= { overrides: {}, variables: [] }
      draft.workspaces[key].overrides[variableId] = enabled === true
    })
    return getWorkspace(workspaceId)
  }

  async function getSession(sessionId, workspaceId) {
    const snapshot = await load()
    const scope = scopeOf(sessionId, workspaceId)
    const items = effectiveVariables(snapshot, scope)
    const stored = await describeRefs(items.map((item) => item.id))
    const rows = items.map((item) => ({
      ...item,
      ref: refOf(item.id),
      set: stored[item.id] === true,
    }))
    for (const entry of autoEntries(scope.sessionId)) {
      rows.push({
        id: `auto:${entry.name}`,
        name: entry.name,
        source: 'auto',
        envName: entry.ref,
        ref: entry.ref,
        enabled: true,
        available: true,
        set: true,
      })
    }
    return {
      sessionId: scope.sessionId,
      workspaceId: scope.workspaceId,
      items: rows,
      enabledCount: rows.filter((row) => row.enabled).length,
      total: rows.length,
    }
  }

  async function addSessionVariable(sessionId, { name, description, enabledByDefault = true }) {
    requireName(name)
    const created = await mutate((draft) => {
      const key = String(sessionId)
      draft.sessions[key] ??= { overrides: {}, variables: [] }
      requireUniqueName(draft.sessions[key].variables, name)
      const row = {
        id: newId(),
        name,
        ...(description === undefined ? {} : { description }),
        enabledByDefault: enabledByDefault !== false,
        createdAt: now(),
      }
      draft.sessions[key].variables.push(row)
      return { id: row.id }
    })
    const snapshot = await load()
    const variable = snapshot.sessions[String(sessionId)].variables.find((item) => item.id === created.id)
    if (variable === undefined) throw new SecretVariablesError('NOT_FOUND', 'session variable disappeared')
    return { ...variable, envName: envNamesFor(snapshot).get(variable.id), ref: refOf(variable.id), set: false }
  }

  async function removeSessionVariable(sessionId, id) {
    let found = false
    await mutate((draft) => {
      const record = draft.sessions[String(sessionId)]
      if (record === undefined) return
      const index = record.variables.findIndex((item) => item.id === id)
      if (index < 0) return
      found = true
      record.variables.splice(index, 1)
      delete record.overrides[id]
    })
    if (!found) throw new SecretVariablesError('NOT_FOUND', `unknown session variable ${id}`)
    await values.unset(refOf(id))
  }

  async function setSessionOverride(sessionId, variableId, enabled) {
    await mutate((draft) => {
      const key = String(sessionId)
      draft.sessions[key] ??= { overrides: {}, variables: [] }
      draft.sessions[key].overrides[variableId] = enabled === true
    })
    return getSession(sessionId)
  }

  async function clearValue(ref) {
    await values.unset(ref)
  }

  async function envOverlay(sessionId) {
    const pairs = await enabledPairs(sessionId)
    const overlay = {}
    for (const pair of pairs) overlay[pair.envName] = pair.value
    for (const entry of autoEntries(sessionId)) overlay[entry.ref] = entry.value
    return overlay
  }

  async function primeEnv(sessionId) {
    const overlay = await envOverlay(sessionId)
    overlays.set(String(sessionId), overlay)
    return overlay
  }

  function envOverlaySync(sessionId) {
    return { ...(overlays.get(String(sessionId)) ?? {}) }
  }

  function envKeys() {
    const snapshot = cache ?? { version: 1, globals: [], workspaces: {}, sessions: {} }
    const names = [...envNamesFor(snapshot).values()]
    for (let index = 1; index <= maxAuto; index += 1) names.push(`${AUTO_ENV_PREFIX}${index}`)
    return [...new Set(names)]
  }

  function promptText(sessionId) {
    if (cache === null) return ''
    const scope = scopeOf(sessionId)
    const items = effectiveVariables(cache, scope).filter((item) => item.enabled)
    const autoList = autoEntries(scope.sessionId).map((entry) => ({ name: entry.name, envName: entry.ref }))
    const rows = [...items.map((item) => ({ name: item.name, envName: item.envName })), ...autoList]
    if (rows.length === 0) return ''
    return [
      'Sensitive variables available in this session are real environment variables for one-shot shell commands only (bash, pwsh):',
      ...rows.map((row) => `- ${row.name} → $${row.envName}`),
      'Reference them in double quotes (for example "$DSH_SECRET_X") and never print, echo, or write them into files. Variables not listed here are not enabled; other tools never receive these values.',
    ].join('\n')
  }

  async function redact(text, sessionId) {
    if (typeof text !== 'string' || text.length === 0) return { text, changed: false, claimed: 0 }
    const pairs = (await enabledPairs(sessionId)).filter((pair) => pair.value.length >= MIN_REDACTABLE_VALUE)
    const known = replaceValues(text, pairs)
    let out = known.text
    let claimed = 0
    const hits = scanCredentials(out)
    for (let index = hits.length - 1; index >= 0; index -= 1) {
      const hit = hits[index]
      const ref = claimAuto(sessionId, hit.value)
      if (ref === null) continue
      out = `${out.slice(0, hit.start)}$${ref}${out.slice(hit.end)}`
      claimed += 1
    }
    return { text: out, changed: out !== text, claimed }
  }

  function disposeSession(sessionId) {
    autos.delete(String(sessionId))
    overlays.delete(String(sessionId))
  }

  return {
    listWorkspaces: projectList,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    listGlobals,
    upsertGlobal,
    removeGlobal,
    getWorkspace,
    addWorkspaceVariable,
    removeWorkspaceVariable,
    setWorkspaceOverride,
    getSession,
    addSessionVariable,
    removeSessionVariable,
    setSessionOverride,
    clearValue,
    envOverlay,
    primeEnv,
    envOverlaySync,
    envKeys,
    promptText,
    redact,
    disposeSession,
  }
}
