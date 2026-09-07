import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { getTrapCandidates, resolveNextDamage } from './battle'

const playAndResolveTrap = (state: ReturnType<typeof createCardCheckDemoState>, command: ReturnType<typeof setup>['command']) => {
  const targetIds = Object.values(state.players).flatMap(player => player.battleArea)
    .filter(cookie => cookie.hpCards.length >= 2).map(cookie => cookie.card.instanceId)
  let next = applyGameCommand(state, { ...command, targetIds })
  for (let i = 0; i < 20 && next.pendingBattle?.effectDamageSequence; i++) next = resolveNextDamage(next)
  expect(next.pendingBattle?.effectDamageSequence).toBeUndefined()
  return next
}

const setup = () => {
  const state = createCardCheckDemoState('BS8-023')
  const owner = state.players['player-one']
  const trap = owner.hand.find(card => card.id === 'BS8-023')!
  const command = { kind: 'play-trap' as const, playerId: 'player-one' as const,
    trapInstanceId: trap.instanceId, paymentIds: ['support-pay-0', 'support-pay-1'], targetIds: [] }
  return { state, owner, trap, command }
}

describe('BS8-023 Shadow of the Destroyer', () => {
  it.each([1, 2, 3])('only damages Cookies with at least 2 actual remaining HP (tested HP %i)', hp => {
    const { state, command, trap } = setup()
    for (const player of Object.values(state.players)) {
      player.battleArea[0].hpCards = player.battleArea[0].hpCards.slice(0, hp)
      player.battleArea[1].hpCards = player.battleArea[1].hpCards.slice(0, 1)
    }
    const before = structuredClone(state)
    const next = playAndResolveTrap(state, command)
    expect(state).toEqual(before)
    for (const player of Object.values(next.players)) {
      expect(player.battleArea.map(cookie => cookie.hpCards.length)).toEqual([hp >= 2 ? hp - 1 : hp, 1])
    }
    expect(next.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(2)
    expect(next.players['player-one'].discardPile).toContainEqual(trap)
    expect(next.pendingBattle).toMatchObject({ trapUsed: true, stage: 'damage', remainingDamage: 6 })
    expect(next.pendingAbilityEffect).toBeFalsy()
    expect(next.cookiesFaintedThisTurn?.['player-one'] ?? 0).toBe(0)
  })

  it('rejects wrong color, duplicate, rested, insufficient or excessive payment before effects', () => {
    const { state, command } = setup()
    state.players['player-one'].supportArea[4].rested = true
    state.players['player-one'].supportArea[5].card.energyColor = 'yellow'
    const before = structuredClone(state)
    for (const paymentIds of [[], ['support-pay-0'], ['support-pay-0', 'support-pay-0'], ['support-pay-0', 'support-pay-4'], ['support-pay-0', 'support-pay-5'], ['support-pay-0', 'support-pay-1', 'support-pay-2']]) {
      expect(() => applyGameCommand(state, { ...command, paymentIds })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('does not count an unrevealed attached-HP FLIP as a second remaining HP', () => {
    const { state, command } = setup()
    for (const player of Object.values(state.players)) {
      expect(player.battleArea[1].hpCards).toHaveLength(1)
      expect(player.battleArea[1].hpCards[0]).toMatchObject({ id: 'BS8-015', flip: { attachedHpBonus: 1 } })
    }
    const next = playAndResolveTrap(state, command)
    for (const playerId of ['player-one', 'player-two'] as const) {
      expect(next.players[playerId].battleArea[1]).toEqual(state.players[playerId].battleArea[1])
    }
    expect(next.pendingBattle?.stage).toBe('damage')
    expect(next.pendingBattle?.effectDamageSequence).toBeUndefined()
  })

  it('cannot be played by the attacker, outside the trap window, or twice during one attack', () => {
    const { state, command } = setup()
    const before = structuredClone(state)
    expect(() => applyGameCommand(state, { ...command, playerId: 'player-two' })).toThrow()
    expect(() => applyGameCommand({ ...state, pendingBattle: null }, command)).toThrow()
    const played = playAndResolveTrap(state, command)
    expect(() => applyGameCommand(played, command)).toThrow()
    expect(state).toEqual(before)
  })

  it('declining preserves the trap and every support card and does not deal effect damage', () => {
    const { state, trap } = setup()
    expect(getTrapCandidates(state, 'player-one')).toContainEqual(trap)
    const next = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    expect(next.players).toEqual(state.players)
    expect(next.pendingBattle).toMatchObject({ stage: 'damage', remainingDamage: 6 })
  })
})
