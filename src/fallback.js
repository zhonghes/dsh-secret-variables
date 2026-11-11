/**
 * Credential-format detection, ported from the shipped Web display matcher
 * (`@deepseek-ai/dsh-client-ui-secret-mask`, MIT) whose table is published only
 * inside a browser bundle. The formats and length bounds follow that table; the
 * scanner reports ranges instead of masks so the Host can replace them with a
 * reference.
 * @module secret-variables/fallback
 */

/** One recognized credential format. */
const PATTERNS = [
  { format: 'private-key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gu },
  { format: 'url-password', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@?#]+:[^\s/@?#]+@[^\s/?#]+/giu },
  { format: 'provider-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/gu, requireDigit: true },
  { format: 'google-key', pattern: /\bAIza[A-Za-z0-9_-]{35}\b/gu },
  { format: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36}\b/gu },
  { format: 'github-pat', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/gu },
  { format: 'gitlab-token', pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/gu },
  { format: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/gu },
  { format: 'huggingface-token', pattern: /\bhf_[A-Za-z0-9]{30,}\b/gu },
  { format: 'aws-key-id', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { format: 'aliyun-key', pattern: /\bLTAI[A-Za-z0-9]{12,20}\b/gu },
  { format: 'tencent-key', pattern: /\bAKID[A-Za-z0-9]{28,36}\b/gu },
  { format: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{8,}\b/gu },
  { format: 'payment-key', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/gu },
  { format: 'webhook-secret', pattern: /\bwhsec_[A-Za-z0-9]{24,}\b/gu },
  { format: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu },
]

/**
 * Scan text for credential-shaped runs.
 * @param {string} text - candidate text.
 * @returns {Array<{ start: number, end: number, format: string, value: string }>} non-overlapping hits ordered by position.
 */
export function scanCredentials(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const hits = []
  for (const { format, pattern, requireDigit } of PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1
        continue
      }
      if (requireDigit === true && !/[0-9]/u.test(match[0])) continue
      hits.push({ start: match.index, end: match.index + match[0].length, format, value: match[0] })
    }
  }
  hits.sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start))
  const kept = []
  let cursor = 0
  for (const hit of hits) {
    if (hit.start < cursor) continue
    kept.push(hit)
    cursor = hit.end
  }
  return kept
}

/**
 * Replace every occurrence of known secret values with its reference.
 * Longer values win so a value that contains another value is masked as one run.
 * @param {string} text - candidate text.
 * @param {ReadonlyArray<{ value: string, ref: string }>} pairs - known value/reference pairs.
 * @returns {{ text: string, changed: boolean }} replaced text.
 */
export function replaceValues(text, pairs) {
  const ordered = [...pairs].filter((pair) => pair.value.length > 0).sort((left, right) => right.value.length - left.value.length)
  let out = text
  for (const pair of ordered) {
    if (out.includes(pair.value)) out = out.split(pair.value).join(pair.ref)
  }
  return { text: out, changed: out !== text }
}
