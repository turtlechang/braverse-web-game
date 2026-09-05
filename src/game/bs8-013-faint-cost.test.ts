import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { getFaintEffectCardCandidates } from './battle'
import { createCardCheckDemoState } from './demo'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'

const formal = (id: string, suffix: string) => {
  const converted = convertOfficialCardToGameCard(getCardPoolEntry(id)!)
  if (converted.status !== 'converted') throw new Error(`Missing ${id}`)
  return { ...converted.gameCard, instanceId: `${id}:${suffix}` }
}
const paySource = (state: ReturnType<typeof createCardCheckDemoState>) =>
  applyGameCommand(state, {kind:'resolve-faint-effect',playerId:'player-one',targetIds:[]})

describe('BS8-013 faint source cost and red LV.1 recovery', () => {
  it.each(['player-one','player-two'] as const)('real damage respects Your Turn (active=%s)', (activePlayerId) => {
    const state = createCardCheckDemoState('BS8-006')
    const source = formal('BS8-013','actual-faint')
    if (source.type !== 'cookie') throw new Error('Expected Cookie')
    state.activePlayerId = activePlayerId
    state.players['player-one'].battleArea[0].card = source
    const next = executeCardEffect(state, {sourcePlayerId:'player-one',sourceInstanceId:source.instanceId},
      {kind:'damage',amount:1,target:{side:'self',min:1,max:1}}, [source.instanceId])
    expect(next.pendingFaintEffects?.filter((effect) => effect.sourceInstanceId === source.instanceId) ?? [])
      .toHaveLength(activePlayerId === 'player-one' ? 2 : 0)
  })
  it('excludes same-name, wrong-color, LV.2 and item candidates, including the just-paid source', () => {
    const state = createCardCheckDemoState('BS8-013')
    state.players['player-one'].discardPile.push(formal('BS8-013','same-name'), formal('BS8-026','yellow'),
      formal('BS8-006','red-lv2'), formal('BS8-022','item'))
    const next = paySource(state)
    const candidates = getFaintEffectCardCandidates(next)
    expect(candidates.length).toBeGreaterThan(0)
    for (const card of candidates) {
      expect(card.type).toBe('cookie')
      if (card.type !== 'cookie') throw new Error('Expected Cookie')
      expect(card.level).toBe(1)
      expect(card.energyColor).toBe('red')
      expect(card.name).not.toBe('Pomegranate Cake Shaman')
    }
    for (const id of ['BS8-013:same-name','BS8-026:yellow','BS8-006:red-lv2','BS8-022:item']) {
      expect(() => applyGameCommand(next, {kind:'resolve-faint-effect',playerId:'player-one',targetIds:[id]})).toThrow()
    }
  })

  it.each([false,true])('pays the source once before recovery (choose=%s)', (choose) => {
    const state = createCardCheckDemoState('BS8-013')
    const sourceId = state.pendingFaintEffects![0].sourceInstanceId
    const paid = paySource(state)
    const candidate = getFaintEffectCardCandidates(paid)[0]
    const next = applyGameCommand(paid, {kind:'resolve-faint-effect',playerId:'player-one',targetIds:choose?[candidate.instanceId]:[]})
    expect(next.players['player-one'].discardPile.filter((card) => card.instanceId === sourceId)).toHaveLength(1)
    expect(next.players['player-one'].battleArea.some((entry) => entry.card.instanceId === candidate.instanceId)).toBe(choose)
    expect(next.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea)
    expect(next.pendingFaintEffects).toBeUndefined()
    if (choose) {
      const revived = next.players['player-one'].battleArea.find((entry) => entry.card.instanceId === candidate.instanceId)!
      expect(revived.rested).toBe(false)
      expect(revived.hpCards).toHaveLength(revived.card.hp)
    }
  })

  it('cannot revive a Cookie when the source cost is no longer payable', () => {
    const state = createCardCheckDemoState('BS8-013')
    const source = state.pendingFaintEffects![0]
    const moved = executeCardEffect(state, source.context, {kind:'break-source-to-trash'}, [])
    const next = paySource(moved)
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players['player-one'].battleArea).toEqual(moved.players['player-one'].battleArea)
  })
})
