import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getCookieEffectiveHp } from './helpers'
import { createBattleState } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}
const cookie = (id: string, suffix: string) => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}
const setup = (targetHp = 1, bonus = 0) => {
  const base = createBattleState()
  const item = official('BS8-046', 'item')
  const target = cookie('BS8-039', 'target')
  const opponent = cookie('BS8-034', 'opponent')
  const supports = [official('BS8-037', 'pay-one'), official('BS8-037', 'pay-two')]
  const state: GameState = { ...base, players: { ...base.players,
    'player-two': { ...base.players['player-two'], hand: [item],
      battleArea: [{ card: target, hpCards: Array.from({ length: targetHp }, (_, index) => official(bonus > 0 ? 'BS8-036' : 'BS8-046', `target-hp-${index}`)), rested: false }],
      supportArea: supports.map((card) => ({ card, rested: false })),
      deck: [official('BS8-046', 'new-hp'), official('BS8-046', 'deck-bottom')],
    },
    'player-one': { ...base.players['player-one'], battleArea: [{ card: opponent, hpCards: [official('BS8-046', 'opponent-hp')], rested: false }] },
  } }
  const command = { kind: 'play-item' as const, playerId: 'player-two' as const, instanceId: item.instanceId, paymentIds: [supports[0].instanceId] }
  return { state, item, target, opponent, command }
}

describe('BS8-046 Surprise! Lassi Jar exact effective HP target', () => {
  it('maps the printed exact one-HP restriction and pays Y1 to give that own Cookie one actual HP card', () => {
    const { state, item, target, command } = setup()
    if (item.type !== 'item') throw new Error('Expected official Item')
    expect(item.item?.cost).toEqual({ yellow: 1 })
    expect(item.item?.effects).toEqual([{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, minRemainingHp: 1, maxRemainingHp: 1 } }])
    expect(getCookieEffectiveHp(state.players['player-two'].battleArea[0])).toBe(1)
    const result = applyGameCommand(state, { ...command, effectTargets: [[target.instanceId]] })
    expect(result.players['player-two'].battleArea[0].hpCards).toEqual([...state.players['player-two'].battleArea[0].hpCards, state.players['player-two'].deck[0]])
    expect(getCookieEffectiveHp(result.players['player-two'].battleArea[0])).toBe(2)
    expect(result.players['player-two'].deck).toEqual(state.players['player-two'].deck.slice(1))
    expect(result.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([true, false])
    expect(result.players['player-two'].hand).not.toContainEqual(item)
    expect(result.players['player-two'].discardPile).toContainEqual(item)
    expect(result.players['player-one']).toEqual(state.players['player-one'])
    expect(() => applyGameCommand(result, { ...command, paymentIds: [result.players['player-two'].supportArea[1].card.instanceId], effectTargets: [[]] })).toThrow()
  })

  it.each([1, 2])('may select zero with current HP%i, still paying and discarding the used Item', (hp) => {
    const { state, item, command } = setup(hp)
    const result = applyGameCommand(state, { ...command, effectTargets: [[]] })
    expect(result.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
    expect(result.players['player-two'].deck).toEqual(state.players['player-two'].deck)
    expect(result.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([true, false])
    expect(result.players['player-two'].hand).not.toContainEqual(item)
    expect(result.players['player-two'].discardPile).toContainEqual(item)
    expect(result.pendingAbilityEffect).toBeFalsy()
  })

  it('accepts one physical HP containing an unrevealed gain-HP FLIP', () => {
    const { state, target, command } = setup(1, 1)
    expect(getCookieEffectiveHp(state.players['player-two'].battleArea[0])).toBe(1)
    const result = applyGameCommand(state, { ...command, effectTargets: [[target.instanceId]] })
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(result.players['player-two'].supportArea[0].rested).toBe(true)
  })

  it.each(['two-hp', 'opponent', 'duplicate', 'unknown'] as const)('rejects %s selection without spending support or moving the Item', (selection) => {
    const { state, target, opponent, command } = setup(selection === 'two-hp' ? 2 : 1)
    const ids = selection === 'opponent' ? [opponent.instanceId] : selection === 'duplicate' ? [target.instanceId, target.instanceId] : selection === 'unknown' ? ['missing'] : [target.instanceId]
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { ...command, effectTargets: [ids] })).toThrow()
    expect(state).toEqual(snapshot)
  })

  it.each(['missing', 'red', 'rested'] as const)('rejects %s payment even when selecting zero', (scenario) => {
    const { state, command } = setup()
    const payment = official(scenario === 'red' ? 'BS8-009' : 'BS8-037', 'invalid-payment')
    const prepared: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], supportArea: scenario === 'missing' ? [] : [{ card: payment, rested: scenario === 'rested' }] } } }
    const snapshot = structuredClone(prepared)
    expect(() => applyGameCommand(prepared, { ...command, paymentIds: scenario === 'missing' ? [] : [payment.instanceId], effectTargets: [[]] })).toThrow()
    expect(prepared).toEqual(snapshot)
  })
})
