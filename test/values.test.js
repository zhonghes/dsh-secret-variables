import test from 'node:test'
import assert from 'node:assert/strict'
import { createCredentialsValues } from '../src/values.js'

function fakeCredentials(initial = {}) {
  const refs = new Map(Object.entries(initial))
  return {
    calls: [],
    refs,
    async resolve(ref) {
      this.calls.push(['resolve', ref])
      const value = refs.get(ref)
      return value === undefined ? undefined : { value, source: 'store' }
    },
    async describe(ref) {
      this.calls.push(['describe', ref])
      return { configured: this.refs.has(ref), writable: true }
    },
    async set(ref, value) {
      this.calls.push(['set', ref, value])
      refs.set(ref, value)
    },
    async unset(ref) {
      this.calls.push(['unset', ref])
      refs.delete(ref)
    },
  }
}

test('T-C1 a value is stored under a derived credential ref', async () => {
  const credentials = fakeCredentials()
  const values = createCredentialsValues(credentials)
  const ref = values.ref('abc123')
  assert.equal(ref, 'DSH_VAR_ABC123')
  await values.set(ref, 'sk-test-value-1234567890')
  assert.equal(await values.resolve(ref), 'sk-test-value-1234567890')
})

test('T-C2 unset removes the value', async () => {
  const credentials = fakeCredentials({ DSH_VAR_ABC: 'x' })
  const values = createCredentialsValues(credentials)
  await values.unset('DSH_VAR_ABC')
  assert.equal(await values.resolve('DSH_VAR_ABC'), undefined)
})

test('T-C3 describe exposes only configuration state', async () => {
  const credentials = {
    async describe() {
      return { configured: true, writable: true }
    },
  }
  const values = createCredentialsValues(credentials)
  const info = await values.describe(['DSH_VAR_A'])
  assert.deepEqual(info, { DSH_VAR_A: { configured: true, writable: true } })
  assert.equal(JSON.stringify(info).includes('value'), false)
})

test('T-C8 describe maps the singular host API per reference', async () => {
  const credentials = fakeCredentials({ DSH_VAR_A: 'value-a' })
  const values = createCredentialsValues(credentials)
  const described = await values.describe(['DSH_VAR_A', 'DSH_VAR_B'])
  assert.deepEqual(described.DSH_VAR_A.configured, true)
  assert.deepEqual(described.DSH_VAR_B.configured, false)
  assert.deepEqual(credentials.calls.filter((call) => call[0] === 'describe').map((call) => call[1]), ['DSH_VAR_A', 'DSH_VAR_B'])
})

test('T-C8b one failing reference does not hide the others', async () => {
  const credentials = {
    async describe(ref) {
      if (ref === 'DSH_VAR_BAD') throw new Error('boom')
      return { configured: true, writable: true }
    },
  }
  const values = createCredentialsValues(credentials)
  const described = await values.describe(['DSH_VAR_OK', 'DSH_VAR_BAD'])
  assert.equal(described.DSH_VAR_OK.configured, true)
  assert.equal(described.DSH_VAR_BAD.configured, false)
})
