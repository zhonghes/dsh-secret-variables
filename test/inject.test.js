import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStore } from '../src/store.js'
import { createSecretVariables } from '../src/service.js'
import { AUTO_ENV_PREFIX, createEnvContributor, shouldDenyPlaceholder } from '../src/inject.js'

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
  return { service, values }
}

const exec = (sessionId) => ({ agent: { session: { id: sessionId } } })

test('T-E1 the contributor resolves the primed overlay for a session', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'OPENAI_API_KEY', availability: 'all' })
  await values.set(created.ref, 'sk-live-value-1234567890')
  await service.setSessionOverride('s1', created.id, true)
  await service.primeEnv('s1')
  const contributor = createEnvContributor(service)
  assert.equal(contributor.resolve(exec('s1')).DSH_SECRET_OPENAI_API_KEY, 'sk-live-value-1234567890')
})

test('T-E2 an execution without an agent gets nothing', async () => {
  const { service } = build()
  const contributor = createEnvContributor(service)
  assert.deepEqual({ ...contributor.resolve({}) }, {})
})

test('T-E3 an unprimed session falls back to an empty overlay', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'X', availability: 'all' })
  await values.set(created.ref, 'value-1234567890')
  await service.setSessionOverride('s1', created.id, true)
  const contributor = createEnvContributor(service)
  assert.deepEqual({ ...contributor.resolve(exec('s1')) }, {})
})

test('T-E4 declared keys cover definitions and the auto pool', async () => {
  const { service } = build()
  await service.upsertGlobal({ name: 'OPENAI_API_KEY', availability: 'all' })
  const contributor = createEnvContributor(service)
  const keys = Object.keys(contributor.variables)
  assert.ok(keys.includes('DSH_SECRET_OPENAI_API_KEY'))
  assert.ok(keys.includes(`${AUTO_ENV_PREFIX}1`))
  assert.ok(keys.every((key) => key.startsWith('DSH_SECRET_')))
})

test('T-E9 only declared keys are ever returned', async () => {
  const { service, values } = build()
  const created = await service.upsertGlobal({ name: 'OPENAI_API_KEY', availability: 'all' })
  await values.set(created.ref, 'value-1234567890')
  await service.setSessionOverride('s1', created.id, true)
  await service.primeEnv('s1')
  const contributor = createEnvContributor(service)
  const returned = Object.keys(contributor.resolve(exec('s1')))
  for (const key of returned) assert.ok(key in contributor.variables, key)
})

test('T-E6 references in tools that never receive DSH_* are denied', () => {
  assert.equal(shouldDenyPlaceholder('bash', { command: 'curl -H "x: $DSH_SECRET_A"' }), false)
  assert.equal(shouldDenyPlaceholder('pwsh', { command: 'echo $env:DSH_SECRET_A' }), false)
  const reason = shouldDenyPlaceholder('terminal_send', { input: 'echo $DSH_SECRET_A' })
  assert.equal(typeof reason, 'string')
  assert.match(reason, /bash/)
})

test('T-E7 ordinary tools keep inert placeholder text', () => {
  assert.equal(shouldDenyPlaceholder('write', { content: 'API_KEY=$DSH_SECRET_A' }), false)
})

test('T-P6 prompt text is synchronous and lists enabled variables only', async () => {
  const { service } = build()
  const one = await service.upsertGlobal({ name: 'ONE', availability: 'all' })
  const two = await service.upsertGlobal({ name: 'TWO', availability: 'all' })
  await service.setSessionOverride('s1', one.id, true)
  await service.setSessionOverride('s1', two.id, true)
  await service.setSessionOverride('s1', two.id, false)
  const text = service.promptText('s1')
  assert.equal(typeof text, 'string')
  assert.match(text, /ONE/)
  assert.equal(text.includes('TWO'), false)
})
