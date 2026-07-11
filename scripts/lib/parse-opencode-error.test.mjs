import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getStructuredHttpStatus,
  parseStructuredOpenCodeError,
} from './parse-opencode-error.mjs'

describe('parseStructuredOpenCodeError', () => {
  it('extracts the last structured error from JSONL', () => {
    const result = parseStructuredOpenCodeError([
      JSON.stringify({ type: 'step-start' }),
      JSON.stringify({ type: 'error', error: { code: 'model_not_found', message: 'missing' } }),
    ].join('\n'))

    assert.equal(result.error.code, 'model_not_found')
  })

  it('extracts embedded JSON after CLI prefixes and ANSI codes', () => {
    const result = parseStructuredOpenCodeError(
      '\u001b[31mError:\u001b[0m {"error":{"status":402,"code":"billing_limit"}}',
    )

    assert.equal(getStructuredHttpStatus(result), 402)
  })

  it('returns null for unstructured text', () => {
    assert.equal(parseStructuredOpenCodeError('quota unavailable; try again later'), null)
  })
})
