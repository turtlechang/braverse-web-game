import { describe, expect, it } from 'vitest'
import { createSt6006PreviewState as fixture } from './st6-006-demo'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'

describe('ST6-006 original Cherry Cookie printing', () => {
  it.each(['positive', 'low', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase'] as const)(
    '%s uses sixty original cards with unique instances, four-copy and battle limits', scenario => {
      const state = fixture(scenario)
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-006:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-006', scenario })
      for (const player of Object.values(state.players)) {
        const revealed = state.pendingBattle?.defenderPlayerId === player.id ? state.pendingBattle.revealedHpCard : null
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards]), ...(revealed ? [revealed] : [])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
        expect(player.battleArea.length).toBeLessThanOrEqual(2)
        const counts = new Map<string, number>()
        for (const card of cards) {
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
          counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
        }
        expect([...counts.values()].every(count => count <= 4)).toBe(true)
      }
    },
  )

  it.each(['positive', 'low'] as const)('returns only the revealed card with an empty hand (%s)', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    const revealed = state.pendingBattle?.revealedHpCard
    expect(revealed).toMatchObject({ id: 'ST6-006', level: 2, hp: 4, attack: 3, attackEnergyCost: { red: 3 } })
    expect(state.players['player-one'].hand).toEqual([])
    const next = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
    expect(next.players['player-one'].hand.map(c => c.instanceId)).toEqual([revealed?.instanceId])
    expect(next.players['player-one'].discardPile.some(c => c.instanceId === revealed?.instanceId)).toBe(false)
    expect(next.players['player-one'].battleArea.map(c => c.card.id)).toEqual(scenario === 'low' ? ['ST1-011'] : ['ST1-005', 'ST1-011'])
    expect(next.players['player-one'].battleArea.at(-1)?.hpCards).toHaveLength(2)
    if (scenario === 'positive') expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    else expect(next.players['player-one'].breakArea.map(c => c.id)).toContain('ST1-005')
    expect(state).toEqual(before)
  })

  it.each(['positive', 'low'] as const)('skipping leaves the revealed card in discard (%s)', scenario => {
    const state = fixture(scenario), revealed = state.pendingBattle?.revealedHpCard
    const next = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: false })
    expect(next.players['player-one'].hand).toEqual([])
    expect(next.players['player-one'].discardPile.map(c => c.instanceId)).toContain(revealed?.instanceId)
  })

  it('rejects the wrong actor without changing the state', () => {
    const state = fixture('positive'), before = structuredClone(state)
    expect(() => applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-two', activate: true })).toThrow()
    expect(state).toEqual(before)
  })

  it('pays RRR for normal three damage without a Then', () => {
    const state = fixture('attack'), owner = 'player-one' as const
    let next = applyGameCommand(state, { kind: 'declare-attack', playerId: owner,
      attackerInstanceId: state.players[owner].battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: state.players[owner].supportArea.map(s => s.card.instanceId) })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; i < 3; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(next.players['player-two'].breakArea.map(c => c.id)).toContain('ST1-005')
    expect(next.players[owner].supportArea.every(s => s.rested)).toBe(true)
    expect(next.players[owner].battleArea[0].rested).toBe(true)
    expect(next.players[owner].battleArea[0].card.attackEffects ?? []).toEqual([])
  })

  it.each(['attack-negative', 'wrong-color', 'wrong-phase'] as const)('blocks %s', scenario => {
    const state = fixture(scenario)
    expect(getLegalTurnCommands(state, 'player-one').some(c => c.kind === 'attack' && c.attackerInstanceId === state.players['player-one'].battleArea[0].card.instanceId)).toBe(false)
  })
})
