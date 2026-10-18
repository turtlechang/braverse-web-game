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
  return required(document.cards.find(card => card.cardNumber === 'ST9-017'), 'original Revelation of the Seas')
}

const raw = getCardPoolEntry('ST9-017') ?? readCandidate()

const expectedEffects = (): CardEffect[] => [
  {
    kind: 'modify-attack',
    amount: -3,
    duration: 'this-turn',
    target: { side: 'opponent', min: 0, max: 1 },
  },
  {
    kind: 'draw-up-to',
    max: 2,
    condition: { kind: 'hand-count-at-most', count: 3 },
  },
]

const expectedRuntime = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'trap') throw Error('Revelation of the Seas must be an original Trap')
  const effects = expectedEffects()
  card.trap = {
    text: required(raw.skill.text, 'printed effect text'),
    cost: { energy: { blue: 3 }, discardHand: 0 },
    effects,
  }
  card.effects = structuredClone(effects)
  return card
}

describe('ST9-017 original Revelation of the Seas precise conversion', () => {
  it('keeps the original blue Trap identity, art, BBB cost, and optional -3', () => {
    const result = convertOfficialCardToGameCard(raw, 'st9-017-contract')
    if (result.status !== 'converted' || result.gameCard.type !== 'trap') throw Error('ST9-017 must convert to Trap')
    const card = result.gameCard
    if (!card.trap) throw Error('ST9-017 must keep its Trap ability')
    expect([card.id, card.name, card.type, card.energyColor]).toEqual([
      'ST9-017', 'Revelation of the Seas', 'trap', 'blue',
    ])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(card.trap.cost).toEqual({ energy: { blue: 3 }, discardHand: 0 })
    expect(card.trap.effects).toEqual(expectedEffects())
    expect(card.effects).toEqual(expectedEffects())
    expect(card.item ?? card.skill ?? card.flip ?? card.stageAbility).toBeUndefined()
  })

  it('gates only the Then draw at hand size three or fewer', () => {
    expect(expectedEffects()[1]).toEqual({
      kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 3 },
    })
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
  })
})
