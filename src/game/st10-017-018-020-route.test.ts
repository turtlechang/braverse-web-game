import { describe, expect, it } from 'vitest'
import { parseTestStateConfig } from './demo'

describe('ST10-017 to ST10-020 local original-card Browser routes', () => {
  it.each([
    ['ST10-017', 'positive'],
    ['ST10-017', 'skip-target'],
    ['ST10-017', 'no-purple-payment'],
    ['ST10-018', 'positive'],
    ['ST10-018', 'skip-target'],
    ['ST10-018', 'no-lv3'],
    ['ST10-018', 'no-purple-payment'],
  ] as const)('routes %s %s through the local trap fixture', (cardNumber, scenario) => {
    const route = `?test-state=st10-trap:${cardNumber}:${scenario}`
    expect(parseTestStateConfig(route, 'localhost')).toEqual({
      kind: 'st10-trap', cardNumber, scenario,
    })
    expect(parseTestStateConfig(route, 'example.com')).toBeNull()
  })

  it.each(['positive', 'no-target', 'no-purple-payment'] as const)(
    'routes ST10-020 %s through the local stage fixture', scenario => {
      const route = `?test-state=st10-stage:${scenario}`
      expect(parseTestStateConfig(route, 'localhost')).toEqual({ kind: 'st10-stage', scenario })
      expect(parseTestStateConfig(route, 'example.com')).toBeNull()
    },
  )

  it('rejects a recovery fixture that the ST10-017 card cannot have', () => {
    expect(parseTestStateConfig('?test-state=st10-trap:ST10-017:no-lv3', 'localhost')).toBeNull()
  })
})
