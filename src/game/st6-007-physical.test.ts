import { describe, expect, it } from 'vitest'
import { createSt6007PreviewState as fixture } from './st6-007-demo'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'

const owner = 'player-one' as const
const attack = (state: ReturnType<typeof fixture>) => applyGameCommand(state, {
  kind: 'declare-attack', playerId: owner,
  attackerInstanceId: state.players[owner].battleArea[0].card.instanceId,
  targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
  supportPaymentIds: state.players[owner].supportArea.map(support => support.card.instanceId),
})

describe('ST6-007 original-printing acceptance', () => {
  it.each(['positive', 'low', 'negative', 'last-no-hand', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase'] as const)(
    '%s retains sixty original cards, legal battle limits, unique instances and at most four copies', scenario => {
      const state = fixture(scenario)
      for (const player of Object.values(state.players)) {
        const revealed = state.pendingBattle?.defenderPlayerId === player.id
          ? state.pendingBattle.revealedHpCard : undefined
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
          ...player.supportArea.map(support => support.card),
          ...player.battleArea.flatMap(source => [source.card, ...source.hpCards]), ...(revealed ? [revealed] : [])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
        expect(player.battleArea.length).toBeLessThanOrEqual(2)
        const counts = new Map<string, number>()
        for (const card of cards) {
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
          counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
        }
        expect([...counts.values()].every(count => count <= 4)).toBe(true)
      }
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-007:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-007', scenario })
    },
  )

  it.each(['positive', 'low'] as const)('real NNN3 damage reveals the printed FLIP (%s)', scenario => {
    const state = fixture(scenario)
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard).toMatchObject({ id: 'ST6-007', type: 'cookie',
      name: 'Chili Pepper Cookie', energyColor: 'red', level: 3, hp: 4, attack: 4 })
    expect(state.players[owner].battleArea[0].hpCards).toHaveLength(scenario === 'low' ? 0 : 2)
    expect(state.players['player-two'].supportArea.every(support => support.rested)).toBe(true)
    expect(state.commandLog?.map(entry => entry.commandKind)).toContain('declare-attack')
  })

  it.each([['positive', 0], ['positive', 1], ['low', 0], ['low', 1]] as const)(
    'discards any one original hand card and heals only its original bearer (%s / hand %s)', (scenario, index) => {
      const state = fixture(scenario), before = structuredClone(state)
      const self = state.players[owner], cost = self.hand[index]
      const result = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner,
        activate: true, discardHandIds: [cost.instanceId] })
      expect(result.players[owner].hand).toHaveLength(1)
      expect(result.players[owner].discardPile.map(card => card.instanceId)).toContain(cost.instanceId)
      expect(result.players[owner].battleArea[0].card.instanceId).toBe(self.battleArea[0].card.instanceId)
      expect(result.players[owner].battleArea[0].hpCards).toHaveLength(scenario === 'low' ? 1 : 3)
      expect(result.players[owner].battleArea[1]).toEqual(self.battleArea[1])
      expect(result.players[owner].battleArea.some(source => source.card.id === 'ST6-007')).toBe(false)
      expect(result.players[owner].deck).toHaveLength(self.deck.length - 1)
      expect(result.players[owner].supportArea).toEqual([])
      expect(state).toEqual(before)
    },
  )

  it.each(['positive', 'low', 'negative', 'last-no-hand'] as const)('skipping %s pays no hand cost', scenario => {
    const state = fixture(scenario), self = state.players[owner]
    const result = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: false })
    expect(result.players[owner].hand).toEqual(self.hand)
    if (scenario === 'low' || scenario === 'last-no-hand') {
      expect(result.players[owner].battleArea.some(source => source.card.instanceId === self.battleArea[0].card.instanceId)).toBe(false)
      expect(result.players[owner].breakArea.map(card => card.instanceId)).toContain(self.battleArea[0].card.instanceId)
    } else expect(result.players[owner].battleArea[0].hpCards).toHaveLength(2)
  })

  it.each(['empty', 'absent-card', 'two-cards'] as const)('rejects incomplete or invalid discard payment %s', payment => {
    const state = fixture('positive'), before = structuredClone(state)
    const ids = payment === 'two-cards' ? state.players[owner].hand.map(card => card.instanceId)
      : payment === 'empty' ? [] : [payment]
    expect(() => applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true, discardHandIds: ids })).toThrow()
    expect(state).toEqual(before)
  })

  it.each(['negative', 'last-no-hand'] as const)('cannot activate with an empty hand (%s)', scenario => {
    const state = fixture(scenario)
    expect(() => applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true, discardHandIds: [] })).toThrow()
  })

  it('pays exactly RRRR for printed Black Tiger Bandit Leader 4 and adds no attack effect', () => {
    const state = fixture('attack'), before = structuredClone(state)
    let next = attack(state)
    expect(next.players[owner].battleArea[0].card).toMatchObject({ hp: 4, level: 3, attack: 4 })
    expect(next.players[owner].battleArea[0].card.attackEffects ?? []).toEqual([])
    expect(next.players[owner].supportArea.every(support => support.rested)).toBe(true)
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-battle', playerId: owner })
    expect(next.players['player-two'].battleArea).toHaveLength(0)
    expect(next.players[owner].battleArea[0].rested).toBe(true)
    expect(state).toEqual(before)
  })

  it.each(['attack-negative', 'wrong-color', 'wrong-phase'] as const)('blocks attack with %s', scenario => {
    const state = fixture(scenario)
    expect(() => attack(state)).toThrow()
    expect(getLegalTurnCommands(state, owner).some(command => command.kind === 'attack' &&
      command.attackerInstanceId === state.players[owner].battleArea[0].card.instanceId)).toBe(false)
  })
})
