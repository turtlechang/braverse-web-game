import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'

/**
 * The no-effect Cookie records still need a real attack path.  Contract
 * parsing proves their printed cost/damage shape, but only a command-level
 * attack proves that the candidate fixture can pay, resolve damage, and be
 * blocked when the same payment is unavailable.
 */
const vanillaCards = ['BS9-072', 'BS9-073', 'BS9-074', 'BS9-103', 'BS9-105', 'BS9-109'] as const

const attackCost = (energy: Record<string, number> | undefined): number =>
  Object.values(energy ?? {}).reduce((total, amount) => total + amount, 0)

const finishAttack = (state: ReturnType<typeof createCardCheckDemoState>) => {
  let current = state
  for (let step = 0; step < 20 && current.pendingBattle; step += 1) {
    if (current.pendingBattle.stage === 'trap') {
      current = applyGameCommand(current, {
        kind: 'skip-trap',
        playerId: 'player-two',
      })
    } else if (current.pendingBattle.stage === 'damage') {
      current = applyGameCommand(current, {
        kind: 'resolve-next-damage',
        playerId: current.pendingBattle.defenderPlayerId,
      })
    } else if (current.pendingBattle.stage === 'attack-effect') {
      current = applyGameCommand(current, {
        kind: 'resolve-attack-effect',
        playerId: 'player-one',
        targetIds: [],
      })
    } else {
      throw new Error(`Unexpected attack stage: ${current.pendingBattle.stage}`)
    }
  }
  expect(current.pendingBattle).toBeNull()
  return current
}

describe('BS9 candidate vanilla attacks', () => {
  it.each(vanillaCards)('%s pays and resolves its printed attack', (cardNumber) => {
    let state = createCardCheckDemoState(cardNumber)
    const sourceInHand = state.players['player-one'].hand.find((card) => card.id === cardNumber)
    expect(sourceInHand, `${cardNumber} source must be a physical hand card`).toBeDefined()
    if (!sourceInHand || sourceInHand.type !== 'cookie') {
      throw new Error(`${cardNumber} source must be a Cookie card`)
    }
    const target = state.players['player-two'].battleArea[0]
    expect(target, `${cardNumber} fixture must expose an opponent target`).toBeDefined()
    const beforeHp = target!.hpCards.length
    const damage = sourceInHand!.attack
    const paymentCount = attackCost(sourceInHand!.attackEnergyCost)

    state = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: sourceInHand!.instanceId,
    })
    const attacker = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === sourceInHand!.instanceId,
    )
    expect(attacker, `${cardNumber} source must enter the battle area`).toBeDefined()
    const paymentIds = state.players['player-one'].supportArea
      .filter((support) => !support.rested)
      .slice(0, paymentCount)
      .map((support) => support.card.instanceId)
    expect(paymentIds).toHaveLength(paymentCount)

    state = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker!.card.instanceId,
      targetInstanceId: target!.card.instanceId,
      supportPaymentIds: paymentIds,
    })
    state = finishAttack(state)

    const targetAfter = state.players['player-two'].battleArea.find(
      (entry) => entry.card.instanceId === target!.card.instanceId,
    )
    if (targetAfter) {
      expect(targetAfter.hpCards).toHaveLength(Math.max(0, beforeHp - damage))
    } else {
      expect(state.players['player-two'].breakArea).toContainEqual(
        expect.objectContaining({ instanceId: target!.card.instanceId }),
      )
    }
  })

  it.each(vanillaCards)('%s is blocked when its attack payment is unavailable', (cardNumber) => {
    const state = createCardNegativeDemoState(cardNumber, { normalAttack: 'blocked' })
    const attacker = state.players['player-one'].battleArea.find((entry) => entry.card.id === cardNumber)
    const target = state.players['player-two'].battleArea[0]
    expect(attacker, `${cardNumber} negative fixture must keep its source`).toBeDefined()
    expect(target, `${cardNumber} negative fixture must keep a target`).toBeDefined()
    expect(() => applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker!.card.instanceId,
      targetInstanceId: target!.card.instanceId,
      supportPaymentIds: [],
    })).toThrow()
  })
})
