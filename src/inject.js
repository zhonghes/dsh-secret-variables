/**
 * Host-side integration helpers: the shell-environment contributor that hands
 * resolved values to `bash`/`pwsh`, and the guard for shell tools that never
 * receive them.
 * @module secret-variables/inject
 */

/** Prefix of environment names assigned to auto-claimed credentials. */
export const AUTO_ENV_PREFIX = 'DSH_SECRET_AUTO_'

/** Model shell tools that consume the managed `DSH_*` environment. */
export const SHELL_TOOLS_WITH_ENV = new Set(['bash', 'pwsh'])

/** Shell-like tools that never receive the managed environment. */
export const SHELL_TOOLS_WITHOUT_ENV = new Set([
  'bash_persistent',
  'pwsh_persistent',
  'terminal',
  'terminal_open',
  'terminal_send',
  'terminal_read',
  'terminal_list',
  'terminal_signal',
  'terminal_close',
])

const REFERENCE = /\$(?:\{)?DSH_SECRET_[A-Z0-9_]+/u

/**
 * Build one shell-env contribution describing every declared environment name.
 * @param {{ envKeys(): string[], envOverlaySync(sessionId: string): Record<string, string> }} service
 * @returns {{ name: string, variables: Record<string, { description: string }>, resolve(execution: object): Record<string, string> }}
 */
export function createEnvContributor(service) {
  const variables = {}
  for (const key of service.envKeys()) {
    variables[key] = { description: 'Session-scoped sensitive variable for one-shot shell commands.' }
  }
  const declared = new Set(Object.keys(variables))
  return {
    name: 'secret-variables',
    variables,
    resolve(execution) {
      const sessionId = execution?.agent?.session?.id
      if (sessionId === undefined) return {}
      const overlay = service.envOverlaySync(sessionId)
      const out = {}
      for (const [key, value] of Object.entries(overlay)) {
        // The registry rejects undeclared keys; a definition added since this
        // registration re-registers instead of leaking a key here.
        if (declared.has(key)) out[key] = value
      }
      return out
    },
  }
}

/**
 * Whether one tool call must be denied because it references a secret in a
 * shell that never receives the managed environment.
 * @param {string} toolName - wire tool name.
 * @param {unknown} args - parsed arguments.
 * @returns {false | string} `false` when allowed, otherwise the denial reason.
 */
export function shouldDenyPlaceholder(toolName, args) {
  if (!SHELL_TOOLS_WITHOUT_ENV.has(toolName)) return false
  let text
  try {
    text = JSON.stringify(args) ?? ''
  } catch {
    text = ''
  }
  if (!REFERENCE.test(text)) return false
  return `secret placeholders only expand in one-shot bash or pwsh commands; use the bash tool instead of ${toolName}`
}
