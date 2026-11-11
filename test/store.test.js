import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileStore, createMemoryStore } from '../src/store.js'

test('T-S1 memory store round-trips a snapshot', async () => {
  const store = createMemoryStore()
  const snapshot = { version: 1, globals: [], workspaces: {}, sessions: { s: { overrides: {}, variables: [] } } }
  await store.write(snapshot)
  assert.deepEqual(await store.read(), snapshot)
})

test('T-S2 concurrent writes are serialized and the last one wins', async () => {
  const store = createMemoryStore()
  const first = { version: 1, globals: [], workspaces: {}, sessions: {} }
  const second = { version: 1, globals: [{ id: 'g', name: 'N', availability: 'all', createdAt: 1 }], workspaces: {}, sessions: {} }
  await Promise.all([store.write(first), store.write(second)])
  const stored = await store.read()
  assert.equal(stored.globals.length, 1)
})

test('T-S7 a fresh file store returns an empty snapshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'secret-vars-'))
  const store = createFileStore(join(dir, 'vars.json'))
  assert.deepEqual(await store.read(), { version: 1, globals: [], workspaces: {}, sessions: {} })
})

test('T-S1b file store persists with owner-only permissions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'secret-vars-'))
  const file = join(dir, 'vars.json')
  const store = createFileStore(file)
  await store.write({ version: 1, globals: [{ id: 'g', name: 'N', availability: 'all', createdAt: 1 }], workspaces: {}, sessions: {} })
  const mode = (await stat(file)).mode & 0o777
  assert.equal(mode, 0o600)
  const raw = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(raw.globals.length, 1)
})

test('T-S3 a corrupt file raises INVALID_RECORD', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'secret-vars-'))
  const file = join(dir, 'vars.json')
  await writeFile(file, '{ not json', 'utf8')
  const store = createFileStore(file)
  await assert.rejects(store.read(), (error) => error.code === 'INVALID_RECORD')
})

test('T-S3b a shape-invalid file raises INVALID_RECORD', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'secret-vars-'))
  const file = join(dir, 'vars.json')
  await writeFile(file, JSON.stringify({ version: 1, globals: 'nope' }), 'utf8')
  const store = createFileStore(file)
  await assert.rejects(store.read(), (error) => error.code === 'INVALID_RECORD')
})
