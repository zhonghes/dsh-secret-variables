import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStore } from '../src/store.js'
import { createSecretVariables } from '../src/service.js'

function fakeValues(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    calls: [],
    ref(id) {
      return `DSH_VAR_${id.toUpperCase()}`
    },
    async resolve(ref) {
      return map.get(ref)
    },
    async set(ref, value) {
      this.calls.push(['set', ref, value])
      map.set(ref, value)
    },
    async unset(ref) {
      this.calls.push(['unset', ref])
      map.delete(ref)
    },
    async describe(refs) {
      return Object.fromEntries(refs.map((ref) => [ref, { configured: map.has(ref), writable: true }]))
    },
  }
}

function build(overrides = {}) {
  const store = createMemoryStore()
  const values = fakeValues()
  let counter = 0
  const service = createSecretVariables({
    store,
    values,
    resolveWorkspaceId: () => 'w1',
    now: () => 1000 + counter,
    newId: () => {
      counter += 1
      return `id${String(counter).padStart(4, '0')}`
    },
    ...overrides,
  })
  return { service, store, values }
}

test('T-R1 a fresh service has no variables', async () => {
  const { service } = build()
  assert.deepEqual((await service.listGlobals()).globals, [])
  assert.deepEqual((await service.getSession('s1')).items, [])
})

test('T-C1/T-C3 a global variable is listed with its ref and set flag', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'openai_api_key', availability: 'all' })
  assert.equal(created.envName, 'DSH_SECRET_OPENAI_API_KEY')
  assert.equal(created.ref, `DSH_VAR_${created.id.toUpperCase()}`)
  assert.equal(created.set, false)
  await values.set(created.ref, 'sk-live-value-1234567890')
  const listed = await service.listGlobals()
  assert.equal(listed.globals[0].set, true)
  assert.equal(JSON.stringify(listed).includes('sk-live-value-1234567890'), false)
})

test('T-N7 an invalid name is rejected before any write', async () => {
  const { service, store } = build()
  await assert.rejects(service.upsertGlobal({ name: '!!!' }), (error) => error.code === 'INVALID_NAME')
  assert.deepEqual((await store.read()).globals, [])
})

test('T-R2 a global defaults to disabled and can be enabled per session', async () => {
  const { service } = build()
  const created = await service.upsertGlobal({ name: 'OPENAI_API_KEY', availability: 'all' })
  assert.equal((await service.getSession('s1')).items[0].enabled, false)
  await service.setSessionOverride('s1', created.id, true)
  assert.equal((await service.getSession('s1')).items[0].enabled, true)
  assert.equal((await service.getSession('s2')).items[0].enabled, false)
})

test('T-R4 availability limits a global to one project', async () => {
  const { service } = build()
  await service.upsertGlobal({ name: 'PROJECT_ONLY', availability: ['w1'] })
  const inProject = await service.getSession('s1', 'w1')
  const elsewhere = await service.getSession('s9', 'w2')
  assert.equal(inProject.items.length, 1)
  assert.equal(elsewhere.items.length, 0)
})

test('T-R10 a project variable applies only inside that project', async () => {
  const { service } = build()
  const created = await service.addWorkspaceVariable('w1', { name: 'GITHUB_TOKEN' })
  assert.equal((await service.getSession('s1', 'w1')).items[0].id, created.id)
  assert.equal((await service.getSession('s1', 'w2')).items.length, 0)
})

test('T-R11 a session variable stays in its session', async () => {
  const { service } = build()
  await service.addSessionVariable('s1', { name: 'SESSION_ONE' })
  assert.equal((await service.getSession('s1')).items[0].source, 'session')
  assert.equal((await service.getSession('s2')).items.length, 0)
})

test('T-R12 enabled without a value is marked unset and never injected', async () => {
  const { service } = build()
  const created = await service.upsertGlobal({ name: 'NO_VALUE', availability: 'all' })
  await service.setSessionOverride('s1', created.id, true)
  const [item] = (await service.getSession('s1')).items
  assert.equal(item.enabled, true)
  assert.equal(item.set, false)
  assert.deepEqual(await service.envOverlay('s1'), {})
  assert.match(service.promptText('s1'), /NO_VALUE/)
})

