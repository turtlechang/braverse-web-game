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
  if (value === null || value === undefined) throw Error(`Missing ${label}`)
  return value
}

const readCandidate = (): OfficialCardRecord => {
  const path = join(process.cwd(), 'data/cards/official-st8-019-020.en.json')
  const document = JSON.parse(readFileSync(path, 'utf8')) as { cards: OfficialCardRecord[] }
  return required(document.cards.find(card => card.cardNumber === 'ST8-019'), 'candidate Bad Omen')
}

const raw = getCardPoolEntry('ST8-019') ?? readCandidate()

const converted = (): NonCookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st8-019-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'trap') {
    throw Error('Bad Omen must convert to Trap')
  }
  return result.gameCard
}

const expectedEffects = (): CardEffect[] => [{
  kind: 'modify-attack',
  amount: -2,
  duration: 'this-turn',
  target: { side: 'opponent', min: 0, max: 1 },
  thenEffects: [{
    kind: 'modify-attack',
    amount: -1,
    duration: 'this-turn',
    target: { side: 'opponent', min: 0, max: 1, previousEffectTargetOnly: true },
    condition: { kind: 'support-count-equal' },
  }],
}]

const expectedRuntime = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'trap') throw Error('Bad Omen must be an original Trap')
  const effects = expectedEffects()
  card.trap = {
    text: required(raw.skill.text, 'printed effect text'),
    cost: { energy: { green: 2 }, discardHand: 0 },
    effects,
  }
  card.effects = structuredClone(effects)
  return card
}

describe('ST8-019 original Bad Omen precise conversion', () => {
  it('keeps the original identity, art, GG payment, and same-target conditional Then', () => {
    const card = converted()
    expect([card.id, card.name, card.type, card.energyColor]).toEqual([
      'ST8-019', 'Bad Omen', 'trap', 'green',
    ])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(card.trap?.cost).toEqual({ energy: { green: 2 }, discardHand: 0 })
    expect(card.trap?.effects).toEqual(expectedEffects())
    expect(card.effects).toEqual(expectedEffects())
  })

  it('matches the printed behavior contract against the converted runtime', () => {
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
    expect(analyze(raw, converted()).contract.status).toBe('verified')
  })
})
