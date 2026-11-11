/**
 * Snapshot persistence for scoped secret variables. Two interchangeable
 * implementations share one contract: synchronous-free async reads of a whole
 * snapshot, durable serialized writes, and a stable empty value before the
 * first write. Metadata only — secret values live in the credential store.
 * @module secret-variables/store
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { emptySnapshot, normalizeSnapshot, SecretVariablesError } from './core.js'

function clone(value) {
  return structuredClone(value)
}

/**
 * In-memory store used by tests and by compositions without a durable path.
 * @param {unknown} [initial] - optional starting snapshot.
 * @returns {{ read(): Promise<object>, write(snapshot: object): Promise<void> }}
 */
export function createMemoryStore(initial) {
  let state = initial === undefined ? emptySnapshot() : normalizeSnapshot(initial)
  let chain = Promise.resolve()
  return {
    async read() {
      await chain
      return clone(state)
    },
    write(snapshot) {
      const next = normalizeSnapshot(snapshot)
      chain = chain.then(() => {
        state = clone(next)
      })
      return chain
    },
  }
}

/**
 * JSON file store: one document, atomic replace, owner-only permissions.
 * @param {string} filePath - absolute document path.
 * @returns {{ read(): Promise<object>, write(snapshot: object): Promise<void> }}
 */
export function createFileStore(filePath) {
  let chain = Promise.resolve()
  return {
    async read() {
      await chain
      let raw
      try {
        raw = await readFile(filePath, 'utf8')
      } catch (error) {
        if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptySnapshot()
        throw new SecretVariablesError('IO', `cannot read ${filePath}: ${String(error)}`)
      }
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new SecretVariablesError('INVALID_RECORD', `stored snapshot is not JSON: ${filePath}`)
      }
      return normalizeSnapshot(parsed)
    },
    write(snapshot) {
      const next = normalizeSnapshot(snapshot)
      chain = chain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true, mode: 0o700 })
        const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`
        await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, filePath)
      })
      return chain
    },
  }
}
