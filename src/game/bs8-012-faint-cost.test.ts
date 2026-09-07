import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { createCardCheckDemoState } from './demo'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'

describe('BS8-012 Your Turn faint source cost before optional drawing', () => {
  it('an opponent normal attack cannot activate this Your Turn faint skill', () => {
    const state = createCardCheckDemoState('BS8-006')
    const converted = convertOfficialCardToGameCard(getCardPoolEntry('BS8-012')!)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing formal Cookie')
    const target = state.players['player-two'].battleArea[0]
    target.card = { ...converted.gameCard, instanceId: 'opponent-bs8-012' }
    target.hpCards = target.hpCards.slice(0, 1)
    let next = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: state.players['player-one'].supportArea.slice(0, 2).map((support) => support.card.instanceId) })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(next.players['player-two'].breakArea.some((card) => card.instanceId === target.card.instanceId)).toBe(true)
    expect(next.pendingFaintEffects).toBeUndefined()
  })
  it.each(['player-one', 'player-two'] as const)('real effect damage queues the skill only on its owner turn (active=%s)', (activePlayerId) => {
    const state = createCardCheckDemoState('BS8-006')
    const converted = convertOfficialCardToGameCard(getCardPoolEntry('BS8-012')!)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing formal Cookie')
    state.activePlayerId = activePlayerId
    const source = state.players['player-one'].battleArea[0]
    source.card = { ...converted.gameCard, instanceId: 'real-bs8-012-faint' }
    const next = executeCardEffect(state, { sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId },
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } }, [source.card.instanceId])
    expect(next.players['player-one'].breakArea.some((card) => card.instanceId === source.card.instanceId)).toBe(true)
    expect(next.pendingFaintEffects?.filter((effect) => effect.sourceInstanceId === source.card.instanceId) ?? [])
      .toHaveLength(activePlayerId === 'player-one' ? 2 : 0)
  })

  it.each([0, 1])('draw %s still requires moving its source from Break to trash first', (drawCount) => {
    const state = createCardCheckDemoState('BS8-012')
    const own = state.players['player-one']
    const sourceId = state.pendingFaintEffects![0].sourceInstanceId
    const paid = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    expect(paid.players['player-one'].breakArea.some((card) => card.instanceId === sourceId)).toBe(false)
    expect(paid.players['player-one'].discardPile.some((card) => card.instanceId === sourceId)).toBe(true)
    expect(paid.players['player-one'].hand).toEqual(own.hand)
    const awaitingDraw = applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    expect(awaitingDraw.pendingDrawUpTo?.max).toBe(1)
    const next = applyGameCommand(awaitingDraw, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
    expect(next.players['player-one'].hand).toHaveLength(own.hand.length + drawCount)
    expect(next.players['player-one'].deck).toHaveLength(own.deck.length - drawCount)
    expect(next.players['player-one'].supportArea).toEqual(own.supportArea)
    expect(next.pendingFaintEffects).toBeUndefined()
  })

  it('cannot draw when an earlier effect has already moved the source out of Break', () => {
    const state = createCardCheckDemoState('BS8-012')
    const source = state.pendingFaintEffects![0]
    const moved = executeCardEffect(state, source.context, { kind: 'break-source-to-trash' }, [])
    expect(moved.players['player-one'].breakArea.some((card) => card.instanceId === source.sourceInstanceId)).toBe(false)
    const next = applyGameCommand(moved, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    expect(next.pendingFaintEffects?.some((effect) => effect.sourceInstanceId === source.sourceInstanceId) ?? false).toBe(false)
    expect(next.pendingDrawUpTo).toBeFalsy()
    expect(next.players['player-one'].hand).toEqual(moved.players['player-one'].hand)
    expect(next.players['player-one'].deck).toEqual(moved.players['player-one'].deck)
    expect(next.commandLog?.at(-1)?.steps?.[0].text).toContain('無法支付來源代價，後續效果未執行')
  })
})
