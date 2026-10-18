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
  const path = join(process.cwd(), 'data/cards/official-st9-020.en.json')
  const document = JSON.parse(readFileSync(path, 'utf8')) as { cards: OfficialCardRecord[] }
  return required(document.cards.find(card => card.cardNumber === 'ST9-020'), 'candidate Tearcrown')
}

const raw = getCardPoolEntry('ST9-020') ?? readCandidate()

const expectedEffects = (): CardEffect[] => [{
  kind: 'draw-up-to', max: 1,
  condition: { kind: 'hand-count-at-most', count: 3 },
}]

const expectedStageAbility = (): StageAbility => ({
  placementCost: { blue: 1 },
  cost: { energy: {}, discardHand: 0 },
  text: required(raw.skill.text, 'printed Stage ability text'),
  effects: expectedEffects(),
  restSource: true,
  allowInactiveConditionalEffects: true,
})

const converted = (): NonCookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st9-020-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'stage') {
    throw Error('Tearcrown must convert to Stage')
  }
  return result.gameCard
}

const expectedRuntime = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'stage') throw Error('Tearcrown must be an original Stage')
  const ability = expectedStageAbility()
  card.stageAbility = ability
  card.effectText = ability.text
  card.effects = structuredClone(ability.effects)
  return card
}

describe('ST9-020 original Tearcrown precise conversion', () => {
  it('keeps the original identity and converts blue placement plus the rested low-hand draw', () => {
    const card = converted()
    expect([card.id, card.name, card.type]).toEqual(['ST9-020', 'Tearcrown', 'stage'])
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(card.stageAbility).toEqual(expectedStageAbility())
    expect(card.effects).toEqual(expectedEffects())
    expect(card.stageAbility?.endPhase).toBeUndefined()
    expect(card.stageAbility?.oncePerTurn).toBeUndefined()
  })

  it('matches the printed behavior contract against the converted runtime', () => {
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
    expect(analyze(raw, converted()).contract.status).toBe('verified')
  })

  it('allows the printed Activate cost when the conditional draw is skipped', () => {
    expect(converted().stageAbility?.allowInactiveConditionalEffects).toBe(true)
  })
})
