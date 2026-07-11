const ANSI_PATTERN = /\x1b\[[0-9;]*m/g

function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, '')
}

function parseJsonCandidate(candidate) {
  try {
    const parsed = JSON.parse(candidate)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.error || parsed.code || (parsed.type && (parsed.message || parsed.detail))) {
      return parsed
    }
  } catch {
    // CLI output is often JSONL mixed with human-readable lines.
  }
  return null
}

/**
 * Extract the last structured error object from OpenCode JSONL or stderr.
 * This intentionally returns null for plain text so the classifier can mark
 * the result as unverified instead of guessing an account/quota failure.
 */
export function parseStructuredOpenCodeError(text = '') {
  const normalized = stripAnsi(String(text))
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    const direct = parseJsonCandidate(line)
    if (direct) return direct

    const start = line.indexOf('{')
    const end = line.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const embedded = parseJsonCandidate(line.slice(start, end + 1))
      if (embedded) return embedded
    }
  }

  return null
}

export function getStructuredHttpStatus(body) {
  const candidates = [
    body?.http_status,
    body?.httpStatus,
    body?.status,
    body?.statusCode,
    body?.error?.http_status,
    body?.error?.httpStatus,
    body?.error?.status,
    body?.error?.statusCode,
  ]
  return candidates.find((value) => Number.isInteger(value)) ?? null
}
