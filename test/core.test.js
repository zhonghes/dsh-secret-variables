import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ENV_PREFIX,
  RESERVED_ENV_KEYS,
  assignEnvNames,
  effectiveVariables,
  emptySnapshot,
  normalizeSnapshot,
  requireName,
  sanitizeName,
} from '../src/core.js'

test('T-N1 plain name becomes an uppercase env suffix', () => {
  assert.equal(sanitizeName('openai_api_key'), 'OPENAI_API_KEY')
})

test('T-N2 punctuation collapses into single underscores', () => {
  assert.equal(sanitizeName('My-Key.1'), 'MY_KEY_1')
  assert.equal(sanitizeName('  spaced name  '), 'SPACED_NAME')
})

test('T-N3 non-ascii names keep a stable derivation', () => {
  const first = sanitizeName('中文名')
  const second = sanitizeName('中文名')
  assert.equal(first, second)
  assert.match(first, /^SECRET_[0-9A-F]{8}$/)
})

test('T-N4 overlong names truncate to one stable environment name', () => {
  const long = 'A'.repeat(60)
  assert.ok(sanitizeName(long).length <= 40)
  const names = assignEnvNames([
    { id: 'x1', name: 'A'.repeat(60), createdAt: 1 },
    { id: 'x2', name: 'A'.repeat(61), createdAt: 2 },
  ])
  assert.equal(names.get('x1'), names.get('x2'))
  assert.ok(names.get('x1').length <= 'DSH_SECRET_'.length + 40)
})

test('T-N5 case-insensitive duplicates share one environment name', () => {
  const names = assignEnvNames([
    { id: 'a', name: 'TOKEN', createdAt: 1 },
    { id: 'b', name: 'token', createdAt: 2 },
    { id: 'c', name: 'Token', createdAt: 3 },
  ])
  assert.equal(names.get('a'), `${ENV_PREFIX}TOKEN`)
  assert.equal(names.get('b'), `${ENV_PREFIX}TOKEN`)
  assert.equal(names.get('c'), `${ENV_PREFIX}TOKEN`)
})

test('T-N6 reserved shell keys are never produced', () => {
  for (const name of ['HOME', 'SHELL', 'SESSION_ID', 'PROFILE', 'PROFILE_DIR']) {
    const envName = `${ENV_PREFIX}${sanitizeName(name)}`
    assert.ok(!RESERVED_ENV_KEYS.has(envName))
  }
})

test('T-N7 empty or symbol-only names are rejected', () => {
  assert.equal(sanitizeName(''), null)
  assert.equal(sanitizeName('!!!'), null)
  assert.equal(sanitizeName('   '), null)
  assert.throws(() => requireName(''), (error) => error.code === 'INVALID_NAME')
  assert.throws(() => requireName('###'), (error) => error.code === 'INVALID_NAME')
})

test('T-N9 the env suffix is safe inside a shell word', () => {
  const envName = `${ENV_PREFIX}${sanitizeName('a$b c"d\'e')}`
  assert.match(envName, /^DSH_SECRET_[A-Z0-9_]+$/)
})

test('T-R1 an empty snapshot yields an empty effective set', () => {
  assert.deepEqual(effectiveVariables(emptySnapshot(), { workspaceId: 'w1', sessionId: 's1' }), [])
})

function snapshotFixture() {
  return normalizeSnapshot({
    version: 1,
    globals: [
      { id: 'g1', name: 'OPENAI_API_KEY', availability: 'all', enabledByDefault: true, createdAt: 1 },
      { id: 'g2', name: 'AWS_SECRET_KEY', availability: 'all', enabledByDefault: false, createdAt: 2 },
      { id: 'g3', name: 'PROJECT_ONLY', availability: ['w1'], enabledByDefault: true, createdAt: 3 },
    ],
    workspaces: {
      w1: {
        overrides: { g2: true },
        variables: [{ id: 'wv1', name: 'GITHUB_TOKEN', createdAt: 4, enabledByDefault: true }],
      },
    },
    sessions: {
      s1: {
        overrides: { g1: false },
        variables: [{ id: 'sv1', name: 'SESSION_ONE', createdAt: 5 }],
      },
    },
  })
}

