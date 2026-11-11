import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStore } from '../src/store.js'
import { createSecretVariables } from '../src/service.js'
import { createHttpHandler } from '../src/http.js'

function build() {
  const values = {
    map: new Map(),
    ref(id) {
      return `DSH_VAR_${id.toUpperCase()}`
    },
    async resolve(ref) {
      return this.map.get(ref)
    },
    async set(ref, value) {
      this.map.set(ref, value)
    },
    async unset(ref) {
      this.map.delete(ref)
    },
    async describe(refs) {
      return Object.fromEntries(refs.map((ref) => [ref, { configured: this.map.has(ref), writable: true }]))
    },
  }
  let counter = 0
  const service = createSecretVariables({
    store: createMemoryStore(),
    values,
    resolveWorkspaceId: () => 'w1',
    now: () => 1,
    newId: () => `id${(counter += 1)}`,
  })
  return { service, values, handler: createHttpHandler(service) }
}

const url = (query) => new Request(`http://localhost/api/secret-variables?${query}`)

async function post(handler, body) {
  return handler(new Request('http://localhost/api/secret-variables', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

test('T-H1 listing globals returns metadata only', async () => {
  const { service, values, handler } = build()
  const created = await service.upsertGlobal({ name: 'OPENAI_API_KEY', availability: 'all' })
  await values.set(created.ref, 'sk-live-value-1234567890')
  const response = await handler(url('op=globals'))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.globals.length, 1)
  assert.equal(body.data.globals[0].set, true)
  assert.equal(JSON.stringify(body).includes('sk-live-value-1234567890'), false)
})

test('T-H2 an unknown operation is a bad request', async () => {
  const { handler } = build()
  const response = await handler(url('op=nope'))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'UNKNOWN_OP')
})

test('T-H3 an invalid payload has no side effect', async () => {
  const { service, handler } = build()
  const response = await post(handler, { op: 'addGlobal', name: '' })
  assert.equal(response.status, 422)
  assert.deepEqual((await service.listGlobals()).globals, [])
})

test('T-H4 adding a global returns its metadata', async () => {
  const { handler } = build()
  const response = await post(handler, { op: 'addGlobal', name: 'OPENAI_API_KEY', availability: 'all' })
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.global.envName, 'DSH_SECRET_OPENAI_API_KEY')
  assert.equal(typeof body.data.global.ref, 'string')
})

test('T-H5 workspace and session operations stay scoped', async () => {
  const { handler } = build()
  await post(handler, { op: 'addWorkspaceVar', workspaceId: 'w1', name: 'PROJECT_VAR' })
  const w1 = await (await handler(url('op=workspace&workspaceId=w1'))).json()
  const w2 = await (await handler(url('op=workspace&workspaceId=w2'))).json()
  assert.equal(w1.data.variables.length, 1)
  assert.equal(w2.data.variables.length, 0)
})

test('T-H6 every response is free of stored values', async () => {
  const { service, values, handler } = build()
  const created = await service.upsertGlobal({ name: 'SECRET_ONE', availability: 'all' })
  await values.set(created.ref, 'super-secret-value-1234567890')
  await service.setSessionOverride('s1', created.id, true)
  for (const path of ['op=globals', 'op=session&sessionId=s1']) {
    const body = await (await handler(url(path))).text()
    assert.equal(body.includes('super-secret-value-1234567890'), false, path)
  }
})

test('T-H7 a storage failure answers 500 without breaking the service', async () => {
  const values = { ref: (id) => `DSH_VAR_${id}`, async resolve() {}, async set() {}, async unset() {}, async describe(refs) { return {} } }
  let fail = true
  const store = {
    async read() {
      if (fail) {
        const error = new Error('boom')
        error.code = 'IO'
        throw error
      }
      return { version: 1, globals: [], workspaces: {}, sessions: {} }
    },
    async write() {},
  }
  const service = createSecretVariables({ store, values, resolveWorkspaceId: () => 'w1', now: () => 1, newId: () => 'id1' })
  const handler = createHttpHandler(service)
  const failed = await handler(url('op=globals'))
  assert.equal(failed.status, 500)
  fail = false
  const ok = await handler(url('op=globals'))
  assert.equal(ok.status, 200)
})

test('T-H9 addSessionVar honors enabledByDefault', async () => {
  const { handler } = build()
  const created = await (await post(handler, { op: 'addSessionVar', sessionId: 's1', name: 'SESSION_OFF', enabledByDefault: false })).json()
  assert.equal(created.ok, true)
  const session = await (await handler(url('op=session&sessionId=s1'))).json()
  assert.equal(session.data.items[0].enabled, false)
})

test('T-H10 the route lists projects for the scope picker', async () => {
  const { service, handler } = build()
  const response = await handler(url('op=workspaces'))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.data.workspaces))
})

test('T-H13 a duplicate name is a conflict', async () => {
  const { handler } = build()
  const first = await post(handler, { op: 'addGlobal', name: 'DUP', availability: 'all' })
  assert.equal(first.status, 200)
  const second = await post(handler, { op: 'addGlobal', name: 'dup', availability: 'all' })
  assert.equal(second.status, 409)
  const body = await second.json()
  assert.equal(body.ok, false)
  assert.equal(body.error, 'DUPLICATE_NAME')
})
