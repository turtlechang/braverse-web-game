import { describe, expect, it } from 'vitest'
import { createSt6001State as fixture } from './st6-001-demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'

const playerId = 'player-one' as const
const activate = (state: ReturnType<typeof fixture>, targets: string[], hpId = state.players[playerId].battleArea[0].card.instanceId) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, trigger: 'activate', sourceInstanceId: state.players[playerId].battleArea[0].card.instanceId,
  paymentIds: state.players[playerId].supportArea.map(s => s.card.instanceId), hpToTrashTargetIds: [hpId], effectTargets: [targets],
})
describe('ST6-001 physical payment and settlement', () => {
  it('normal R attack deals 1 without paying HP; rested support cannot pay', () => {
    const attack = (state: ReturnType<typeof fixture>) => applyGameCommand(state, {
      kind: 'declare-attack', playerId, attackerInstanceId: state.players[playerId].battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: state.players[playerId].supportArea.map(s => s.card.instanceId),
    })
    let state = attack(fixture('attack'))
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players[playerId].battleArea[0].rested).toBe(true)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(() => attack(fixture('attack-negative'))).toThrow()
  })
  it('paying the source last HP makes it faint, then still resolves the paid damage', () => {
    const state = fixture('low'), source = state.players[playerId].battleArea[0]
    const result = activate(state, [state.players['player-two'].battleArea[0].card.instanceId])
    expect(result.players[playerId].battleArea.some(c => c.card.instanceId === source.card.instanceId)).toBe(false)
    expect(result.players[playerId].breakArea.map(c => c.instanceId)).toContain(source.card.instanceId)
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players[playerId].discardPile).toHaveLength(2)
  })
  it('pays source top HP before damaging only selected enemy and consumes Once without resting source', () => {
    const state = fixture('positive'), self = state.players[playerId], foe = state.players['player-two']
    const source = self.battleArea[0], top = source.hpCards.at(-1)!
    const result = activate(state, [foe.battleArea[0].card.instanceId])
    expect(result.players[playerId].supportArea[0].rested).toBe(true)
    expect(result.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(result.players[playerId].discardPile.some(c => c.instanceId === top.instanceId)).toBe(true)
    expect(result.players[playerId].battleArea[0].rested).toBe(false)
    expect(result.players[playerId].battleArea[1].hpCards).toHaveLength(3)
    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players['player-two'].battleArea[1].hpCards).toHaveLength(3)
    expect(canActivateCookieSkill(result, playerId, source.card.instanceId, 'activate')).toBe(false)
    expect(source.hpCards).toHaveLength(2)
    expect(self.supportArea[0].rested).toBe(false)
  })
  it('allows zero enemy targets while still paying R and source HP', () => {
    const state = fixture('zero'), result = activate(state, [])
    expect(result.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(result.players[playerId].supportArea[0].rested).toBe(true)
    expect(result.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
  })
  it('rejects another own Cookie for the source-only HP cost and own/duplicate/extra enemy targets', () => {
    const state = fixture('positive'), self = state.players[playerId], foe = state.players['player-two']
    expect(() => activate(state, [], self.battleArea[1].card.instanceId)).toThrow()
    expect(() => activate(state, [self.battleArea[1].card.instanceId])).toThrow()
    expect(() => activate(state, foe.battleArea.map(c => c.card.instanceId))).toThrow()
    expect(() => activate(state, [foe.battleArea[0].card.instanceId, foe.battleArea[0].card.instanceId])).toThrow()
  })
  it('rejects rested/wrong-color support and another phase while allowing a rested source', () => {
    expect(() => activate(fixture('negative'), [])).toThrow()
    const wrong = fixture('positive')
    // Use an actual printed yellow support card, without rewriting printed attributes.
    const deck = wrong.players[playerId].deck, index = deck.findIndex(c => c.energyColor === 'yellow')
    if (index < 0) throw new Error('Missing physical yellow filler')
    const original = wrong.players[playerId].supportArea[0].card
    wrong.players[playerId].supportArea[0].card = deck[index]
    deck[index] = original
    expect(() => activate(wrong, [])).toThrow()
    const rested = fixture('positive'); rested.players[playerId].battleArea[0].rested = true
    expect(activate(rested, []).players[playerId].battleArea[0].rested).toBe(true)
    const phase = fixture('positive'); phase.phase = 'support'
    expect(() => activate(phase, [])).toThrow()
  })
  it('keeps 60 original unique printed cards per player with at most four copies', () => {
    for (const p of Object.values(fixture('positive').players)) {
      const cards = [...p.deck, ...p.hand, ...p.discardPile, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
      const counts = new Map<string, number>()
      for (const c of cards) { counts.set(c.id, (counts.get(c.id) ?? 0) + 1); expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//) }
      expect([...counts.values()].every(n => n <= 4)).toBe(true)
    }
  })
})
