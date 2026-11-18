import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import React from 'react'
import ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { createSecretVariables } from '../src/service.js'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')

// One DOM for the whole file: the client bundle captures window/document when
// it is evaluated, so every test shares the same environment.
const window = new Window({ url: 'http://127.0.0.1:3080/' })
globalThis.window = window
globalThis.document = window.document
for (const key of ['HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver']) globalThis[key] = window[key]
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
Object.defineProperty(globalThis, 'getComputedStyle', { value: window.getComputedStyle.bind(window), configurable: true })
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

const source = await readFile(join(projectRoot, 'client.js'), 'utf8')
window.__ModuleLoader__ = { load: (registration) => { globalThis.registration = registration } }
new Function('window', 'document', 'React', 'ReactDOM', source)(window, document, React, ReactDOM)
const plugin = globalThis.registration.factory((name) => (name === 'react' ? React : name === 'react-dom' ? ReactDOM : null))

const components = {}
let menu = null
const remote = { credentials: { set: async () => {}, unset: async () => {} } }
plugin.apply({
  effect: (fn) => fn(),
  locale: { register: () => () => {}, bind: () => (key) => key },
  slots: {
    inject: (_slot, fn) => fn(),
    register: (options, component) => {
      components[options.name + (options.id ? '#' + options.id : '')] = { def: options, comp: component }
      return () => {}
    },
  },
  contextMenus: { register: (config) => { menu = config; return () => {} } },
  remote,
})

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))
const ok = (data) => ({ ok: true, json: async () => ({ ok: true, data }) })

function rowsOf(container) {
  return [...container.querySelectorAll('button[role="switch"]')].map((button) => button.parentElement)
}

function rowOf(container, sourceKey) {
  return rowsOf(container).find((row) => row.textContent.includes(sourceKey))
}

function spansOf(container, text) {
  return [...container.querySelectorAll('span')].filter((span) => span.textContent === text)
}

function serve(routes) {
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    const body = init?.method === 'POST' ? JSON.parse(init.body) : null
    return ok(await routes(target, body))
  }
}

/** Mount a component and always clean up the portal, dialog state and root. */
async function mount(component, props) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  root.render(React.createElement(component, props))
  return async function cleanup() {
    const dialog = document.body.querySelector('div[role="dialog"]')
    if (dialog !== null) {
      const close = [...dialog.querySelectorAll('button')].find((button) => button.textContent === '✕')
      close?.click()
      await wait(100)
    }
    root.unmount()
    container.remove()
    await wait(50)
  }
}

function sessionPayload() {
  return {
    sessionId: 's1',
    workspaceId: 'w1',
    items: [
      { id: 'sv1', name: 'SHARED', source: 'session', envName: 'DSH_SECRET_SHARED', ref: 'DSH_VAR_SV1', enabled: true, available: true, set: true, redaction: 'auto' },
      { id: 'g1', name: 'SHARED', source: 'global', envName: 'DSH_SECRET_SHARED', ref: 'DSH_VAR_G1', enabled: true, available: true, set: true, redaction: 'auto', overridden: true, overriddenBy: 'session' },
    ],
    enabledCount: 1,
    total: 2,
  }
}

function workspacePayload(overridden) {
  return {
    workspaceId: 'w1',
    globals: [{
      id: 'g1', name: 'SHARED', availability: 'all', enabledByDefault: true, forceRedact: false,
      override: null, effective: true, ref: 'DSH_VAR_G1', envName: 'DSH_SECRET_SHARED', set: true, redaction: 'auto',
      ...(overridden ? { overridden: true, overriddenBy: 'workspace' } : {}),
    }],
    variables: [{
      id: 'wv1', name: 'SHARED', enabledByDefault: true, forceRedact: false,
      override: null, effective: true, ref: 'DSH_VAR_WV1', envName: 'DSH_SECRET_SHARED', set: true, redaction: 'auto',
    }],
  }
}

test('T-UI1 the session view renders the winner and marks the overridden definition', async (t) => {
  serve(async (target) => {
    if (target.includes('op=session')) return sessionPayload()
    if (target.includes('op=workspaces')) return { workspaces: [{ id: 'w1', title: 'dsh' }] }
    return {}
  })
  const view = components['conversation.view#secret-variables']
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { root.unmount(); container.remove() })
  root.render(React.createElement(view.comp, { ...view.def.inject(), sessionId: 's1' }))
  await wait(400)

  const badges = spansOf(container, 'field.overridden')
  assert.equal(badges.length, 1, 'exactly one overridden row')
  const overriddenRow = badges[0].parentElement
  assert.equal(overriddenRow.style.opacity, '0.6')
  assert.equal(overriddenRow.querySelector('button[role="switch"]').disabled, true, 'overridden switch is disabled')

  const winnerRow = rowOf(container, 'source.session')
  assert.equal(winnerRow.style.opacity, '')
  assert.equal(winnerRow.querySelector('button[role="switch"]').disabled, false)

  // "Only enabled" hides the overridden row.
  const filter = [...container.querySelectorAll('input[type="checkbox"]')]
    .find((input) => input.parentElement?.textContent?.includes('state.enabledOnly'))
  Simulate.change(filter, { target: { checked: true } })
  await wait(150)
  assert.equal(spansOf(container, 'field.overridden').length, 0)
})

