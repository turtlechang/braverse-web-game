import { describe, expect, it } from 'vitest'
import type { GameCard } from '../../game'
import type { OfficialCardRecord } from '../types'
import { compileCardBehaviorContract } from './compiler'

const source: OfficialCardRecord = {
  sourceId: 2,
  locale: 'en',
  cardNumber: 'CONTRACT-002',
  baseCardNumber: 'CONTRACT-002',
  variant: null,
  name: 'Compiler Fixture',
  type: 'cookie',
  officialType: 'COOKIE',
  rarity: 'C',
  grade: 'COMMON',
  level: 1,
  hp: 2,
  energyType: 'RED',
  color: 'RED',
  skill: { name: 'Fixture', text: 'When this Cookie faints, <can be used as {R}.> Play up to 1 {R} Cookie from your trash.' },
  attackText: '<{R}> Attack {da} 1',
  flipText: null,
  keywords: [],
  product: { id: 2, title: 'Test', category: null },
  restrictions: { banned: false, limited: false },
  flags: { enabled: true, hidden: false, extra: false },
  imageUrl: 'https://example.invalid/compiler.webp',
  officialUpdatedAt: null,
  sourceUrl: 'https://example.invalid/cards.json',
}

const runtime: GameCard = {
  id: source.baseCardNumber,
  instanceId: `${source.baseCardNumber}:1`,
  name: source.name,
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 1,
  attackEnergyCost: { red: 1 },
  effects: [{
    kind: 'trash-to-battle',
    amount: 1,
    optional: true,
    energyColor: 'red',
    energyCost: { red: 1 },
  }],
}

describe('contract compiler bridge', () => {
  it('orders payment before target and resolution steps', () => {
    const compiled = compileCardBehaviorContract(source, runtime)
    expect(compiled.steps.map((step) => step.kind)).toEqual([
      'payment',
      'payment',
      'target',
      'resolve',
      'resolve',
    ])
    expect(compiled.executable).toBe(true)
  })

  it('does not mark a blocked contract executable', () => {
    const broken = {
      ...runtime,
      attackCost: 0,
      attackEnergyCost: {},
      effects: [{ kind: 'trash-to-battle', amount: 1, optional: true }] as GameCard['effects'],
    }
    const compiled = compileCardBehaviorContract(source, broken)
    expect(compiled.executable).toBe(false)
    expect(compiled.blockers).toContain('payment evidence missing')
  })
})
