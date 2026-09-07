import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { createCardCheckDemoState, parseTestStateConfig } from './demo'
import type { GameState } from './types'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'

const resolve = (state: GameState, targetIds: string[] = [], paymentIds: string[] = []) =>
  applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds, paymentIds })

describe('BS8-018 optional red support and required source movement', () => {
  it('declares its printed RN attack with red and yellow support and deals exactly 1 damage', () => {
    const config = parseTestStateConfig('?test-state=card-attack:BS8-018', 'localhost')
    if (config?.kind !== 'card-check') throw new Error('Missing attack route')
    const state = createCardCheckDemoState(config.cardNumber, config)
    const player = state.players['player-one']
    const source = player.battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    expect(source.card.skill?.faint).toBe(true)
    expect(source.card.attackEnergyCost).toEqual({ red: 1, neutral: 1 })
    player.supportArea[1].card.energyColor = 'yellow'
    const declaration = { kind: 'declare-attack' as const, playerId: 'player-one' as const,
      attackerInstanceId: source.card.instanceId, targetInstanceId: target.card.instanceId,
      supportPaymentIds: ['support-pay-0', 'support-pay-1'] }
    const before = structuredClone(state)
    for (const supportPaymentIds of [['support-pay-0'], ['support-pay-0', 'support-pay-0']]) {
      expect(() => applyGameCommand(state, { ...declaration, supportPaymentIds })).toThrow()
      expect(state).toEqual(before)
    }
    let next = applyGameCommand(state, declaration)
    expect(state).toEqual(before)
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(next.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(2)
    expect(next.players['player-one'].battleArea[0].rested).toBe(true)
    expect(next.pendingFaintEffects).toBeUndefined()
    const blocked = createCardCheckDemoState('BS8-018', { normalAttack: 'blocked' })
    expect(() => applyGameCommand(blocked, declaration)).toThrow()
  })
  it.each(['player-one', 'player-two'] as const)('real damage respects Your Turn (active=%s)', (activePlayerId) => {
    const state = createCardCheckDemoState('BS8-006')
    const converted = convertOfficialCardToGameCard(getCardPoolEntry('BS8-018')!)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing formal Cake Wolf')
    const source = state.players['player-one'].battleArea[0]
    source.card = { ...converted.gameCard, instanceId: 'actual-bs8-018-faint' }
    state.activePlayerId = activePlayerId
    const next = executeCardEffect(state, { sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId },
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } }, [source.card.instanceId])
    expect(next.players['player-one'].breakArea.some(card => card.instanceId === source.card.instanceId)).toBe(true)
    expect(next.pendingFaintEffects?.filter(effect => effect.sourceInstanceId === source.card.instanceId) ?? [])
      .toHaveLength(activePlayerId === 'player-one' ? 2 : 0)
  })
  it('provides a source-moved Browser route while preserving sufficient payment and damage targets', () => {
    const config = parseTestStateConfig('?test-state=bs8-018-source-moved', 'localhost')
    expect(config).toEqual({ kind: 'card-check', cardNumber: 'BS8-018', faintSourceMoved: true })
    if (config?.kind !== 'card-check') throw new Error('Missing route')
    const state = createCardCheckDemoState(config.cardNumber, config)
    expect(state.players['player-one'].supportArea[0].rested).toBe(false)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(resolve(state).pendingFaintEffects).toBeUndefined()
  })
  it('cannot pay energy or damage if an earlier effect already moved its source out of Break', () => {
    const state = createCardCheckDemoState('BS8-018')
    const source = state.pendingFaintEffects![0]
    const moved = executeCardEffect(state, source.context, { kind: 'break-source-to-trash' }, [])
    const next = resolve(moved, [], ['support-pay-0'])
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players).toEqual(moved.players)
    expect(next.commandLog?.at(-1)?.steps?.[0].text).toContain('無法支付來源代價，後續效果未執行')
  })

  it.each([0, 1])('pays R once and moves the source before selecting %s damage targets', (count) => {
    const state = createCardCheckDemoState('BS8-018')
    const sourceId = state.pendingFaintEffects![0].sourceInstanceId
    const opponent = state.players['player-two'].battleArea[0]
    const paid = resolve(state, [], ['support-pay-0'])
    expect(paid.players['player-one'].supportArea.filter(support => support.rested)).toHaveLength(1)
    expect(paid.players['player-one'].breakArea.some(card => card.instanceId === sourceId)).toBe(false)
    expect(paid.players['player-one'].discardPile.some(card => card.instanceId === sourceId)).toBe(true)
    expect(paid.pendingFaintEffects?.[0]).not.toHaveProperty('sourceEnergy')
    expect(paid.players['player-two']).toEqual(state.players['player-two'])
    const next = resolve(paid, count ? [opponent.card.instanceId] : [])
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(opponent.hpCards.length - count)
    expect(next.players['player-one'].supportArea.filter(support => support.rested)).toHaveLength(1)
    expect(next.pendingFaintEffects).toBeUndefined()
  })

  it('declining keeps the source in Break and never queues damage', () => {
    const state = createCardCheckDemoState('BS8-018')
    const next = resolve(state)
    expect(next.players).toEqual(state.players)
    expect(next.pendingFaintEffects).toBeUndefined()
  })

  it.each(['rested', 'wrong-color', 'duplicate', 'source-as-energy'])('rejects %s payment without moving cards', (mode) => {
    const state = createCardCheckDemoState('BS8-018')
    const sourceId = state.pendingFaintEffects![0].sourceInstanceId
    if (mode === 'rested') state.players['player-one'].supportArea[0].rested = true
    if (mode === 'wrong-color') state.players['player-one'].supportArea[0].card.energyColor = 'yellow'
    const ids = mode === 'duplicate' ? ['support-pay-0', 'support-pay-0']
      : mode === 'source-as-energy' ? [sourceId] : ['support-pay-0']
    const before = structuredClone(state)
    expect(() => resolve(state, [], ids)).toThrow()
    expect(state).toEqual(before)
  })

  it('cannot target its own Cookie after paying and cannot pay the damage step twice', () => {
    const state = resolve(createCardCheckDemoState('BS8-018'), [], ['support-pay-0'])
    const before = structuredClone(state)
    expect(() => resolve(state, [state.players['player-one'].battleArea[0].card.instanceId])).toThrow()
    expect(() => resolve(state, [], ['support-pay-1'])).toThrow()
    expect(state).toEqual(before)
  })
})