test('T-R2/T-R6/T-R10/T-R11 project and session scopes resolve by precedence', () => {
  const items = effectiveVariables(snapshotFixture(), { workspaceId: 'w1', sessionId: 's1' })
  const byName = new Map(items.map((item) => [item.name, item]))
  assert.equal(byName.get('OPENAI_API_KEY').enabled, false, 'session override wins')
  assert.equal(byName.get('OPENAI_API_KEY').source, 'global')
  assert.equal(byName.get('AWS_SECRET_KEY').enabled, true, 'project override wins')
  assert.equal(byName.get('GITHUB_TOKEN').enabled, true)
  assert.equal(byName.get('GITHUB_TOKEN').source, 'workspace')
  assert.equal(byName.get('SESSION_ONE').enabled, true)
  assert.equal(byName.get('SESSION_ONE').source, 'session')
  assert.equal(byName.get('PROJECT_ONLY').enabled, true)
})

test('T-R5 a global restricted to another project is absent', () => {
  const items = effectiveVariables(snapshotFixture(), { workspaceId: 'w2', sessionId: 's1' })
  assert.equal(items.some((item) => item.name === 'PROJECT_ONLY'), false)
  assert.equal(new Set(items.map((item) => item.name)).size, items.length)
})

test('T-R3/T-R7 defaults stay off unless something enables them', () => {
  const snapshot = normalizeSnapshot({
    version: 1,
    globals: [{ id: 'g1', name: 'PLAIN', availability: 'all', createdAt: 1 }],
    workspaces: {},
    sessions: {},
  })
  const [item] = effectiveVariables(snapshot, { workspaceId: 'w1', sessionId: 's1' })
  assert.equal(item.enabled, false)
})

test('T-R8 a session override can enable what the project disabled', () => {
  const snapshot = normalizeSnapshot({
    version: 1,
    globals: [{ id: 'g1', name: 'PLAIN', availability: 'all', createdAt: 1 }],
    workspaces: { w1: { overrides: { g1: false }, variables: [] } },
    sessions: { s1: { overrides: { g1: true }, variables: [] } },
  })
  const [item] = effectiveVariables(snapshot, { workspaceId: 'w1', sessionId: 's1' })
  assert.equal(item.enabled, true)
})

test('T-R14 the same name at three scopes resolves to one item, session first', () => {
  const snapshot = normalizeSnapshot({
    version: 1,
    globals: [{ id: 'g1', name: 'SHARED', availability: 'all', enabledByDefault: true, createdAt: 1 }],
    workspaces: { w1: { overrides: {}, variables: [{ id: 'wv1', name: 'SHARED', createdAt: 2 }] } },
    sessions: { s1: { overrides: {}, variables: [{ id: 'sv1', name: 'SHARED', createdAt: 3 }] } },
  })
  const items = effectiveVariables(snapshot, { workspaceId: 'w1', sessionId: 's1' })
  assert.equal(items.length, 1)
  assert.equal(items[0].source, 'session')
})

test('T-N10 the same name keeps one env name across scopes', () => {
  const snapshot = normalizeSnapshot({
    version: 1,
    globals: [{ id: 'g1', name: 'SHARED', availability: 'all', createdAt: 1 }],
    workspaces: { w1: { overrides: {}, variables: [{ id: 'wv1', name: 'shared', createdAt: 2 }] } },
    sessions: {},
  })
  const [globalItem] = effectiveVariables(snapshot, { workspaceId: 'w2', sessionId: 's1' })
  const [workspaceItem] = effectiveVariables(snapshot, { workspaceId: 'w1', sessionId: 's1' })
  assert.equal(globalItem.envName, workspaceItem.envName)
})

test('T-R15 orphan project and session records do not throw', () => {
  const snapshot = normalizeSnapshot({
    version: 1,
    globals: [],
    workspaces: { gone: { overrides: {}, variables: [{ id: 'wv', name: 'X', createdAt: 1 }] } },
    sessions: { gone: { overrides: {}, variables: [{ id: 'sv', name: 'Y', createdAt: 2 }] } },
  })
  assert.deepEqual(effectiveVariables(snapshot, { workspaceId: 'w1', sessionId: 's1' }), [])
})

test('T-S3 malformed stored data is rejected, unknown fields ignored', () => {
  assert.throws(() => normalizeSnapshot({ version: 1, globals: 'nope' }), (error) => error.code === 'INVALID_RECORD')
  const normalized = normalizeSnapshot({ version: 1, globals: [{ id: 'g', name: 'N' }], extra: true })
  assert.equal(normalized.globals.length, 1)
  assert.equal('extra' in normalized, false)
})