test('T-UI2 turning the session definition off falls back to the project definition', async (t) => {
  const snapshot = {
    version: 1,
    globals: [],
    workspaces: { w1: { overrides: {}, variables: [{ id: 'wv1', name: 'SHARED', enabledByDefault: true, forceRedact: false, createdAt: 2 }] } },
    sessions: { s1: { overrides: {}, variables: [{ id: 'sv1', name: 'SHARED', enabledByDefault: true, forceRedact: false, createdAt: 3 }] } },
  }
  const store = { async read() { return snapshot }, async write() {} }
  const valuesMap = new Map([['DSH_VAR_SV1', 'session-value'], ['DSH_VAR_WV1', 'project-value']])
  const values = {
    ref: (id) => `DSH_VAR_${id.toUpperCase()}`,
    async resolve(ref) { return valuesMap.get(ref) },
    async set(ref, value) { valuesMap.set(ref, value) },
    async unset(ref) { valuesMap.delete(ref) },
    async describe(refs) { return Object.fromEntries(refs.map((ref) => [ref, { configured: valuesMap.has(ref), writable: true }])) },
  }
  const service = createSecretVariables({ store, values, resolveWorkspaceId: () => 'w1', now: () => 1, newId: () => 'n' })
  serve(async (target, body) => {
    if (body !== null && body.op === 'setSessionOverride') {
      await service.setSessionOverride('s1', body.variableId, body.enabled)
      return {}
    }
    if (target.includes('op=session')) return service.getSession('s1')
    if (target.includes('op=workspaces')) return { workspaces: [{ id: 'w1', title: 'dsh' }] }
    return {}
  })
  const view = components['conversation.view#secret-variables']
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { root.unmount(); container.remove() })
  root.render(React.createElement(view.comp, { ...view.def.inject(), sessionId: 's1' }))
  await wait(400)

  assert.equal(spansOf(container, 'field.overridden').length, 1)
  assert.equal((await service.envOverlay('s1')).DSH_SECRET_SHARED, 'session-value')

  Simulate.click(rowOf(container, 'source.session').querySelector('button[role="switch"]'))
  await wait(500)

  assert.equal(spansOf(container, 'field.overridden').length, 0, 'no row is covered anymore')
  const projectRow = rowOf(container, 'source.workspace')
  assert.equal(projectRow.querySelector('button[role="switch"]').getAttribute('aria-checked'), 'true')
  assert.equal(projectRow.querySelector('button[role="switch"]').disabled, false)
  assert.equal((await service.envOverlay('s1')).DSH_SECRET_SHARED, 'project-value')
})

test('T-UI3 the project dialog marks and disables the overridden global row', async (t) => {
  serve(async (target) => {
    if (target.includes('op=workspace&')) return workspacePayload(true)
    if (target.includes('op=workspaces')) return { workspaces: [{ id: 'w1', title: 'dsh' }] }
    return {}
  })
  const overlay = components['shell.overlay#secret-variables.workspace']
  const cleanup = await mount(overlay.comp, overlay.def.inject())
  t.after(cleanup)
  await wait(200)
  menu.resolve({ workspaceId: 'w1', displayTitle: 'dsh' })[0].run()
  await wait(400)

  const dialog = document.body.querySelector('div[role="dialog"]')
  assert.ok(dialog, 'dialog opened')
  const badges = spansOf(dialog, 'field.overridden')
  assert.equal(badges.length, 1)
  const globalRow = badges[0].parentElement
  assert.equal(globalRow.style.opacity, '0.6')
  assert.equal(globalRow.querySelector('button[role="switch"]').disabled, true)
  const projectRow = rowOf(dialog, 'source.workspace')
  assert.equal(projectRow.querySelector('button[role="switch"]').disabled, false)
})

test('T-UI4 the project dialog leaves the global row unmarked without an override', async (t) => {
  serve(async (target) => {
    if (target.includes('op=workspace&')) return workspacePayload(false)
    if (target.includes('op=workspaces')) return { workspaces: [{ id: 'w1', title: 'dsh' }] }
    return {}
  })
  const overlay = components['shell.overlay#secret-variables.workspace']
  const cleanup = await mount(overlay.comp, overlay.def.inject())
  t.after(cleanup)
  await wait(200)
  menu.resolve({ workspaceId: 'w1', displayTitle: 'dsh' })[0].run()
  await wait(400)

  const dialog = document.body.querySelector('div[role="dialog"]')
  assert.ok(dialog, 'dialog opened')
  assert.equal(spansOf(dialog, 'field.overridden').length, 0)
  assert.equal(rowsOf(dialog).every((row) => row.querySelector('button[role="switch"]').disabled === false), true)
})
