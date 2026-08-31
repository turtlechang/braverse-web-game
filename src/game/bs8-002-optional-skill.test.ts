import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  createDemoGame,
  getPendingDecision,
  type CookieCard,
  type GameCard,
  type GameState,
} from './index'
import {
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'

const formalPath = resolve(
  process.cwd(),
  'data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json',
)
const records = (
  JSON.parse(readFileSync(formalPath, 'utf8')) as { cards: OfficialCardRecord[] }
).cards

const convertedCookie = (cardNumber: string): CookieCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS8 card ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} conversion failed`)
  }
  return result.gameCard
}

const card = (instanceId: string, name = instanceId): GameCard => ({
  id: instanceId,
  instanceId,
  name,
  type: 'item',
  energyColor: 'red',
})

const createState = (): GameState => {
  const base = createDemoGame(8002)
  const source = { ...convertedCookie('BS8-002'), instanceId: 'bs8-002-source' }
  const opponent = { ...convertedCookie('BS8-006'), instanceId: 'bs8-002-opponent' }
  const sourceHp = card('bs8-002-source-hp')
  const opponentHp = card('bs8-002-opponent-hp')
  const gainCard = card('bs8-002-gain-card')
  const drawCard = card('bs8-002-draw-card')
  const postDrawCard = card('bs8-002-post-draw-card')
  const support = card('bs8-002-support')

  return {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    skillUsesThisTurn: [],
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{
          card: source,
          hpCards: [sourceHp],
          rested: false,
          battleEntryId: 'bs8-002-source-entry',
        }],
        hand: [],
        deck: [gainCard, drawCard, postDrawCard],
        supportArea: [{ card: support, rested: false }],
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [{
          card: opponent,
          hpCards: [opponentHp, card('bs8-002-opponent-hp-2')],
          rested: false,
          battleEntryId: 'bs8-002-opponent-entry',
        }],
      },
    },
  }
}

const beginAndResolveHp = (state: GameState): GameState => {
  let next = applyGameCommand(state, {
    kind: 'begin-activate-skill',
    playerId: 'player-one',
    sourceInstanceId: 'bs8-002-source',
    trigger: 'activate',
    paymentIds: [],
  })
  next = applyGameCommand(next, {
    kind: 'resolve-ability-effect',
    playerId: 'player-one',
    targetIds: ['bs8-002-source'],
  })
  return next
}

describe('BS8-002 optional skill Then', () => {
  it('opens a skill Then payment decision only after the conditional HP gain', () => {
    const state = beginAndResolveHp(createState())

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.pendingOptionalCostAttack).toMatchObject({
      resolution: 'ability',
      sourceInstanceId: 'bs8-002-source',
      cost: { energy: { red: 1 }, discardHand: 0 },
    })
    expect(state.pendingOptionalCostAttack?.sourceEnergy).toBeUndefined()
    expect(state.pendingDrawUpTo).toBeUndefined()
    expect(getPendingDecision(state)).toMatchObject({
      kind: 'optional-cost-attack',
      resolution: 'ability',
    })
  })

  it('lets the player skip the full Then without drawing or damaging', () => {
    const state = beginAndResolveHp(createState())
    const skipped = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'skip',
    })

    expect(skipped.pendingOptionalCostAttack).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.players['player-one'].hand).toHaveLength(0)
    expect(skipped.players['player-one'].deck).toHaveLength(2)
    expect(skipped.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('uses the source Cookie as red energy, then resumes draw and optional damage target selection', () => {
    const state = beginAndResolveHp(createState())
    const paid = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: ['bs8-002-support'],
      targetIds: [],
    })

    expect(paid.pendingOptionalCostAttack).toBeNull()
    expect(paid.pendingAbilityEffect).toMatchObject({ effectIndex: 1 })
    expect(paid.pendingAbilityEffect?.effects[1]).toMatchObject({
      kind: 'draw-up-to',
      max: 1,
    })

    const drawing = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(drawing.pendingDrawUpTo).toMatchObject({ max: 1 })
    const drawn = applyGameCommand(drawing, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(drawn.players['player-one'].hand).toHaveLength(1)
    expect(drawn.pendingAbilityEffect).toMatchObject({ effectIndex: 2 })

    const damaged = applyGameCommand(drawn, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['bs8-002-opponent'],
    })
    expect(damaged.pendingAbilityEffect).toBeUndefined()
    expect(damaged.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(damaged.players['player-one'].supportArea[0].rested).toBe(true)
  })

  it('requires a red support payment for the optional skill Then', () => {
    const state = beginAndResolveHp(createState())

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-optional-cost-attack',
        playerId: 'player-one',
        action: 'pay',
        paymentIds: [],
      }),
    ).toThrowError(/能量支付無效/)
  })
})
