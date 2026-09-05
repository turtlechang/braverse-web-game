import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, parseTestStateConfig } from './demo'
import { getTrapCandidates } from './battle'
import type { GameState } from './types'

const resolve = (state: GameState, targetIds: string[] = []) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})
const afterDamage = (cardNumber = 'BS8-021') => {
  const initial = createCardCheckDemoState(cardNumber)
  const item = initial.players['player-one'].hand.find(card => card.id === 'BS8-021')!
  let state = applyGameCommand(initial, { kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId,
    paymentIds: ['support-pay-0', 'support-pay-1'] })
  state = resolve(state)
  state = resolve(state)
  return { initial, item, state }
}
const pay = (state: GameState, paymentIds = ['support-pay-2']) => applyGameCommand(state, {
  kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds, targetIds: [],
})

describe('BS8-021 separate optional R payment before equipment', () => {
  it.each(['BS8-021', 'BS8-021@1'])('%s can pay the Item RR but cannot pay Then without a third active support', (cardNumber) => {
    const suffix = cardNumber.endsWith('@1') ? '@1' : ''
    const config = parseTestStateConfig(`?test-state=bs8-021-no-energy${suffix}`, 'localhost')
    expect(config).toMatchObject({ kind: 'card-check', cardNumber, bs8021Scenario: 'no-energy' })
    const initial = createCardCheckDemoState(cardNumber, { bs8021Scenario: 'no-energy' })
    const item = initial.players['player-one'].hand.find(card => card.id === 'BS8-021')!
    let state = applyGameCommand(initial, { kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId,
      paymentIds: ['support-pay-0', 'support-pay-1'] })
    state = resolve(resolve(state))
    expect(state.pendingOptionalCostAttack).toBeTruthy()
    expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    const before = structuredClone(state)
    expect(() => pay(state)).toThrow()
    expect(state).toEqual(before)
    const skipped = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip' })
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.players).toEqual(state.players)
    expect(skipped.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
  })

  it.each([false, true])('effect damage must offer the HP-restoring FLIP before fainting (activate=%s)', (activate) => {
    const initial = createCardCheckDemoState('BS8-021', { bs8021Scenario: 'faint-flip' })
    const item = initial.players['player-one'].hand.find(card => card.id === 'BS8-021')!
    let state = applyGameCommand(initial, { kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId,
      paymentIds: ['support-pay-0', 'support-pay-1'] })
    state = resolve(state)
    expect(state.pendingBattle?.stage).toBe('damage')
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS8-015')
    expect(state.pendingFaintEffects?.length ?? 0).toBe(0)
    const discardId = state.players['player-one'].hand[0].instanceId
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate,
      discardHandIds: activate ? [discardId] : [] })
    if (state.pendingBattle && !state.pendingFaintEffects?.length) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
    const survivor = state.players['player-one'].battleArea.find(c => c.card.id === 'BS8-018')
    expect(survivor?.hpCards.length ?? 0).toBe(activate ? 1 : 0)
    expect(state.players['player-one'].deck).toHaveLength(activate ? 19 : 20)
    expect(state.players['player-one'].hand).toHaveLength(activate ? 3 : 4)
    expect(state.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([6, 5])
    expect(state.pendingAbilityEffect?.sourceInstanceId).toBe(item.instanceId)
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    if (!activate) {
      expect(state.pendingFaintEffects?.[0].sourceCardName).toBe('Cake Wolf')
      state = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], paymentIds: ['support-pay-2'] })
      state = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    }
    if (state.pendingBattle) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    state = resolve(state)
    expect(state.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(state.pendingOptionalCostAttack?.resolution).toBe('ability')
    state = resolve(pay(state, [activate ? 'support-pay-2' : 'support-pay-3']), [state.players['player-one'].battleArea[0].card.instanceId])
    expect(state.players['player-one'].battleArea[0].equippedCards).toEqual([item])
    expect(state.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(activate ? 3 : 4)
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  it.each(['BS8-021', 'BS8-021@1'])('%s damages both sides before asking for a separate R payment', (cardNumber) => {
    const { initial, item, state } = afterDamage(cardNumber)
    expect(state.pendingOptionalCostAttack).toMatchObject({ resolution: 'ability', cost: { energy: { red: 1 } } })
    expect(state.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(2)
    for (const playerId of ['player-one', 'player-two'] as const) {
      const before = initial.players[playerId].battleArea
      for (const cookie of state.players[playerId].battleArea) {
        const original = before.find(c => c.card.instanceId === cookie.card.instanceId)!
        expect(cookie.hpCards.length).toBe(original.hpCards.length - Number(cookie.card.name !== 'Burning Spice Cookie'))
      }
    }
    expect(state.players['player-one'].discardPile.some(card => card.instanceId === item.instanceId)).toBe(true)
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    const before = structuredClone(state)
    expect(() => resolve(state, [sourceId])).toThrow()
    expect(state).toEqual(before)
  })
  it('declining Then preserves the RR cost and damage while keeping the Item in trash', () => {
    const { state } = afterDamage()
    const next = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip' })
    expect(next.pendingOptionalCostAttack).toBeNull()
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.players).toEqual(state.players)
  })
  it.each([0, 1])('after paying R, selecting %s equipment targets retains the full cost', (count) => {
    const { state, item } = afterDamage()
    const source = state.players['player-one'].battleArea[0]
    const next = resolve(pay(state), count ? [source.card.instanceId] : [])
    expect(next.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(3)
    expect(next.players['player-one'].battleArea[0].equippedCards ?? []).toEqual(count ? [item] : [])
    expect(next.players['player-one'].discardPile.some(card => card.instanceId === item.instanceId)).toBe(!count)
    expect(next.pendingOptionalCostAttack).toBeNull()
    expect(next.pendingAbilityEffect).toBeUndefined()
  })
  it.each(['empty', 'rested', 'wrong-color', 'duplicate'])('rejects %s Then payment without moving cards', (mode) => {
    const { state } = afterDamage()
    if (mode === 'rested') state.players['player-one'].supportArea[2].rested = true
    if (mode === 'wrong-color') state.players['player-one'].supportArea[2].card.energyColor = 'yellow'
    const ids = mode === 'empty' ? [] : mode === 'duplicate' ? ['support-pay-2', 'support-pay-2'] : ['support-pay-2']
    const before = structuredClone(state)
    expect(() => pay(state, ids)).toThrow()
    expect(state).toEqual(before)
  })
  it('rejects a different Cookie or opponent as equipment target', () => {
    const state = pay(afterDamage().state)
    const before = structuredClone(state)
    for (const id of [state.players['player-one'].battleArea[1].card.instanceId, state.players['player-two'].battleArea[0].card.instanceId]) {
      expect(() => resolve(state, [id])).toThrow()
    }
    expect(state).toEqual(before)
  })
  it.each([7, 8])('after real payment and equipment, break LV.%s determines Trap availability', (level) => {
    const paid = pay(afterDamage().state)
    let state = resolve(paid, [paid.players['player-one'].battleArea[0].card.instanceId])
    const own = state.players['player-one']
    if (level === 7) own.breakArea[own.breakArea.length - 1].level--
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: own.battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: ['support-pay-3', 'support-pay-4', 'support-pay-5'] })
    expect(Boolean(state.pendingBattle?.trapsDisabled)).toBe(level === 8)
    expect(getTrapCandidates(state, 'player-two').length > 0).toBe(level === 7)
  })
})
