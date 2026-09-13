import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import type { GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing ${cardNumber} candidate`)
  const conversion = convertOfficialCardToGameCard(record, `${cardNumber}-test`)
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const handCard = (state: GameState, cardNumber: string) => {
  const card = state.players['player-one'].hand.find((entry) => entry.id === cardNumber)
  if (!card) throw new Error(`Missing ${cardNumber} in hand`)
  return card
}

describe('BS9-046 through BS9-049 candidate effects', () => {
  it('preserves trap Then, stage payment, both FLIP variants, and Fig faint target ownership', () => {
    expect(candidate('BS9-046')).toMatchObject({
      type: 'trap',
      trap: {
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          { kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
          { kind: 'trash-to-hand', max: 1, cookieOnly: true, hasFlip: true },
        ],
      },
    })
    expect(candidate('BS9-047')).toMatchObject({
      type: 'stage',
      stageAbility: {
        placementCost: { yellow: 1 },
        cost: { energy: {}, discardHand: 1 },
        restSource: true,
        effects: [{ kind: 'trash-to-hand', max: 1, cookieOnly: true, hasFlip: true }],
      },
    })
    for (const cardNumber of ['BS9-048', 'BS9-048@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        type: 'cookie',
        flip: { cost: { energy: {}, discardHand: 1 }, effects: [], attachedHpBonus: 1 },
      })
    }
    for (const cardNumber of ['BS9-049', 'BS9-049@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        type: 'cookie',
        skill: {
          trigger: 'passive',
          faint: true,
          effects: [{
            kind: 'battle-to-support',
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
            rested: true,
          }],
        },
      })
    }
  })

  it('BS9-046 pays two yellow supports, reduces the attacker, then returns only a FLIP Cookie', () => {
    const initial = createCardCheckDemoState('BS9-046')
    const trap = handCard(initial, 'BS9-046')
    const paymentIds = initial.players['player-one'].supportArea.map(({ card }) => card.instanceId)
    const attacker = initial.players['player-two'].battleArea[0]!
    const eligible = initial.players['player-one'].discardPile.find((card) => card.flip)
    const ineligible = initial.players['player-one'].discardPile.find((card) => !card.flip)
    if (!eligible || !ineligible) throw new Error('Missing BS9-046 recovery witnesses')

    let state = applyGameCommand(initial, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: trap.instanceId,
      paymentIds, discardHandIds: [], targetIds: [], effectTargets: [[attacker.card.instanceId]],
    })
    expect(state.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: attacker.card.instanceId, amount: -2,
    }))
    expect(state.pendingAbilityEffect?.effects[state.pendingAbilityEffect.effectIndex]).toMatchObject({
      kind: 'trash-to-hand', max: 1, cookieOnly: true, hasFlip: true,
    })
    expect(() => applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [ineligible.instanceId],
    })).toThrow(/合法範圍/)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [eligible.instanceId],
    })
    expect(state.players['player-one'].hand).toContainEqual(eligible)

    const noFlip = createCardNegativeDemoState('BS9-046')
    const noFlipTrap = handCard(noFlip, 'BS9-046')
    const skipped = applyGameCommand(noFlip, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: noFlipTrap.instanceId,
      paymentIds: noFlip.players['player-one'].supportArea.map(({ card }) => card.instanceId),
      discardHandIds: [], targetIds: [], effectTargets: [[noFlip.players['player-two'].battleArea[0]!.card.instanceId]],
    })
    expect(skipped.pendingAbilityEffect).toBeUndefined()
  })

  it('BS9-047 pays placement separately, then rests, discards, and recovers only a FLIP Cookie', () => {
    const initial = createCardCheckDemoState('BS9-047')
    const stage = handCard(initial, 'BS9-047')
    const payment = initial.players['player-one'].supportArea[0]!.card.instanceId
    const discard = initial.players['player-one'].hand.find((card) => card.instanceId !== stage.instanceId)
    const eligible = initial.players['player-one'].discardPile.find((card) => card.flip)
    const ineligible = initial.players['player-one'].discardPile.find((card) => !card.flip)
    if (!discard || !eligible || !ineligible) throw new Error('Missing BS9-047 payment or recovery witnesses')

    let state = applyGameCommand(initial, {
      kind: 'play-stage', playerId: 'player-one', instanceId: stage.instanceId, paymentIds: [payment],
    })
    state = applyGameCommand(state, {
      kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: [], discardHandIds: [discard.instanceId],
    })
    expect(state.players['player-one'].stage).toMatchObject({ rested: true })
    expect(state.players['player-one'].discardPile).toContainEqual(discard)
    expect(() => applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [ineligible.instanceId],
    })).toThrow(/合法範圍/)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [eligible.instanceId],
    })
    expect(state.players['player-one'].hand).toContainEqual(eligible)

    const noFlip = createCardNegativeDemoState('BS9-047')
    const noFlipStage = handCard(noFlip, 'BS9-047')
    const noFlipPayment = noFlip.players['player-one'].supportArea[0]!.card.instanceId
    const noFlipDiscard = noFlip.players['player-one'].hand.find((card) => card.instanceId !== noFlipStage.instanceId)
    if (!noFlipDiscard) throw new Error('Missing BS9-047 negative discard')
    state = applyGameCommand(noFlip, {
      kind: 'play-stage', playerId: 'player-one', instanceId: noFlipStage.instanceId, paymentIds: [noFlipPayment],
    })
    state = applyGameCommand(state, {
      kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: [], discardHandIds: [noFlipDiscard.instanceId],
    })
    expect(state.pendingAbilityEffect).toMatchObject({ sourceKind: 'stage' })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
    })
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  it('BS9-048 FLIP adds one HP only after the hand discard, across both printed variants', () => {
    for (const cardNumber of ['BS9-048', 'BS9-048@1']) {
      const initial = createCardCheckDemoState(cardNumber)
      const defender = initial.players['player-one'].battleArea[0]!
      const discard = initial.players['player-one'].hand[0]!
      const resolved = applyGameCommand(initial, {
        kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [discard.instanceId],
      })
      expect(resolved.players['player-one'].battleArea[0]!.hpCards).toHaveLength(defender.hpCards.length + 1)
      expect(() => applyGameCommand(createCardNegativeDemoState(cardNumber), {
        kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [],
      })).toThrow(/discard|棄置|代價/i)
    }
  })

  it('BS9-049 faint moves only an opponent LV.1 Cookie to that opponent support area as rested', () => {
    const initial = createCardCheckDemoState('BS9-049')
    const target = initial.players['player-two'].battleArea[0]!
    const invalid = initial.players['player-two'].battleArea[1]!
    expect(() => applyGameCommand(initial, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [invalid.card.instanceId],
    })).toThrow(/合法目標/)
    const resolved = applyGameCommand(initial, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [target.card.instanceId],
    })
    expect(resolved.players['player-two'].battleArea.some((entry) => entry.card.instanceId === target.card.instanceId)).toBe(false)
    expect(resolved.players['player-two'].supportArea).toContainEqual({ card: target.card, rested: true })

    const noLv1 = createCardNegativeDemoState('BS9-049')
    const skipped = applyGameCommand(noLv1, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [],
    })
    expect(skipped.players['player-two'].supportArea).toHaveLength(0)
  })
})