test('T-R13 removing a global clears its value and references', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'TEMP', availability: 'all' })
  await values.set(created.ref, 'value-1234567890')
  await service.removeGlobal(created.id)
  assert.equal((await service.listGlobals()).globals.length, 0)
  assert.equal(values.calls.some((call) => call[0] === 'unset' && call[1] === created.ref), true)
  assert.equal(await values.resolve(created.ref), undefined)
})

test('T-E1 the env overlay contains only enabled values', async () => {
  const { service, values } = build()
  const enabled = await service.upsertGlobal({ name: 'ON', availability: 'all' })
  const disabled = await service.upsertGlobal({ name: 'OFF', availability: 'all' })
  await values.set(enabled.ref, 'on-value-1234567890')
  await values.set(disabled.ref, 'off-value-1234567890')
  await service.setSessionOverride('s1', enabled.id, true)
  assert.deepEqual(await service.envOverlay('s1'), { DSH_SECRET_ON: 'on-value-1234567890' })
})

test('T-P2 the prompt text names variables but never their values', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'OPENAI_API_KEY', availability: 'all' })
  await values.set(created.ref, 'sk-live-value-1234567890')
  await service.setSessionOverride('s1', created.id, true)
  const text = service.promptText('s1')
  assert.match(text, /OPENAI_API_KEY/)
  assert.match(text, /\$DSH_SECRET_OPENAI_API_KEY/)
  assert.equal(text.includes('sk-live-value-1234567890'), false)
})

test('T-P1 an empty effective set produces no prompt text', async () => {
  const { service } = build()
  assert.equal(service.promptText('s1'), '')
})

test('T-F4/T-F5 redaction maps known values and auto-claims unknown secrets', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'KNOWN', availability: 'all' })
  await values.set(created.ref, 'known-value-1234567890')
  await service.setSessionOverride('s1', created.id, true)
  const first = await service.redact('known-value-1234567890 and sk-proj-ABCDEF1234567890abcdef', 's1')
  assert.equal(first.text.includes('known-value-1234567890'), false)
  assert.match(first.text, /\$DSH_SECRET_KNOWN/)
  assert.match(first.text, /\$DSH_SECRET_AUTO_1/)
  const second = await service.redact('sk-proj-ABCDEF1234567890abcdef', 's1')
  assert.equal(second.text, '$DSH_SECRET_AUTO_1')
  const overlay = await service.envOverlay('s1')
  assert.equal(overlay.DSH_SECRET_AUTO_1, 'sk-proj-ABCDEF1234567890abcdef')
})

test('T-F7 the auto-claim pool is bounded', async () => {
  const { service } = build({ maxAuto: 2 })
  await service.redact('sk-proj-ABCDEF1234567890abcdef', 's1')
  await service.redact('sk-proj-ZYXWVUT9876543210abcdef', 's1')
  const third = await service.redact('sk-proj-QQQQQQQ1234567890abcdef', 's1')
  assert.match(third.text, /sk-proj-QQQQQQQ/)
})

test('T-F9 disposing a session forgets auto-claimed values', async () => {
  const { service } = build()
  await service.redact('sk-proj-ABCDEF1234567890abcdef', 's1')
  service.disposeSession('s1')
  const overlay = await service.envOverlay('s1')
  assert.equal(overlay.DSH_SECRET_AUTO_1, undefined)
})

test('T-F10 redaction is idempotent', async () => {
  const { service } = build()
  const once = await service.redact('sk-proj-ABCDEF1234567890abcdef', 's1')
  const twice = await service.redact(once.text, 's1')
  assert.equal(twice.text, once.text)
  assert.equal(twice.changed, false)
})

