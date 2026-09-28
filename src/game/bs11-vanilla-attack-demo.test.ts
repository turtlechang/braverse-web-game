import { describe, expect, it } from 'vitest'
import { createBs11VanillaAttackDemoState, parseTestStateConfig } from './demo'

const cases = [
  ['BS11-001', 1, 1],
  ['BS11-004', 3, 4],
  ['BS11-022', 3, 4],
  ['BS11-023', 1, 1],
  ['BS11-037', 3, 4],
  ['BS11-102', 2, 2],
] as const

describe('BS11 mixed-colour neutral attack fixtures', () => {
  it.each(cases)('%s keeps printed payment and damage with a one-card shortfall', (cardNumber, cost, damage) => {
    expect(parseTestStateConfig(`?test-state=bs11-vanilla-attack:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-vanilla-attack', cardNumber, payable: true })
    const positive = createBs11VanillaAttackDemoState(cardNumber, true)
    const negative = createBs11VanillaAttackDemoState(cardNumber, false)
    const source = positive.players['player-one'].battleArea.find((entry) => entry.card.id === cardNumber)?.card
    expect(source?.type).toBe('cookie')
    if (source?.type !== 'cookie') throw new Error(`${cardNumber} must be a Cookie`)
    expect(source.attackEnergyCost?.neutral).toBe(cost)
    expect(source.attack).toBe(damage)
    expect(positive.players['player-one'].supportArea).toHaveLength(cost)
    expect(negative.players['player-one'].supportArea).toHaveLength(cost - 1)
    expect(new Set(positive.players['player-one'].supportArea.map((entry) => entry.card.energyColor)).size)
      .toBe(cost)
  })
})
