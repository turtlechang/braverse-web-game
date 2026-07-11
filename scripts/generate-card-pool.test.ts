import { describe, expect, it } from 'vitest'
import {
  createGeneratedPoolSource,
  isGeneratedCardPoolCurrent,
} from './generate-card-pool'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('generated card pool registry', () => {
  it('creates deterministic sorted imports', () => {
    const source = createGeneratedPoolSource([
      'official-a.json',
      'official-z.json',
    ])

    expect(source.indexOf('official-a.json')).toBeLessThan(
      source.indexOf('official-z.json'),
    )
    expect(source).toContain('official_a_json_0')
    expect(source).toContain('official_z_json_1')
  })

  it('detects missing and stale registries without writing files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'braverse-card-pool-'))
    const outputPath = join(directory, 'generated-card-pool.ts')
    try {
      writeFileSync(join(directory, 'official-a.json'), '{}', 'utf8')
      expect(isGeneratedCardPoolCurrent(directory, outputPath)).toBe(false)

      writeFileSync(
        outputPath,
        createGeneratedPoolSource(['official-a.json']),
        'utf8',
      )
      expect(isGeneratedCardPoolCurrent(directory, outputPath)).toBe(true)

      writeFileSync(join(directory, 'official-b.json'), '{}', 'utf8')
      expect(isGeneratedCardPoolCurrent(directory, outputPath)).toBe(false)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
