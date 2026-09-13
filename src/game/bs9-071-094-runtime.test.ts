import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import type { GameState } from './types'

const sourceInBattle = (state: GameState, cardNumber: string) => {
  const entry = state.players['player-one'].battleArea.find((candidate) => candidate.card.id === cardNumber)
  if (!entry) throw new Error(`${cardNumber} source is not in battle area`)
  return entry
}

describe('BS9-071～094 candidate runtime boundaries', () => {
  it('BS9-080 moves itself to the deck bottom, then resolves both inspect destinations', () => {
    for (const mode of [0, 1] as const) {
      let state = createCardCheckDemoState('BS9-080')
      const source = sourceInBattle(state, 'BS9-080')
      state = applyGameCommand(state, {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
        trigger: 'activate',
        paymentIds: [],
      })
      state = applyGameCommand(state, {
        kind: 'resolve-choose-one',
        playerId: 'player-one',
        modeIndex: mode,
      })
      state = applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      })
      const viewed = state.pendingInspectDeck?.revealedCards[0]
      expect(viewed).toBeDefined()
      state = applyGameCommand(state, {
        kind: 'resolve-inspect-deck',
        playerId: 'player-one',
        pickedCardIds: [],
        restOrder: [viewed!.instanceId],
      })
      const deck = state.players['player-one'].deck
      expect(deck.some((card) => card.instanceId === source.card.instanceId)).toBe(true)
      if (mode === 0) {
        expect(deck[0]?.instanceId).toBe(viewed!.instanceId)
        expect(deck.at(-1)?.instanceId).toBe(source.card.instanceId)
      } else {
        expect(deck.at(-1)?.instanceId).toBe(viewed!.instanceId)
        expect(deck.at(-2)?.instanceId).toBe(source.card.instanceId)
      }
    }

    const blocked = createCardNegativeDemoState('BS9-080')
    expect(() => applyGameCommand(blocked, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: sourceInBattle(blocked, 'BS9-080').card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('BS9-082 redirects the opponent to Shadow Milk and lifts the restriction when absent', () => {
    const withShadowMilk = createCardCheckDemoState('BS9-082')
    const paymentCards = withShadowMilk.players['player-one'].supportArea.slice(0, 4).map((support, index) => ({
      card: { ...support.card, instanceId: `bs9-082-opponent-payment-${index + 1}` },
      rested: false,
    }))
    const redirected: GameState = {
      ...withShadowMilk,
      activePlayerId: 'player-two',
      players: {
        ...withShadowMilk.players,
        'player-two': {
          ...withShadowMilk.players['player-two'],
          supportArea: paymentCards,
        },
      },
    }
    const attacker = redirected.players['player-two'].battleArea[0]!
    const restrictedTarget = redirected.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS9-082')!
    const shadowMilk = redirected.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS9-079')!
    const paymentIds = paymentCards.slice(0, 3).map((support) => support.card.instanceId)
    const legal = applyGameCommand(redirected, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: restrictedTarget.card.instanceId,
      supportPaymentIds: paymentIds,
    })
    expect(legal.pendingBattle?.targetInstanceId).toBe(restrictedTarget.card.instanceId)
    expect(() => applyGameCommand(redirected, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: shadowMilk.card.instanceId,
      supportPaymentIds: paymentIds,
    })).toThrow()

    const withoutShadowMilk = createCardNegativeDemoState('BS9-082')
    const negativePayment = withoutShadowMilk.players['player-one'].supportArea.slice(0, 4).map((support, index) => ({
      card: { ...support.card, instanceId: `bs9-082-negative-payment-${index + 1}` },
      rested: false,
    }))
    const unrestricted: GameState = {
      ...withoutShadowMilk,
      activePlayerId: 'player-two',
      players: {
        ...withoutShadowMilk.players,
        'player-two': {
          ...withoutShadowMilk.players['player-two'],
          supportArea: negativePayment,
        },
      },
    }
    const unrestrictedAttacker = unrestricted.players['player-two'].battleArea[0]!
    const onlyTarget = unrestricted.players['player-one'].battleArea[0]!
    expect(applyGameCommand(unrestricted, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: unrestrictedAttacker.card.instanceId,
      targetInstanceId: onlyTarget.card.instanceId,
      supportPaymentIds: negativePayment.slice(0, 3).map((support) => support.card.instanceId),
    }).pendingBattle?.targetInstanceId).toBe(onlyTarget.card.instanceId)
  })
})
