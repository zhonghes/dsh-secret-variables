/**
 * Adapter over the Host credential service for one value per variable id.
 * Values never leave this module except as a resolved string handed to a
 * shell-execution overlay.
 * @module secret-variables/values
 */

/**
 * Build the value port over `ctx.credentials`.
 * @param {{ resolve(ref: string): Promise<{ value: string } | undefined>, describe(refs: string[]): Promise<Record<string, unknown>>, set(ref: string, value: string): Promise<void>, unset(ref: string): Promise<void> }} credentials
 * @returns {{ ref(id: string): string, resolve(ref: string): Promise<string | undefined>, set(ref: string, value: string): Promise<void>, unset(ref: string): Promise<void>, describe(refs: string[]): Promise<Record<string, unknown>> }}
 */
export function createCredentialsValues(credentials) {
  return {
    /**
     * @param {string} id - variable identity.
     * @returns {string} a POSIX-identifier credential ref.
     */
    ref(id) {
      return `DSH_VAR_${String(id).toUpperCase()}`
    },
    /**
     * @param {string} ref - credential ref.
     * @returns {Promise<string | undefined>} the stored value, when present.
     */
    async resolve(ref) {
      const hit = await credentials.resolve(ref)
      return hit?.value
    },
    /**
     * @param {string} ref - credential ref.
     * @param {string} value - secret value.
     */
    async set(ref, value) {
      await credentials.set(ref, value)
    },
    /** @param {string} ref - credential ref. */
    async unset(ref) {
      await credentials.unset(ref)
    },
    /**
     * @param {string[]} refs - credential refs.
     * @returns {Promise<Record<string, unknown>>} configuration state per ref, never values.
     */
    async describe(refs) {
      const pairs = await Promise.all(refs.map(async (ref) => {
        try {
          return [ref, await credentials.describe(ref)]
        } catch {
          return [ref, { configured: false, writable: false }]
        }
      }))
      return Object.fromEntries(pairs)
    },
  }
}
