import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { canActivateCookieSkill } from './skills'
import type { GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, instanceId = 'bs9-033-test'): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, instanceId)
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const sourceEntry = (state: GameState) => {
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS9-033',
  )
  if (!source) throw new Error('Missing BS9-033 source')
  return source
}

const withHandCount = (
  count: number,
  options: { includeFlip?: boolean } = {},
): GameState => {
  const base = createCardCheckDemoState('BS9-033')
  const includeFlip = options.includeFlip ?? true
  const flip = {
    ...candidate('BS9-032', 'bs9-033-flip-cost'),
    instanceId: 'bs9-033-flip-cost',
  }
  const fillerPool = [
    ...base.players['player-one'].hand,
    ...base.players['player-one'].deck,
  ].filter((card) => !card.flip)
  const hand = [
    ...(includeFlip ? [flip] : []),
    ...fillerPool.slice(0, count - (includeFlip ? 1 : 0)),
  ]
  const yellowSupport = {
    ...candidate('BS9-032', 'bs9-033-yellow-support'),
    instanceId: 'bs9-033-yellow-support',
  }
  return {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand,
        deck: fillerPool.slice(count - (includeFlip ? 1 : 0)),
        supportArea: [{ card: yellowSupport, rested: false }],
      },
    },
  }
}

describe('BS9-033 GingerBrave candidate', () => {
  it('converts both official arts with the printed Activate, payment, condition, and attack', () => {
    for (const cardNumber of ['BS9-033', 'BS9-033@1']) {
      const card = candidate(cardNumber)
      expect(card).toMatchObject({
        id: 'BS9-033',
        name: 'GingerBrave',
        level: 1,
        hp: 3,
        attack: 1,
        attackEnergyCost: { yellow: 2 },
        skill: {
          trigger: 'activate',
          oncePerTurn: true,
          cost: {
            energy: { yellow: 1 },
            discardHand: 1,
            discardHandHasFlip: true,
          },
          effects: [
            {
              kind: 'draw-up-to',
              max: 2,
              condition: { kind: 'hand-count-at-most', count: 6 },
            },
          ],
        },
      })
    }
  })

  it('evaluates the six-card threshold after discarding the FLIP cost', () => {
    const sevenCards = withHandCount(7)
    const source = sourceEntry(sevenCards)
    expect(canActivateCookieSkill(
      sevenCards,
      'player-one',
      source.card.instanceId,
      'activate',
    )).toBe(true)

    const eightCards = withHandCount(8)
    expect(canActivateCookieSkill(
      eightCards,
      'player-one',
      sourceEntry(eightCards).card.instanceId,
      'activate',
    )).toBe(false)
  })

  it('pays one yellow energy and exactly one FLIP card before offering draw 0–2', () => {
    const initial = withHandCount(7)
    const source = sourceEntry(initial)
    let state = applyGameCommand(initial, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: ['bs9-033-yellow-support'],
      discardHandIds: ['bs9-033-flip-cost'],
      targetIds: [],
    })
    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(state.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS9-032', instanceId: 'bs9-033-flip-cost' }),
    )
    expect(state.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 2,
      sourceCardName: 'GingerBrave',
    })
    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 2,
    })
    expect(state.players['player-one'].hand).toHaveLength(8)
    expect(state.skillUsesThisTurn).toContain(source.battleEntryId)
    expect(canActivateCookieSkill(
      state,
      'player-one',
      source.card.instanceId,
      'activate',
    )).toBe(false)
  })

  it('rejects a non-FLIP discard while keeping the printed resources visible', () => {
    const state = withHandCount(7, { includeFlip: false })
    const source = sourceEntry(state)
    expect(canActivateCookieSkill(
      state,
      'player-one',
      source.card.instanceId,
      'activate',
    )).toBe(false)
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: ['bs9-033-yellow-support'],
      discardHandIds: [state.players['player-one'].hand[0]!.instanceId],
      targetIds: [],
    })).toThrow()
  })

  it('provides isolated positive and negative localhost routes', () => {
    const positive = createCardCheckDemoState('BS9-033')
    const negative = createCardNegativeDemoState('BS9-033')
    expect(canActivateCookieSkill(
      positive,
      'player-one',
      sourceEntry(positive).card.instanceId,
      'activate',
    )).toBe(true)
    expect(canActivateCookieSkill(
      negative,
      'player-one',
      sourceEntry(negative).card.instanceId,
      'activate',
    )).toBe(false)
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-033', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-033', negative: false,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-card-negative:BS9-033@1',
      'localhost',
    )).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-033@1', negative: true,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-card:BS9-033',
      'braverse.example',
    )).toBeNull()
  })
})
