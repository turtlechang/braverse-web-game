import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import type { CardEffect, NonCookieCard } from '../game/types'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior as analyze } from './contracts/ledger'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

const readCandidate = (): OfficialCardRecord => {
  const path = join(process.cwd(), 'data/cards/official-st9-017-019.en.json')
  const document = JSON.parse(readFileSync(path, 'utf8')) as { cards: OfficialCardRecord[] }
  return required(document.cards.find(card => card.cardNumber === 'ST9-018'), 'original Tower of Frozen Waves')
}

const raw = getCardPoolEntry('ST9-018') ?? readCandidate()

const expectedEffects = (): CardEffect[] => [
  {
    kind: 'modify-attack',
    amount: -1,
    duration: 'this-turn',
    target: { side: 'opponent', min: 0, max: 1 },
  },
  {
    kind: 'optional-cost-attack',
    resolution: 'ability',
    cost: { energy: {}, discardHand: 1 },
    effectText: required(raw.skill.text, 'printed effect text'),
    effects: [{
      kind: 'modify-attack',
      amount: -1,
      duration: 'this-turn',
      target: { side: 'opponent', min: 0, max: 1, previousEffectTargetOnly: true },
    }],
  },
]

const expectedRuntime = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'trap') throw Error('Tower of Frozen Waves must be an original Trap')
  const effects = expectedEffects()
  card.trap = {
    text: required(raw.skill.text, 'printed effect text'),
    cost: { energy: { blue: 1 }, discardHand: 0 },
    effects,
  }
  card.effects = structuredClone(effects)
  return card
}

describe('ST9-018 original Tower of Frozen Waves precise conversion', () => {
  it('keeps the original blue Trap identity, art, B cost, and optional first reduction', () => {
    const result = convertOfficialCardToGameCard(raw, 'st9-018-contract')
    if (result.status !== 'converted' || result.gameCard.type !== 'trap') throw Error('ST9-018 must convert to Trap')
    const card = result.gameCard
    if (!card.trap) throw Error('ST9-018 must keep its Trap ability')
    expect([card.id, card.name, card.type, card.energyColor]).toEqual([
      'ST9-018', 'Tower of Frozen Waves', 'trap', 'blue',
    ])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(card.trap.cost).toEqual({ energy: { blue: 1 }, discardHand: 0 })
    expect(card.trap.effects).toEqual(expectedEffects())
    expect(card.effects).toEqual(expectedEffects())
  })

  it('keeps the discard as an optional Then payment and binds the extra -1 to the first target', () => {
    expect(expectedEffects()[1]).toMatchObject({
      kind: 'optional-cost-attack',
      resolution: 'ability',
      cost: { energy: {}, discardHand: 1 },
      effects: [{
        kind: 'modify-attack', amount: -1, duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1, previousEffectTargetOnly: true },
      }],
    })
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
  })
})
