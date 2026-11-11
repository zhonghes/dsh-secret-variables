/**
 * Host half of the sensitive-information variables bundle: definitions in a
 * JSON store, values in the credential service, shell injection through the
 * managed `DSH_*` environment, a prompt section that names the variables, and
 * an authenticated metadata route for the Web client.
 * @module @local/dsh-secret-variables
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createFileStore } from './src/store.js'
import { createCredentialsValues } from './src/values.js'
import { createSecretVariables } from './src/service.js'
import { createEnvContributor, shouldDenyPlaceholder, SHELL_TOOLS_WITH_ENV } from './src/inject.js'
import { createHttpHandler, ROUTE_PATH } from './src/http.js'

/** Stable Cordis plugin name. */
export const name = 'secret-variables'

/** Services that must exist before this plugin activates. */
export const inject = ['shellEnv', 'systemPrompt', 'credentials', 'workspaceRegistry', 'agents']

/** @param {Record<string, unknown>} config @returns {{ path: string, maxAuto: number }} */
function resolveConfig(config) {
  const path = config.path
  const maxAuto = config.maxAuto
  if (path !== undefined && (typeof path !== 'string' || path.length === 0)) {
    throw new Error('secret-variables: path must be a non-empty string')
  }
  if (maxAuto !== undefined && (!Number.isInteger(maxAuto) || maxAuto < 1 || maxAuto > 64)) {
    throw new Error('secret-variables: maxAuto must be an integer between 1 and 64')
  }
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return { path: path ?? join(home, 'storages', 'sensitive-vars.json'), maxAuto: maxAuto ?? 16 }
}

/**
 * Load the plugin.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} [config] - optional row configuration.
 */
export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  const service = createSecretVariables({
    store: createFileStore(resolved.path),
    values: createCredentialsValues(ctx.credentials),
    listWorkspaces: () => {
      try {
        return ctx.workspaceRegistry.list().map((workspace) => ({ id: workspace.id, title: workspace.title, path: workspace.path }))
      } catch {
        return []
      }
    },
    resolveWorkspaceId: (sessionId) => {
      try {
        const workspace = ctx.workspaceRegistry.list().find((candidate) => (candidate.sessionIds ?? []).includes(sessionId))
        return workspace?.id
      } catch {
        return undefined
      }
    },
    maxAuto: resolved.maxAuto,
  })
  const warn = (message, error) => {
    try {
      ctx.logger?.warn?.(`secret-variables: ${message}`, error)
    } catch {
      // Logging must never break a turn.
    }
  }

  /** @param {import('@deepseek-ai/dsh-llm').ContentBlock[]} blocks @param {string} sessionId */
  const redactBlocks = async (blocks, sessionId) => {
    let changed = false
    const out = []
    for (const block of blocks) {
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
        try {
          const result = await service.redact(block.text, sessionId)
          if (result.changed) {
            out.push({ ...block, text: result.text })
            changed = true
            continue
          }
        } catch (error) {
          warn('redaction failed for one text block', error)
        }
      }
      out.push(block)
    }
    return changed ? out : blocks
  }

  // Shell environment: declare every current name, re-register when the
  // definition set changes (the registry fixes the key set at registration).
  let disposeContributor
  const registerContributor = () => {
    try {
      disposeContributor?.()
      disposeContributor = ctx.shellEnv.register(createEnvContributor(service))
    } catch (error) {
      warn('shell environment registration failed', error)
    }
  }
  ctx.effect(() => () => {
    disposeContributor?.()
    disposeContributor = undefined
  })
  ctx.effect(() => service.subscribe(registerContributor))
  void service
    .listGlobals()
    .then(() => {
      registerContributor()
      for (const agent of ctx.agents.list()) attachAgent(agent)
    })
    .catch((error) => {
      warn('initial definition load failed; local variables stay disabled until it succeeds', error)
      registerContributor()
    })

  // Per-agent prompt section naming the enabled variables (never their values).
  // Agents created before this plugin loaded are attached on startup as well.
  const sections = new Map()
  const attachAgent = (agent) => {
    const sessionId = agent.session.id
    if (sections.has(sessionId)) return
    try {
      const dispose = agent.ctx.systemPrompt.section({
        name: 'secret-variables',
        order: 900,
        text: () => service.promptText(sessionId),
      })
      sections.set(sessionId, dispose)
    } catch (error) {
      warn('prompt section registration failed', error)
    }
  }
  ctx.effect(() => () => {
    for (const dispose of sections.values()) dispose()
    sections.clear()
  })
  ctx.on('agent/created', ({ agent }) => attachAgent(agent))
  ctx.on('session/disposed', (session) => {
    const dispose = sections.get(session.id)
    dispose?.()
    sections.delete(session.id)
    service.disposeSession(session.id)
  })

  // Resolve values before dispatch (the contributor is synchronous) and deny
  // references in shell tools that never receive the managed environment.
  ctx.on('tools/pre-execute', async (exec, next) => {
    const sessionId = exec.agent?.session?.id
    if (sessionId !== undefined && SHELL_TOOLS_WITH_ENV.has(exec.name)) {
      try {
        await service.primeEnv(sessionId)
      } catch (error) {
        warn('value resolution failed; the command runs without secret variables', error)
      }
    }
    const reason = shouldDenyPlaceholder(exec.name, exec.args)
    if (reason !== false) return { kind: 'deny', reason }
    return next()
  })

  // Redact tool results before they are logged and shown to the model.
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    const sessionId = exec.agent?.session?.id
    if (sessionId === undefined || decision === undefined) return decision
    if (decision.kind === 'block') {
      return { ...decision, feedback: await redactBlocks(decision.feedback, sessionId) }
    }
    if (decision.kind === 'accept') {
      if (decision.value !== undefined) return decision
      const content = decision.content ?? result.content
      const redacted = await redactBlocks(content, sessionId)
      return redacted === content ? decision : { ...decision, content: redacted }
    }
    return decision
  })

  ctx.on('tools/ptc-dispatch-log', async (dispatch, next) => {
    const blocks = await next()
    const sessionId = dispatch.agent?.session?.id ?? dispatch.exec?.agent?.session?.id
    return sessionId === undefined ? blocks : redactBlocks(blocks, sessionId)
  })

  // Redact admitted user and injected-context messages before they are logged.
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind !== 'enter') return decision
    const sessionId = payload.agent.session.id
    let changed = false
    const messages = []
    for (const message of decision.messages) {
      const content = await redactBlocks(message.content, sessionId)
      if (content === message.content) {
        messages.push(message)
      } else {
        messages.push({ ...message, content })
        changed = true
      }
    }
    return changed ? { ...decision, messages } : decision
  }, { prepend: true })

  // Authenticated metadata route for the Web client.
  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.effect(() => {
      const dispose = connectionCtx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: createHttpHandler(service),
      })
      return () => {
        void dispose()
      }
    })
  })
}
