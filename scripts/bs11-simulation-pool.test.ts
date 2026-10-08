import { writeFileSync, mkdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { runSwissTournament } from '../src/game/tournament'
import { generateRoster } from './generate-bs11-1024-roster'
import { Bs11SimulationPool } from './lib/bs11-simulation-pool'

describe('isolated Swiss simulation', () => {
  it('has the same actual match results and rankings as serial execution', async () => {
    const decks = generateRoster(6)
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness: ' + new Error().stack) })
    const options = { rounds: 2, seed: 20260930, aiLevel: 5 as const, maxActions: 500, experienceProfile: null, deterministicSearch: true, avoidRematches: true }
    const serialLogs: unknown[] = []
    const parallelLogs: unknown[] = []
    const serial = await runSwissTournament(decks, { ...options, onMatch: ({result}) => { serialLogs.push(result?.logs) } })
    const pool = new Bs11SimulationPool(2)
    try {
      const parallel = await runSwissTournament(decks, { ...options, simulateRound: (inputs) => pool.simulateRound(inputs), onMatch: ({result}) => { parallelLogs.push(result?.logs) } })
      mkdirSync('test-results/bs11-1024', {recursive:true})
      writeFileSync('test-results/bs11-1024/pool-comparison.json', JSON.stringify({serialLogs, parallelLogs}, null, 2))
      expect(parallel.status).toBe('PASS')
      expect(serial.status).toBe('PASS')
      expect(parallel.matches).toEqual(serial.matches)
      expect(parallel.standings).toEqual(serial.standings)
      expect(parallel.metrics).toEqual(serial.metrics)
    } finally { randomSpy.mockRestore(); await pool.close() }
  }, 60000)
  it('rejects incomplete worker outcomes', async () => {
    await expect(runSwissTournament(generateRoster(6), { rounds: 1, simulateRound: async () => [] }))
      .rejects.toThrow('incomplete outcome')
  })
})
