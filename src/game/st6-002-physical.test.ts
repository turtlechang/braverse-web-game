import { describe, expect, it } from 'vitest'
import { createSt6002State as fixture } from './st6-002-demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'

const playerId = 'player-one' as const
const then = (scenario: 'attack' | 'low' | 'target-faints' = 'attack', targetIndex = 0) => {
  let state = fixture(scenario)
  state = applyGameCommand(state, { kind: 'declare-attack', playerId,
    attackerInstanceId: state.players[playerId].battleArea[0].card.instanceId,
    targetInstanceId: state.players['player-two'].battleArea[targetIndex].card.instanceId,
    supportPaymentIds: state.players[playerId].supportArea.slice(0, 2).map(s => s.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}

describe('ST6-002 original-printing acceptance fixture', () => {
  it('does not offer HP payment or retarget Then after normal damage knocks out the original defender', () => {
    const state = then('target-faints', 1)
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(6)
    expect(state.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4])
    expect(state.players['player-two'].breakArea.some(c => c.id === 'ST7-005')).toBe(true)
  })
  it.each(['positive', 'negative', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase', 'used', 'low', 'zero', 'target-faints'] as const)(
    '%s keeps sixty unique physical cards and printed copy limits', scenario => {
      for (const p of Object.values(fixture(scenario).players)) {
        expect(p.battleArea.length).toBeLessThanOrEqual(2)
        const cards = [...p.deck, ...p.hand, ...p.discardPile, ...p.breakArea,
          ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
        const counts = new Map<string, number>()
        for (const c of cards) {
          counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
          expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
        }
        expect([...counts.values()].every(n => n <= 4)).toBe(true)
      }
    },
  )

  it('low HP follows two real attacks from printed 6 HP, then pays the last HP before extra damage', () => {
    let state = then('low')
    const source = state.players[playerId].battleArea[0], target = state.players['player-two'].battleArea[0]
    expect(source.card.hp).toBe(6)
    expect(source.hpCards).toHaveLength(1)
    expect(target.hpCards).toHaveLength(3)
    state = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay',
      hpToTrashIds: [source.card.instanceId], targetIds: [target.card.instanceId] })
    while (state.pendingBattle?.stage === 'damage') {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    }
    expect(state.players[playerId].breakArea.map(c => c.instanceId)).toContain(source.card.instanceId)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players['player-two'].battleArea.slice(1).map(c => c.hpCards.length)).toEqual([3])
    expect(state.pendingReplacement?.tasks[0].playerId).toBe(playerId)
    state = applyGameCommand(state, { kind: 'skip-replacement', playerId })
    expect(state.pendingReplacement).toBeNull()
    expect(state.pendingBattle).toBeNull()
    expect(state.phase).toBe('main')
  })

  it('skipping Then preserves all six source HP and permits the rested source to activate with remaining R', () => {
    const initial = then(), source = initial.players[playerId].battleArea[0]
    let state = applyGameCommand(initial, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(6)
    expect(state.players[playerId].battleArea[0].rested).toBe(true)
    expect(canActivateCookieSkill(state, playerId, source.card.instanceId, 'activate')).toBe(true)
    state = applyGameCommand(state, { kind: 'activate-skill', playerId, trigger: 'activate',
      sourceInstanceId: source.card.instanceId,
      paymentIds: [state.players[playerId].supportArea[2].card.instanceId], effectTargets: [[]] })
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(6)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })

  it.each(['negative', 'wrong-color', 'wrong-phase', 'used'] as const)('%s blocks skill for its specific boundary', scenario => {
    const state = fixture(scenario), p = state.players[playerId]
    if (scenario !== 'negative') expect(p.supportArea.some(s => !s.rested)).toBe(true)
    if (scenario === 'used') expect(p.supportArea.filter(s => !s.rested)).toHaveLength(2)
    expect(canActivateCookieSkill(state, playerId, p.battleArea[0].card.instanceId, 'activate')).toBe(false)
  })
})
