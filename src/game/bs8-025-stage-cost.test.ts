import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { canActivateStage } from './card-abilities'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'

const setup = () => {
  const initial = createCardCheckDemoState('BS8-025')
  const hpIds = initial.players['player-one'].battleArea.flatMap(cookie => cookie.hpCards.map(hp => hp.instanceId))
  expect(new Set(hpIds).size).toBe(hpIds.length)
  initial.players['player-one'].battleArea = createCardCheckDemoState('BS8-022').players['player-one'].battleArea
  const card = initial.players['player-one'].hand.find(c => c.id === 'BS8-025')!
  const state = applyGameCommand(initial, { kind: 'play-stage', playerId: 'player-one', instanceId: card.instanceId, paymentIds: ['support-pay-0', 'support-pay-1'] })
  const source = state.players['player-one'].battleArea[0]
  const command = { kind: 'begin-activate-stage' as const, playerId: 'player-one' as const,
    paymentIds: ['support-pay-2'], trashBattleCookieIds: [source.card.instanceId] }
  return { state, source, command }
}

describe('BS8-025 Tower of Sweet Chaos faint payment', () => {
  it.each([0, 1])('pays R, rests and faints a Cookie before dealing damage to %i opponent Cookie', count => {
    const { state, source, command } = setup()
    const before = structuredClone(state)
    const paid = applyGameCommand(state, command)
    expect(state).toEqual(before)
    expect(paid.players['player-one'].stage?.rested).toBe(true)
    expect(paid.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(3)
    expect(paid.players['player-one'].breakArea).toContainEqual(source.card)
    expect(paid.players['player-one'].discardPile).not.toContainEqual(source.card)
    for (const hp of source.hpCards) expect(paid.players['player-one'].discardPile).toContainEqual(hp)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.players['player-two']).toEqual(state.players['player-two'])
    const target = state.players['player-two'].battleArea[0]
    const result = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: count ? [target.card.instanceId] : [] })
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(target.hpCards.length - count)
    expect(result.pendingAbilityEffect).toBeUndefined()
    expect(canActivateStage(result, 'player-one')).toBe(false)
    expect(() => applyGameCommand(result, command)).toThrow()
  })

  it('ends the game when the faint payment reaches Break LV10, before any target damage', () => {
    const { state, source, command } = setup()
    state.players['player-one'].breakArea = Array.from({ length: 3 }, (_, i) => ({ ...source.card, level: 3, instanceId: `existing-break-${i}` }))
    const result = applyGameCommand(state, command)
    expect(result.status).toBe('finished')
    expect(result.result?.winnerId).toBe('player-two')
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.players['player-two']).toEqual(state.players['player-two'])
    expect(result.players['player-one'].stage?.rested).toBe(true)
  })

  it('rejects incomplete, repeated or opponent faint costs without consuming stage activation', () => {
    const { state, source, command } = setup()
    const before = structuredClone(state)
    for (const trashBattleCookieIds of [[], [source.card.instanceId, source.card.instanceId], [state.players['player-two'].battleArea[0].card.instanceId]]) {
      expect(() => applyGameCommand(state, { ...command, trashBattleCookieIds })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('preserves its paid stage effect while a real Cake Wolf faint skill is pending', () => {
    const { state, source, command } = setup()
    const conversion = convertOfficialCardToGameCard(getCardPoolEntry('BS8-018')!)
    if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Expected Cake Wolf')
    source.card = { ...conversion.gameCard, instanceId: source.card.instanceId }
    const paid = applyGameCommand(state, command)
    expect(paid.pendingFaintEffects?.length).toBeGreaterThan(0)
    expect(paid.pendingAbilityEffect?.sourceKind).toBe('stage')
    expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })).toThrow()
    const skipped = applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    const target = skipped.players['player-two'].battleArea[0]
    const result = applyGameCommand(skipped, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [target.card.instanceId] })
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(target.hpCards.length - 1)
    expect(result.players['player-one'].stage?.rested).toBe(true)
  })

  it('rejects own, Break, repeated, or multiple damage targets after payment', () => {
    const { state, source, command } = setup()
    const paid = applyGameCommand(state, command)
    const before = structuredClone(paid)
    const opponents = paid.players['player-two'].battleArea.map(c => c.card.instanceId)
    for (const targetIds of [[paid.players['player-one'].battleArea[0].card.instanceId], [source.card.instanceId], [opponents[0], opponents[0]], opponents]) {
      expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })).toThrow()
      expect(paid).toEqual(before)
    }
  })

  it('cannot activate with wrong, rested or missing energy or outside the owner main phase', () => {
    const { state, command } = setup()
    state.players['player-one'].supportArea[5].card.energyColor = 'yellow'
    const before = structuredClone(state)
    for (const paymentIds of [[], ['support-pay-0'], ['support-pay-5'], ['support-pay-2', 'support-pay-3']]) {
      expect(() => applyGameCommand(state, { ...command, paymentIds })).toThrow()
      expect(state).toEqual(before)
    }
    expect(() => applyGameCommand({ ...state, activePlayerId: 'player-two' }, command)).toThrow()
    expect(() => applyGameCommand({ ...state, phase: 'support' }, command)).toThrow()
  })
})