test('T-R14 a duplicate name across scopes resolves to one entry', async () => {
  const { service } = build()
  await service.upsertGlobal({ name: 'SHARED', availability: 'all' })
  await service.addWorkspaceVariable('w1', { name: 'SHARED' })
  const items = (await service.getSession('s1', 'w1')).items
  assert.equal(items.length, 1)
  assert.equal(items[0].source, 'workspace')
})

test('T-R15 a duplicate name inside one scope is rejected', async () => {
  const { service } = build()
  await service.upsertGlobal({ name: 'DUP', availability: 'all' })
  await assert.rejects(service.upsertGlobal({ name: 'dup', availability: 'all' }), (error) => error.code === 'DUPLICATE_NAME')
  await service.addWorkspaceVariable('w1', { name: 'DUP' })
  await assert.rejects(service.addWorkspaceVariable('w1', { name: 'dup' }), (error) => error.code === 'DUPLICATE_NAME')
  await service.addSessionVariable('s1', { name: 'DUP' })
  await assert.rejects(service.addSessionVariable('s1', { name: 'dup' }), (error) => error.code === 'DUPLICATE_NAME')
})

test('T-R15b an update keeps its own name and still rejects another row', async () => {
  const { service } = build()
  const first = await service.upsertGlobal({ name: 'ONE', availability: 'all', enabledByDefault: false })
  await service.upsertGlobal({ name: 'TWO', availability: 'all' })
  const updated = await service.upsertGlobal({ id: first.id, name: 'ONE', availability: 'all', enabledByDefault: true })
  assert.equal(updated.enabledByDefault, true)
  await assert.rejects(service.upsertGlobal({ id: first.id, name: 'TWO', availability: 'all' }), (error) => error.code === 'DUPLICATE_NAME')
})

test('T-F11 short values are injected but never used for textual replacement', async () => {
  const { service, values } = build()
  const short = await service.upsertGlobal({ name: 'SHORT_ONE', availability: 'all' })
  const long = await service.upsertGlobal({ name: 'LONG_ONE', availability: 'all' })
  await values.set(short.ref, 'abcd')
  await values.set(long.ref, 'abcdefghijklmnop')
  await service.setSessionOverride('s1', short.id, true)
  await service.setSessionOverride('s1', long.id, true)
  const overlay = await service.envOverlay('s1')
  assert.equal(overlay.DSH_SECRET_SHORT_ONE, 'abcd')
  const result = await service.redact('abcd stays and abcdefghijklmnop changes', 's1')
  assert.equal(result.text, 'abcd stays and $DSH_SECRET_LONG_ONE changes')
})

test('T-S8 a session variable honors its creation-time enable flag', async () => {
  const { service } = build()
  const created = await service.addSessionVariable('s1', { name: 'OFF_BY_DEFAULT', enabledByDefault: false })
  assert.equal(created.enabledByDefault, false)
  assert.equal((await service.getSession('s1')).items[0].enabled, false)
  await service.setSessionOverride('s1', created.id, true)
  assert.equal((await service.getSession('s1')).items[0].enabled, true)
})

test('T-R4b a global variable can target several projects', async () => {
  const { service } = build()
  await service.upsertGlobal({ name: 'MULTI', availability: ['w1', 'w2'] })
  assert.equal((await service.getSession('s1', 'w1')).items.length, 1)
  assert.equal((await service.getSession('s1', 'w2')).items.length, 1)
  assert.equal((await service.getSession('s1', 'w3')).items.length, 0)
})

test('T-S9 the service lists projects for scope selection', () => {
  const store = createMemoryStore()
  const values = { ref: (id) => 'DSH_VAR_' + id, async resolve() {}, async set() {}, async unset() {}, async describe() { return {} } }
  const service = createSecretVariables({
    store, values, now: () => 1, newId: () => 'id1',
    listWorkspaces: () => [{ id: 'w1', title: 'demo', path: '/tmp/demo' }],
    resolveWorkspaceId: () => 'w1',
  })
  assert.deepEqual(service.listWorkspaces(), [{ id: 'w1', title: 'demo', path: '/tmp/demo' }])
})
