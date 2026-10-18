import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import type { CardEffect, NonCookieCard, StageAbility } from '../game/types'
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
  return required(document.cards.find(card => card.cardNumber === 'ST8-020'), 'candidate Dark Enchantress Laboratory')
}

const raw = getCardPoolEntry('ST8-020') ?? readCandidate()

const expectedEffects = (): CardEffect[] => [
  { kind: 'stage-source-to-trash' },
  { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
]

const expectedStageAbility = (): StageAbility => ({
  placementCost: { green: 1 },
  cost: { energy: {}, discardHand: 0 },
  text: required(raw.skill.text, 'printed effect text'),
  effects: expectedEffects(),
  restSource: false,
  endPhase: true,
  endPhaseScope: 'your-turn',
})

const converted = (): NonCookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st8-020-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'stage') {
    throw Error('Dark Enchantress Laboratory must convert to Stage')
  }
  return result.gameCard
}

const expectedRuntime = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'stage') throw Error('Dark Enchantress Laboratory must be an original Stage')
  const ability = expectedStageAbility()
  card.stageAbility = ability
  card.effectText = ability.text
  card.effects = structuredClone(ability.effects)
  return card
}

describe('ST8-020 original Dark Enchantress Laboratory precise conversion', () => {
  it('keeps the original identity and converts G placement into a turn-end cleanup and optional readying', () => {
    const card = converted()
    expect([card.id, card.name, card.type, card.energyColor]).toEqual([
      'ST8-020', 'Dark Enchantress Laboratory', 'stage', 'green',
    ])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(card.stageAbility).toEqual(expectedStageAbility())
    expect(card.effects).toEqual(expectedEffects())
  })

  it('matches the printed behavior contract against the converted runtime', () => {
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
    expect(analyze(raw, converted()).contract.status).toBe('verified')
  })
})
