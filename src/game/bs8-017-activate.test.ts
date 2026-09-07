import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { getTrashCookieCandidates } from './effects'
import { getCookieSkillUnavailableReason } from './skills'
import type { GameState } from './types'

const sourceId = (state: GameState) => state.players['player-one'].battleArea[0].card.instanceId
const begin = (state: GameState, paymentIds = ['support-pay-0']) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId(state),
  trigger: 'activate', paymentIds,
})
const resolve = (state: GameState, targetIds: string[] = []) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})

describe('BS8-017 paid optional revival and conditional damage', () => {
  it.each(['rested', 'wrong-color'])('explains insufficient skill energy (%s) using the shared payment rules', (reason) => {
    const state = createCardCheckDemoState('BS8-017')
    for (const support of state.players['player-one'].supportArea) {
      if (reason === 'rested') support.rested = true
      else support.card.energyColor = 'yellow'
    }
    expect(getCookieSkillUnavailableReason(state, 'player-one', sourceId(state), 'activate'))
      .toBe('沒有足夠且顏色符合的活躍支援卡可支付技能能量。')
  })
  it.each(['BS8-017', 'BS8-017@1'])('%s pays R and uses the turn even if no Cookie is played; no damage follows', (id) => {
    const state = createCardCheckDemoState(id)
    const next = resolve(begin(state))
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.players['player-one'].supportArea.filter(card => card.rested)).toHaveLength(1)
    expect(next.players['player-one'].deck).toEqual(state.players['player-one'].deck)
    expect(next.players['player-one'].discardPile).toEqual(state.players['player-one'].discardPile)
    expect(next.players['player-two']).toEqual(state.players['player-two'])
    expect(() => begin(next, ['support-pay-1'])).toThrow()
  })

  it.each([false, true])('revives with physical HP 1 before optional damage (damage=%s)', (damage) => {
    const state = createCardCheckDemoState('BS8-017')
    const target = state.players['player-one'].discardPile.find(card => card.id === 'BS8-013')!
    const revived = resolve(begin(state), [target.instanceId])
    expect(revived.players['player-one'].battleArea[1]).toMatchObject({
      card: target, enteredFrom: 'trash', hpCards: [state.players['player-one'].deck[0]],
    })
    expect(revived.players['player-one'].deck).toEqual(state.players['player-one'].deck.slice(1))
    const opponent = state.players['player-two'].battleArea[0]
    const next = resolve(revived, damage ? [opponent.card.instanceId] : [])
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(opponent.hpCards.length - Number(damage))
  })

  it('rejects non-red and printed HP 2 candidates and a full battle area without mutating payment or cards', () => {
    const state = createCardCheckDemoState('BS8-017')
    const own = state.players['player-one']
    const original = own.discardPile.find(card => card.id === 'BS8-013')!
    if (original.type !== 'cookie') throw new Error('Expected a Cookie fixture')
    const wrongColor = { ...original, instanceId: 'wrong-color', energyColor: 'yellow' as const }
    const wrongHp = { ...original, instanceId: 'wrong-hp', hp: 2 }
    own.discardPile.push(wrongColor, wrongHp)
    const started = begin(state)
    for (const candidate of [wrongColor, wrongHp]) {
      const before = structuredClone(started)
      expect(() => resolve(started, [candidate.instanceId])).toThrow()
      expect(started).toEqual(before)
    }
    own.battleArea.push({ ...own.battleArea[0], card: { ...original, instanceId: 'second-slot' } })
    const effect = own.battleArea[0].card.skill!.effects[0]
    if (effect.kind !== 'trash-to-battle') throw new Error('Expected revival')
    expect(getTrashCookieCandidates(state, { sourcePlayerId: 'player-one', sourceInstanceId: sourceId(state) }, effect)).toEqual([])
    const full = begin(state)
    expect(() => resolve(full, [original.instanceId])).toThrow()
    expect(resolve(full).pendingAbilityEffect).toBeUndefined()
  })

  it('rejects unpaid, wrong-colour, and wrong-turn activation before moving cards', () => {
    const state = createCardCheckDemoState('BS8-017')
    const before = structuredClone(state)
    expect(() => begin(state, [])).toThrow()
    expect(state).toEqual(before)
    state.players['player-one'].supportArea[0].card.energyColor = 'yellow'
    const wrongColor = structuredClone(state)
    expect(() => begin(state)).toThrow()
    expect(state).toEqual(wrongColor)
    state.players['player-one'].supportArea[0].card.energyColor = 'red'
    state.activePlayerId = 'player-two'
    const wrongTurn = structuredClone(state)
    expect(() => begin(state)).toThrow()
    expect(state).toEqual(wrongTurn)
  })
})
