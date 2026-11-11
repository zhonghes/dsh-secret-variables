import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const client = await readFile(join(root, 'client.js'), 'utf8')
const zh = JSON.parse(await readFile(join(root, 'locale', 'zh.json'), 'utf8'))
const en = JSON.parse(await readFile(join(root, 'locale', 'en.json'), 'utf8'))

test('T-U1 the client injects the nested credential namespace it reads', () => {
  assert.match(client, /inject:\s*\[[^\]]*'remote\.credentials'/u)
  assert.match(client, /inject:\s*\[[^\]]*'remote'/u)
})

test('T-U2 the session View registration survives, the header quick entry is gone', () => {
  assert.match(client, /name:\s*'conversation\.view'[\s\S]{0,80}id:\s*'secret-variables'/u)
  assert.equal(client.includes("'conversation.session.header.utilities'"), false)
  assert.equal(client.includes('QuickButton'), false)
})

test('T-U3 creating a variable writes its value in the same step', () => {
  assert.match(client, /remote\.credentials\.set\(ref, value\)/u)
  assert.match(client, /op:\s*'addGlobal'/u)
  assert.match(client, /op:\s*'addWorkspaceVar'/u)
  assert.match(client, /op:\s*'addSessionVar'/u)
})

test('T-U4 entries are named Secrets (密钥)', () => {
  assert.equal(zh.meta.title, '密钥管理')
  assert.equal(en.meta.title, 'Secrets')
  assert.equal(zh.panel.title, '密钥管理')
  assert.equal(en.view.title, 'Secrets')
  assert.equal('quick' in zh, false)
  assert.equal('quick' in en, false)
})

test('T-U5 the client dictionaries name every scope and source', () => {
  for (const dictionary of [zh, en]) {
    for (const key of ['panel', 'view', 'scope', 'source']) assert.ok(key in dictionary, key)
    for (const source of ['global', 'workspace', 'session', 'auto']) assert.ok(source in dictionary.source, source)
  }
})

test('T-U6 every add form sends its creation-time enable flag', () => {
  for (const op of ['addGlobal', 'addWorkspaceVar', 'addSessionVar']) {
    const call = client.slice(client.indexOf("op: '" + op + "'"), client.indexOf("op: '" + op + "'") + 220)
    assert.ok(call.includes('enabledByDefault'), op)
  }
  assert.match(client, /field\.enabled/u)
})

test('T-U7 the session page groups variables into four sections', () => {
  const order = ['session', 'workspace', 'global', 'auto']
  for (const dictionary of [zh, en]) {
    assert.deepEqual(Object.keys(dictionary.group), order)
  }
  assert.match(client, /const GROUPS = \['session', 'workspace', 'global', 'auto'\]/u)
  assert.match(client, /t\('group\.' \+ group\.source\)/u)
})

test('T-U8 the session view edits values only for session variables', () => {
  assert.match(client, /canEditValue: item\.source === 'session'/u)
  assert.match(client, /hint\.editUpstream/u)
})

test('T-U9 the project dialog edits values only for project variables', () => {
  assert.match(client, /canEditValue: row\.item\.source === 'workspace'/u)
  assert.match(client, /hint\.editUpstream': '请在所属页修改'/u)
})

test('T-U10 the project dialog groups project and global variables', () => {
  assert.match(client, /const PROJECT_GROUPS = \['workspace', 'global'\]/u)
  assert.match(client, /PROJECT_GROUPS\n\s+\.map\(\(source\)/u)
})

test('T-U11 the global form picks its availability from a dropdown', () => {
  assert.match(client, /function ScopeSelect\(/u)
  assert.match(client, /const \[scope, setScope\] = React\.useState\(\{ all: true, ids: \[\] \}\)/u)
  assert.match(client, /availability: scope\.all \? 'all' : \[\.\.\.scope\.ids\]/u)
  assert.match(client, /'data-secret-scope-menu'/u)
  assert.equal(client.includes('scope.needOne'), false)
})

test('T-U11b picking a project clears 全部项目 and the last one falls back', () => {
  const body = /function nextScope\(scope, id\) \{[\s\S]*?\n    \}/u.exec(client)?.[0] ?? ''
  assert.ok(body.includes('ids.length === 0 ? { all: true, ids: [] }'), body)
  assert.match(client, /checked: scope\.all/u)
  assert.match(client, /onChange\(\{ all: true, ids: \[\] \}\)/u)
  assert.match(client, /onChange: \(\) => onChange\(nextScope\(scope, workspace\.id\)\)/u)
})

test('T-U12 editing keeps the read row in place and can move a global scope', () => {
  assert.match(client, /action\.cancel/u)
  assert.equal(client.includes('S.rowEdit'), false)
  // read view and edit view both use the same five-column row grid
  assert.equal((client.match(/style: S\.row \}/gu) ?? []).length >= 2, true)
  assert.match(client, /compact: true/u)
  assert.match(client, /availability: next\.availability/u)
  assert.match(client, /t\('action\.save'\)\),\s*h\(Button, \{ onClick: cancel/u)
})

test('T-U13 every client portal passes its container (white-screen guard)', () => {
  const portals = client.match(/ReactDOM\.createPortal\(/gu) ?? []
  const containers = client.match(/document\.body/gu) ?? []
  assert.equal(portals.length, 2)
  assert.equal(containers.length, 2)
})

test('T-U14 the client names a duplicate in the current language', () => {
  assert.match(client, /error\.duplicateName/u)
  assert.match(client, /function failureText\(t, error\)/u)
  assert.equal((client.match(/setFailure\(failureText\(t, error\)\)/gu) ?? []).length, 3)
})
