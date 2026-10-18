import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { getEffectiveAttack } from './effects'
import { canActivateCookieSkill } from './skills'
import { createSt6004State as fixture } from './st6-004-demo'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

const playerId = 'player-one' as const
const activate = (state: ReturnType<typeof fixture>) => applyGameCommand(state, { kind: 'activate-skill', playerId, trigger: 'activate',
  sourceInstanceId: state.players[playerId].battleArea[0].card.instanceId, paymentIds: [],
  discardHandIds: [state.players[playerId].hand[0].instanceId], effectTargets: [[state.players[playerId].battleArea[0].card.instanceId]] })
const attackThen = (scenario: DeckAdditionScenario = 'attack', targetIndex = 0) => {
  let state = fixture(scenario)
  state = applyGameCommand(state, { kind: 'declare-attack', playerId,
    attackerInstanceId: state.players[playerId].battleArea[0].card.instanceId,
    targetInstanceId: state.players['player-two'].battleArea[targetIndex].card.instanceId,
    supportPaymentIds: state.players[playerId].supportArea.slice(0, 3).map(s => s.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  while (state.pendingBattle?.stage === 'damage') state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
const pay = (state: ReturnType<typeof fixture>, targetIds: string[]) => {
  let next = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay',
    paymentIds: [state.players[playerId].supportArea[3].card.instanceId], targetIds })
  while (next.pendingBattle?.stage === 'damage') next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return next
}

describe('ST6-004 original-printing rules and local acceptance states', () => {
  it.each(['positive', 'negative', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase', 'used', 'zero',
    'no-energy', 'rested-source', 'no-extra-energy', 'attack-wrong-color', 'target-faints'] as const)(
    '%s preserves sixty unique physical cards, printed copy limits and the battle-zone limit', scenario => {
      for (const player of Object.values(fixture(scenario).players)) {
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
        expect(player.battleArea.length).toBeLessThanOrEqual(2)
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
        const counts = new Map<string, number>()
        for (const card of cards) {
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
          counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
        }
        expect([...counts.values()].every(count => count <= 4)).toBe(true)
      }
    },
  )
  it.each(['positive', 'no-energy', 'rested-source'] as const)('%s pays an arbitrary hand item, no support or REST, for only the source attack bonus', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    const source = state.players[playerId].battleArea[0], other = state.players[playerId].battleArea[1]
    const next = activate(state)
    expect(next.players[playerId].hand).toHaveLength(1)
    expect(next.players[playerId].discardPile.at(-1)?.id).toBe('BS12-007')
    expect(next.players[playerId].supportArea).toEqual(state.players[playerId].supportArea)
    expect(next.players[playerId].battleArea[0].rested).toBe(source.rested)
    expect(getEffectiveAttack(next, source.card.instanceId)).toBe(4)
    expect(getEffectiveAttack(next, other.card.instanceId)).toBe(1)
    expect(state).toEqual(before)
  })
  it.each(['negative', 'wrong-phase', 'used'] as const)('%s blocks activation for its independent boundary', scenario => {
    const state = fixture(scenario), player = state.players[playerId]
    expect(player.supportArea.filter(s => !s.rested)).toHaveLength(4)
    if (scenario !== 'negative') expect(player.hand.length).toBeGreaterThan(0)
    expect(canActivateCookieSkill(state, playerId, player.battleArea[0].card.instanceId, 'activate')).toBe(false)
  })
  it('normal RRR3 opens separate R payment and allows damage to the other opponent', () => {
    const state = attackThen(), source = state.players[playerId].battleArea[0]
    expect(state.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    expect(state.pendingOptionalCostAttack?.cost.energy).toEqual({ red: 1 })
    expect(state.pendingOptionalCostAttack?.sourceEnergy).toBeUndefined()
    expect(state.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, true, false])
    const next = pay(state, [state.players['player-two'].battleArea[1].card.instanceId])
    expect(next.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 2])
    expect(next.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(next.players[playerId].battleArea[0].hpCards).toHaveLength(4)
    expect(next.players[playerId].battleArea[0].card.instanceId).toBe(source.card.instanceId)
  })
  it('paid zero targets spends R; skipping does not spend R, and neither deals extra damage', () => {
    const state = attackThen()
    const zero = pay(state, [])
    const skip = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(zero.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    expect(skip.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    expect(zero.players[playerId].supportArea[3].rested).toBe(true)
    expect(skip.players[playerId].supportArea[3].rested).toBe(false)
  })
  it.each(['no-extra-energy', 'attack-wrong-color'] as const)('%s can pay normal RRR3 but cannot pay another R', scenario => {
    const state = attackThen(scenario)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(() => pay(state, [])).toThrow()
  })
  it('another opponent remains a legal Then target after the original defender faints', () => {
    const state = attackThen('target-faints', 1)
    expect(state.players['player-two'].battleArea).toHaveLength(1)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(state.pendingOptionalCostAttack).toBeTruthy()
    const next = pay(state, [state.players['player-two'].battleArea[0].card.instanceId])
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it('the paid Activate increases actual normal damage to four without replacing the separately paid Then', () => {
    const state = attackThen('used')
    expect(state.players['player-two'].battleArea.map(c => c.card.id)).toEqual(['ST1-005'])
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    const next = pay(state, [state.players['player-two'].battleArea[0].card.instanceId])
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(next.players[playerId].hand).toHaveLength(1)
  })
})
