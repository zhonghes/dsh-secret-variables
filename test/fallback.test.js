import test from 'node:test'
import assert from 'node:assert/strict'
import { replaceValues, scanCredentials } from '../src/fallback.js'

const positiveSamples = [
  ['provider key', 'key sk-proj-ABCDEF1234567890abcdefXYZ'],
  ['google key', 'AIzaSyA1234567890abcdefghijklmnopqrstuv'],
  ['github token', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
  ['github pat', 'github_pat_11ABCDEFGabcdefghijklmnop'],
  ['gitlab token', 'glpat-abcdefghij1234567890'],
  ['npm token', 'npm_abcdefghijklmnopqrstuvwxyz0123456789'],
  ['huggingface token', 'hf_abcdefghijklmnopqrstuvwxyz1234'],
  ['aws key id', 'AKIAIOSFODNN7EXAMPLE'],
  ['aliyun key', 'LTAI4G1234567890abcd'],
  ['slack token', 'xoxb-1234567890-abcdefghij'],
  ['stripe key', 'sk_live_abcdefghijklmnop1234'],
  ['webhook secret', 'whsec_abcdefghijklmnopqrstuvwx'],
  ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
  ['pem block', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA1234567890\n-----END RSA PRIVATE KEY-----'],
  ['url password', 'postgres://user:supersecret@db.example.com:5432/app'],
]

for (const [label, text] of positiveSamples) {
  test(`T-F1 recognizes ${label}`, () => {
    const hits = scanCredentials(text)
    assert.ok(hits.length >= 1, `expected a hit in ${label}`)
    const [hit] = hits
    assert.ok(hit.end > hit.start)
    assert.ok(text.slice(hit.start, hit.end).length >= 8)
  })
}

test('T-F2 ordinary text is not a credential', () => {
  for (const text of ['use sk-learn for that', 'process.env.OPENAI_API_KEY', '$DSH_SECRET_OPENAI_API_KEY', 'hello world', 'token is short']) {
    assert.deepEqual(scanCredentials(text), [], text)
  }
})

test('T-F3 matches never overlap and are ordered', () => {
  const hits = scanCredentials('a sk-proj-ABCDEF1234567890abcdef b AKIAIOSFODNN7EXAMPLE c')
  assert.equal(hits.length, 2)
  assert.ok(hits[0].end <= hits[1].start)
})

test('T-F4 known values are replaced with their reference', () => {
  const { text, changed } = replaceValues('Authorization: Bearer abcdefSECRETvalue123', [
    { value: 'abcdefSECRETvalue123', ref: '$DSH_SECRET_OPENAI_API_KEY' },
  ])
  assert.equal(changed, true)
  assert.equal(text, 'Authorization: Bearer $DSH_SECRET_OPENAI_API_KEY')
})

test('T-F4b the longest known value wins', () => {
  const { text } = replaceValues('xxx abcdefabcdef yyy', [
    { value: 'abcdef', ref: '$DSH_SECRET_SHORT' },
    { value: 'abcdefabcdef', ref: '$DSH_SECRET_LONG' },
  ])
  assert.equal(text, 'xxx $DSH_SECRET_LONG yyy')
})

test('T-F6 scanning a megabyte stays fast', () => {
  const text = `${'lorem ipsum dolor sit amet '.repeat(40_000)}sk-proj-ABCDEF1234567890abcdef`
  const started = performance.now()
  const hits = scanCredentials(text)
  const elapsed = performance.now() - started
  assert.equal(hits.length, 1)
  assert.ok(elapsed < 400, `scan took ${elapsed}ms`)
})

test('T-F8 scanning is idempotent after replacement', () => {
  const { text } = replaceValues('sk-proj-ABCDEF1234567890abcdef', [{ value: 'nothing', ref: '$X' }])
  const hits = scanCredentials(text)
  assert.equal(hits.length, 1, 'raw secret still scanned once')
  const replaced = text.replace('sk-proj-ABCDEF1234567890abcdef', '$DSH_SECRET_AUTO_1')
  assert.deepEqual(scanCredentials(replaced), [])
})
