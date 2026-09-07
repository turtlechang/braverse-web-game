import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { convertOfficialCardToGameCard, convertOfficialCardToExtraDeckCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { canPlayItem } from './card-abilities'
import { payTrashBattleCookieCost } from './skills'
import { materializeExtraDeckCookie } from './extra-deck'
import type { GameState } from './types'

const card = (number: string, instanceId = number) => {
  const conversion = convertOfficialCardToGameCard(getCardPoolEntry(number)!)
  if (conversion.status !== 'converted') throw new Error(`Missing formal ${number}`)
  return { ...conversion.gameCard, instanceId }
}
const fixture = () => {
  const state = createCardCheckDemoState('BS8-022')
  const own = state.players['player-one']
  const hpIds = own.battleArea.flatMap(cookie => cookie.hpCards.map(hp => hp.instanceId))
  expect(new Set(hpIds).size).toBe(hpIds.length)
  const source = own.battleArea[0]
  own.battleArea.push(createCardCheckDemoState('BS8-021').players['player-one'].battleArea[0])
  own.discardPile = [card('BS8-002'), card('BS8-013'), card('BS8-015'), card('BS8-053'), card('BS8-021')]
  const item = own.hand.find(c => c.id === 'BS8-022')!
  const command = { kind: 'begin-play-item' as const, playerId: 'player-one' as const,
    instanceId: item.instanceId, paymentIds: ['support-pay-0'], trashBattleCookieIds: [source.card.instanceId] }
  return { state, own, source, item, command }
}
const recover = (state: GameState, targetIds: string[]) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})

describe('BS8-022 pays a real faint before recovering red LV.1 Cookies', () => {
  it.each([0, 1, 2])('selecting %s cards still pays R and moves the cost Cookie to Break', count => {
    const { state, own, source, item, command } = fixture()
    const before = structuredClone(state)
    const paid = applyGameCommand(state, command)
    expect(state).toEqual(before)
    expect(paid.players['player-one'].breakArea).toEqual([...own.breakArea, source.card])
    expect(paid.players['player-one'].discardPile).toEqual([...own.discardPile, ...source.hpCards, item])
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.departedCookieCounts['player-one']).toBe(1)
    expect(paid.commandLog?.at(-1)?.steps?.some(step => step.text.includes('使餅乾昏厥並送入休息區'))).toBe(true)
    const next = recover(paid, ['BS8-002', 'BS8-013'].slice(0, count))
    expect(next.players['player-one'].hand).toHaveLength(own.hand.length - 1 + count)
    expect(next.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(1)
    expect(next.pendingAbilityEffect).toBeUndefined()
  })

  it('rejects missing, duplicate, or opponent cost targets without spending anything', () => {
    const { state, command } = fixture()
    const before = structuredClone(state)
    for (const ids of [[], [command.trashBattleCookieIds[0], command.trashBattleCookieIds[0]], [state.players['player-two'].battleArea[0].card.instanceId]]) {
      expect(() => applyGameCommand(state, { ...command, trashBattleCookieIds: ids })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('cannot recover the Cookie just paid into Break or wrong-color/high-level/non-Cookies', () => {
    const { state, command, source } = fixture()
    const paid = applyGameCommand(state, command)
    const before = structuredClone(paid)
    for (const ids of [[source.card.instanceId], ['BS8-015'], ['BS8-053'], ['BS8-021'], ['BS8-002', 'BS8-002']]) {
      expect(() => recover(paid, ids)).toThrow()
      expect(paid).toEqual(before)
    }
  })

  it('stops at Break LV10 when payment causes defeat, without recovering or triggering a rescue', () => {
    const { state, own, command } = fixture()
    const level3 = card('BS8-015')
    if (level3.type !== 'cookie') throw new Error('Expected Cookie')
    own.breakArea = [0, 1, 2].map(n => ({ ...level3, instanceId: `break-${n}` }))
    const next = applyGameCommand(state, command)
    expect(next.status).toBe('finished')
    expect(next.result?.winnerId).toBe('player-two')
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.players['player-one'].hand).toHaveLength(own.hand.length - 1)
    expect(next.players['player-one'].discardPile.some(c => c.id === 'BS8-002')).toBe(true)
  })

  it('queues the cost Cookie faint trigger and preserves the Item recovery afterwards', () => {
    const { state, source, command, item } = fixture()
    const wolf = card('BS8-018', source.card.instanceId)
    if (wolf.type !== 'cookie') throw new Error('Expected Cookie')
    source.card = wolf
    let next = applyGameCommand(state, command)
    expect(next.pendingFaintEffects?.[0].sourceCardName).toBe('Cake Wolf')
    expect(next.pendingAbilityEffect?.sourceInstanceId).toBe(item.instanceId)
    expect(() => recover(next, ['BS8-002'])).toThrow()
    next = applyGameCommand(next, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    next = recover(next, ['BS8-002'])
    expect(next.players['player-one'].hand.some(c => c.id === 'BS8-002')).toBe(true)
    expect(next.players['player-one'].breakArea.some(c => c.instanceId === wolf.instanceId)).toBe(true)
  })

  it('allows recovering zero when trash has no matching Cookie', () => {
    const { state, own, item, command } = fixture()
    own.discardPile = []
    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(true)
    expect(recover(applyGameCommand(state, command), []).pendingAbilityEffect).toBeUndefined()
  })

  it('discards all HP, equipment and underlays without treating a faint cost as damage or FLIP', () => {
    const { state, source, command } = fixture()
    const hpFlip = card('BS8-015', 'cost-hp-flip')
    const equipment = card('BS8-021', 'cost-equipment')
    const underlay = card('BS8-002', 'cost-underlay')
    if (underlay.type !== 'cookie') throw new Error('Expected Cookie')
    const awakened = convertOfficialCardToExtraDeckCard(getCardPoolEntry('BS8-027')!)
    if (awakened.status !== 'converted') throw new Error('Expected formal Awakened card')
    source.card = { ...materializeExtraDeckCookie(awakened.extraDeckCard), instanceId: source.card.instanceId }
    source.hpCards = [hpFlip]
    source.equippedCards = [equipment]
    source.awakenedUnderlay = [underlay]
    const next = applyGameCommand(state, command)
    expect(next.pendingBattle).toBeFalsy()
    for (const moved of [hpFlip, equipment, underlay]) {
      expect(next.players['player-one'].discardPile.some(c => c.instanceId === moved.instanceId)).toBe(true)
    }
    expect(next.players['player-one'].breakArea).toContainEqual(source.card)
  })

  it('rejects wrong energy or timing before any Cookie leaves play', () => {
    for (const mode of ['energy', 'opponent-turn', 'phase']) {
      const { state, own, command } = fixture()
      if (mode === 'energy') own.supportArea[0].card.energyColor = 'yellow'
      if (mode === 'opponent-turn') state.activePlayerId = 'player-two'
      if (mode === 'phase') state.phase = 'support'
      const before = structuredClone(state)
      expect(() => applyGameCommand(state, command)).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('keeps the old direct-trash cost semantics and rejects faint through a PlayerState-only helper', () => {
    const { own, source } = fixture()
    const direct = payTrashBattleCookieCost(own, { trashBattleCookie: { count: 1 } }, [source.card.instanceId])
    expect(direct.player.breakArea).toEqual(own.breakArea)
    expect(direct.player.discardPile.some(c => c.instanceId === source.card.instanceId)).toBe(true)
    expect(() => payTrashBattleCookieCost(own, { trashBattleCookie: { count: 1, faint: true } }, [source.card.instanceId])).toThrow('完整遊戲狀態')
  })
})
