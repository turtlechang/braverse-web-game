import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { executeCardEffect, placeHandCardOnHp } from './effects'
import { advancePhase } from './turn'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-035-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

describe('BS9-035 Truthless Recluse candidate', () => {
  it('converts both arts with the printed Activate prevention and attack Then', () => {
    for (const cardNumber of ['BS9-035', 'BS9-035@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        id: 'BS9-035',
        name: 'Truthless Recluse',
        level: 3,
        hp: 5,
        attack: 3,
        attackEnergyCost: { yellow: 3 },
        skill: {
          trigger: 'activate',
          oncePerTurn: true,
          cost: { energy: {}, discardHand: 1 },
          effects: [{ kind: 'prevent-opponent-hp-gain' }],
        },
        attackEffects: [{
          kind: 'optional-cost-attack',
          cost: {
            energy: {},
            discardHand: 1,
            discardHandType: 'cookie',
            discardHandHasFlip: true,
          },
          effects: [{
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: {
              kind: 'break-area-card-count-at-least',
              side: 'self',
              count: 2,
            },
          }],
        }],
      })
    }
  })

  it('blocks only the opponent card-effect HP gain for the current turn', () => {
    const base = createCardCheckDemoState('BS9-033')
    const prevention = candidate('BS9-035').skill!.effects[0]!
    const protectedState = executeCardEffect(base, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'bs9-035-source',
    }, prevention, [])
    expect(protectedState.preventHpGainThisTurn).toEqual({ 'player-two': true })

    const opponent = protectedState.players['player-two'].battleArea[0]!
    const blocked = executeCardEffect(protectedState, {
      sourcePlayerId: 'player-two',
      sourceInstanceId: opponent.card.instanceId,
    }, {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }, [opponent.card.instanceId])
    expect(blocked.players['player-two'].battleArea[0]!.hpCards).toHaveLength(
      opponent.hpCards.length,
    )

    const own = protectedState.players['player-one'].battleArea[0]!
    const allowed = executeCardEffect(protectedState, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: own.card.instanceId,
    }, {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }, [own.card.instanceId])
    expect(allowed.players['player-one'].battleArea[0]!.hpCards).toHaveLength(
      own.hpCards.length + 1,
    )

    const opponentHandCard = {
      ...protectedState.players['player-one'].hand[0]!,
      instanceId: 'bs9-035-opponent-hand-card',
    }
    const opponentSource = protectedState.players['player-two'].battleArea[0]!
    const protectedWithHand = {
      ...protectedState,
      players: {
        ...protectedState.players,
        'player-two': {
          ...protectedState.players['player-two'],
          hand: [opponentHandCard],
        },
      },
    }
    const handBlocked = executeCardEffect(protectedWithHand, {
      sourcePlayerId: 'player-two',
      sourceInstanceId: opponentSource.card.instanceId,
    }, {
      kind: 'hand-to-hp',
      handSide: 'self',
      optional: false,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }, [opponentHandCard.instanceId])
    expect(handBlocked).toBe(protectedWithHand)

    const placeBlocked = placeHandCardOnHp(protectedWithHand, {
      sourcePlayerId: 'player-two',
      sourceInstanceId: opponentSource.card.instanceId,
    }, opponentSource.card.instanceId, opponentHandCard.instanceId)
    expect(placeBlocked).toBe(protectedWithHand)

    const afterTurn = advancePhase({ ...protectedState, phase: 'end' })
    expect(afterTurn.preventHpGainThisTurn).toEqual({})
  })

  it('pays the Activate discard before applying prevention and enforces Once Per Turn', () => {
    const state = createCardCheckDemoState('BS9-035')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS9-035',
    )!.card
    const discard = state.players['player-one'].hand.find((card) => !card.flip)!
    const started = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [discard.instanceId],
    })
    expect(started.players['player-one'].discardPile).toContainEqual(discard)
    expect(started.preventHpGainThisTurn).toBeUndefined()

    const resolved = applyGameCommand(started, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.preventHpGainThisTurn).toEqual({ 'player-two': true })
    expect(() => applyGameCommand(resolved, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [resolved.players['player-one'].hand[0]!.instanceId],
    })).toThrow('每回合一次')
  })

  it('offers the attack Then cost before its break-area condition and only accepts a FLIP Cookie', () => {
    const payable = createCardCheckDemoState('BS9-035', { normalAttack: 'payable' })
    const opened = applyGameCommand(payable, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(opened.pendingOptionalCostAttack?.cost).toMatchObject({
      discardHand: 1,
      discardHandType: 'cookie',
      discardHandHasFlip: true,
    })
    const nonFlip = opened.players['player-one'].hand.find((card) => !card.flip)!
    expect(() => applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [nonFlip.instanceId],
      targetIds: [],
    })).toThrow('不符合攻擊後效果棄牌條件')

    const flip = opened.players['player-one'].hand.find((card) => card.flip)!
    const target = opened.players['player-two'].battleArea[0]!
    const resolved = applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [flip.instanceId],
      targetIds: [target.card.instanceId],
    })
    expect(resolved.players['player-one'].discardPile).toContainEqual(flip)
    expect(resolved.players['player-two'].battleArea[0]!.hpCards).toHaveLength(
      target.hpCards.length - 1,
    )

    const conditionFalse = {
      ...payable,
      players: {
        ...payable.players,
        'player-one': { ...payable.players['player-one'], breakArea: [] },
      },
    }
    const offered = applyGameCommand(conditionFalse, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const cost = offered.players['player-one'].hand.find((card) => card.flip)!
    const paid = applyGameCommand(offered, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [cost.instanceId],
      targetIds: [],
    })
    expect(paid.players['player-one'].discardPile).toContainEqual(cost)
    expect(paid.players['player-two'].battleArea[0]!.hpCards).toHaveLength(
      conditionFalse.players['player-two'].battleArea[0]!.hpCards.length,
    )
  })
})
