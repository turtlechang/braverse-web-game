import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { canActivateCookieSkill } from './skills'
import type { GameState } from './types'

const attack = (state: GameState) => {
  let next = applyGameCommand(state, {
    kind: 'declare-attack', playerId: 'player-one',
    attackerInstanceId: state.players['player-one'].battleArea[0]!.card.instanceId,
    targetInstanceId: state.players['player-two'].battleArea[0]!.card.instanceId,
    supportPaymentIds: state.players['player-one'].supportArea.slice(0, 3).map(({ card }) => card.instanceId),
  })
  next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
  return next
}

describe('BS9 manual effect witnesses', () => {
  it.each([false, true])('035 exposes an opponent healing FLIP with prevention=%s', (prevent) => {
    let state = createCardCheckDemoState('BS9-035')
    if (prevent) {
      state = applyGameCommand(state, {
        kind: 'begin-activate-skill', playerId: 'player-one', trigger: 'activate',
        sourceInstanceId: state.players['player-one'].battleArea[0]!.card.instanceId,
        paymentIds: [], discardHandIds: [state.players['player-one'].hand[1]!.instanceId],
      })
      state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    }
    state = attack(state)
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS9-042')
    const hp = state.players['player-two'].battleArea[0]!.hpCards.length
    state = applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-two', activate: true,
      discardHandIds: [state.players['player-two'].hand[0]!.instanceId], targetIds: [],
    })
    expect(state.players['player-two'].battleArea[0]!.hpCards).toHaveLength(hp + (prevent ? 0 : 1))
  })

  it('041 pays BS9-030 attack-after cost during the owner turn', () => {
    let state = createCardCheckDemoState('BS9-041')
    expect(state.activePlayerId).toBe('player-one')
    expect(state.players['player-one'].battleArea[0]!.card.id).toBe('BS9-030')
    expect(state.pendingOptionalCostAttack).toBeTruthy()
    const flip = state.players['player-one'].hand.find(card => card.id === 'BS9-041')!
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay',
      discardCardIds: [flip.instanceId], paymentIds: [], targetIds: [],
    })
    expect(state.players['player-one'].discardPile).toContainEqual(flip)
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [], targetIds: [] })
    expect(state.pendingDrawUpTo?.playerId).toBe('player-one')
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 })
    const target = state.players['player-two'].battleArea[0]!
    const hp = target.hpCards.length
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [target.card.instanceId],
    })
    expect(state.players['player-two'].battleArea[0]!.hpCards).toHaveLength(hp - 1)
  })

  it('050 connects actual GGG attack payment, support trash and Crow Storm', () => {
    let state = createCardCheckDemoState('BS9-050')
    const sourceId = state.players['player-one'].battleArea[0]!.card.instanceId
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(false)
    state = attack(state)
    for (let i = 0; i < 3; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay',
      supportToTrashIds: state.players['player-one'].supportArea.slice(3).map(({ card }) => card.instanceId),
      targetIds: state.players['player-two'].battleArea.map(({ card }) => card.instanceId),
    })
    for (let i = 0; i < 2; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.supportCardsTrashedThisTurn?.['player-one']).toBe(2)
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(true)
    const supportId = state.players['player-one'].supportArea[0]!.card.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [supportId] })
    expect(state.players['player-one'].supportArea.map(support => support.rested)).toEqual([false, true, true])
  })
})
