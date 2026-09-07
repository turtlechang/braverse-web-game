import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { resolveNextDamage } from './battle'
import { canActivateStage } from './card-abilities'
import { getCardPoolEntry } from './card-pool'
import { normalizeOfficialCardRecord, convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import officialBs8 from '../../data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
import type { OfficialCardRecord } from '../cards/types'

describe('BS8-024 printed stage costs and effects across both artworks', () => {
  it('corrects the alternate-art JSON at the adapter boundary without changing its source', () => {
    const source = (officialBs8.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'BS8-024@1')!
    expect(source.skill.text).toContain('Make 1 of your Cookies faint')
    const before = structuredClone(source)
    const base = normalizeOfficialCardRecord(getCardPoolEntry('BS8-024')!)
    const normalized = normalizeOfficialCardRecord(source)
    expect(normalized.skill.text).toBe(base.skill.text)
    expect(getCardPoolEntry('BS8-024@1')!.skill.text).toBe(base.skill.text)
    expect(source).toEqual(before)
    expect(normalized.cardNumber).toBe('BS8-024@1')
    expect(normalized.imageUrl).toBe(source.imageUrl)
    expect(normalizeOfficialCardRecord(normalized)).toEqual(normalized)
    const converted = convertOfficialCardToGameCard(source)
    if (converted.status !== 'converted') throw new Error('Expected formal stage')
    expect(converted.gameCard.stageAbility?.text).not.toContain('faint')
    expect(converted.gameCard.stageAbility?.cost.trashBattleCookie).toBeUndefined()
  })

  it.each(['BS8-024', 'BS8-024@1'])('%s pays R to replace the old stage, then RR and rests for both sides damage', (number) => {
    const initial = createCardCheckDemoState(number)
    const owner = initial.players['player-one']
    const card = owner.hand.find(c => c.id === 'BS8-024')!
    const before = structuredClone(initial)
    const placed = applyGameCommand(initial, { kind: 'play-stage', playerId: 'player-one', instanceId: card.instanceId, paymentIds: ['support-pay-0'] })
    expect(initial).toEqual(before)
    expect(placed.players['player-one'].discardPile).toContainEqual(owner.stage!.card)
    expect(placed.players['player-one'].stage).toEqual({ card, rested: false })
    let state = applyGameCommand(placed, { kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: ['support-pay-1', 'support-pay-2'] })
    expect(state.players['player-one'].stage?.rested).toBe(true)
    expect(state.players['player-one'].breakArea).toEqual(owner.breakArea)
    expect(state.players['player-one'].supportArea.filter(s => s.rested)).toHaveLength(3)
    const targetIds = Object.values(state.players).flatMap(player => player.battleArea).map(cookie => cookie.card.instanceId)
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })
    for (let index = 0; index < 20 && state.pendingBattle?.effectDamageSequence; index++) state = resolveNextDamage(state)
    expect(state.pendingBattle?.effectDamageSequence).toBeUndefined()
    for (const playerId of ['player-one', 'player-two'] as const) {
      expect(state.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual(initial.players[playerId].battleArea.map(c => c.hpCards.length - 1))
    }
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(canActivateStage(state, 'player-one')).toBe(false)
    expect(() => applyGameCommand(state, { kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: ['support-pay-3', 'support-pay-4'] })).toThrow()
  })

  it.each(['BS8-024', 'BS8-024@1'])('%s rejects wrong color and insufficient activation payment without damage', (number) => {
    const initial = createCardCheckDemoState(number)
    const card = initial.players['player-one'].hand.find(c => c.id === 'BS8-024')!
    initial.players['player-one'].supportArea[5].card.energyColor = 'yellow'
    expect(() => applyGameCommand(initial, { kind: 'play-stage', playerId: 'player-one', instanceId: card.instanceId, paymentIds: ['support-pay-5'] })).toThrow()
    const placed = applyGameCommand(initial, { kind: 'play-stage', playerId: 'player-one', instanceId: card.instanceId, paymentIds: ['support-pay-0'] })
    const before = structuredClone(placed)
    for (const paymentIds of [[], ['support-pay-1'], ['support-pay-1', 'support-pay-1'], ['support-pay-1', 'support-pay-5'], ['support-pay-0', 'support-pay-1']]) {
      expect(() => applyGameCommand(placed, { kind: 'begin-activate-stage', playerId: 'player-one', paymentIds })).toThrow()
      expect(placed).toEqual(before)
    }
  })
})
