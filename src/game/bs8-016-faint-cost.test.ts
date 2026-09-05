import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { getFaintEffectCardCandidates } from './battle'
import { createCardCheckDemoState } from './demo'

const resolve = (state: ReturnType<typeof createCardCheckDemoState>, targetIds: string[] = []) =>
  applyGameCommand(state,{kind:'resolve-faint-effect',playerId:'player-one',targetIds})

describe('BS8-016 source cost before optional HP gain', () => {
  it('cannot gain HP when an earlier effect moved its source out of Break', () => {
    const state = createCardCheckDemoState('BS8-016')
    const source = state.pendingFaintEffects![0]
    const moved = executeCardEffect(state,source.context,{kind:'break-source-to-trash'},[])
    const next = resolve(moved)
    expect(next.pendingFaintEffects?.some(effect=>effect.sourceInstanceId===source.sourceInstanceId) ?? false).toBe(false)
    expect(next.players['player-one'].battleArea).toEqual(moved.players['player-one'].battleArea)
    expect(next.players['player-one'].deck).toEqual(moved.players['player-one'].deck)
    expect(next.commandLog?.at(-1)?.steps?.[0].text).toContain('無法支付來源代價，後續效果未執行')
  })

  it.each([0,1])('pays its source first even when selecting %s targets', (count) => {
    const state = createCardCheckDemoState('BS8-016')
    const sourceId=state.pendingFaintEffects![0].sourceInstanceId
    const own=state.players['player-one']
    const paid=resolve(state)
    expect(paid.players['player-one'].breakArea.some(card=>card.instanceId===sourceId)).toBe(false)
    expect(paid.players['player-one'].discardPile.some(card=>card.instanceId===sourceId)).toBe(true)
    const target=paid.players['player-one'].battleArea[0]
    const next=resolve(paid,count ? [target.card.instanceId] : [])
    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(target.hpCards.length+count)
    expect(next.players['player-one'].deck).toEqual(own.deck.slice(count))
    expect(next.pendingFaintEffects).toBeUndefined()
  })

  it.each([5,6])('uses the exact HP5/6 eligibility boundary (HP=%s)', (hp) => {
    const state=resolve(createCardCheckDemoState('BS8-016'))
    const target=state.players['player-one'].battleArea[0]
    const needed=hp-target.hpCards.length
    target.hpCards=[...target.hpCards,...state.players['player-one'].deck.slice(0,needed)]
    state.players['player-one'].deck=state.players['player-one'].deck.slice(needed)
    const candidates=getFaintEffectCardCandidates(state).map(card=>card.instanceId)
    expect(candidates.includes(target.card.instanceId)).toBe(hp===5)
    expect(candidates.some(id=>state.players['player-two'].battleArea.some(cookie=>cookie.card.instanceId===id))).toBe(false)
    if(hp===5) expect(resolve(state,[target.card.instanceId]).players['player-one'].battleArea[0].hpCards).toHaveLength(6)
    else {
      const before=structuredClone(state)
      expect(()=>resolve(state,[target.card.instanceId])).toThrow()
      expect(state).toEqual(before)
      expect(resolve(state).players['player-one'].battleArea[0].hpCards).toHaveLength(6)
    }
  })
})
