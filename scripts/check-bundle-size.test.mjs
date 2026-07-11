import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scriptPath = resolve(__dirname, 'check-bundle-size.mjs')

function run(args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf-8',
    cwd: resolve(__dirname, '..'),
  })
}

describe('check-bundle-size', () => {
  it('exits 0 when bundle is under budget (requires npm run build)', () => {
    const result = run()
    assert.strictEqual(result.status, 0)
    assert.match(result.stdout, /Bundle:/)
    assert.match(result.stdout, /OK/)
  })

  it('exits 1 when raw budget is exceeded', () => {
    const result = run(['--max-raw-kb', '1'])
    assert.notStrictEqual(result.status, 0)
    assert.match(result.stdout, /EXCEEDED/)
  })

  it('exits 1 when gzip budget is exceeded', () => {
    const result = run(['--max-gzip-kb', '1'])
    assert.notStrictEqual(result.status, 0)
    assert.match(result.stdout, /EXCEEDED/)
  })

  it('accepts custom budgets', () => {
    const result = run(['--max-raw-kb', '2000', '--max-gzip-kb', '500'])
    assert.strictEqual(result.status, 0)
    assert.match(result.stdout, /OK/)
  })
})
