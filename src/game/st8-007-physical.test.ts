import { describe, expect, it } from 'vitest'
import {createSt8007PreviewState as fixture} from './st8-007-demo'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'
import { takeAiStep } from './ai'

const owner = 'player-one' as const
const attack = (state: ReturnType<typeof fixture>) => applyGameCommand(state, {
  kind: 'declare-attack', playerId: owner,
  attackerInstanceId: state.players[owner].battleArea[0].card.instanceId,
  targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
  supportPaymentIds: state.players[owner].supportArea.map(support => support.card.instanceId),
})

describe('ST8-007 original-printing acceptance', () => {
  it.each(['positive', 'low', 'negative', 'last-no-hand', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase',
    'play', 'attack-few', 'first-turn', 'source-rested', 'rested-carrier', 'last-deck', 'last-deck-low', 'over-printed',
    'cost-yellow', 'cost-green', 'cost-blue', 'cost-purple', 'cost-black', 'cost-trap', 'cost-stage', 'own-carrier'] as const)(
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
      expect(parseTestStateConfig(`?test-state=deck-addition:ST8-007:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST8-007', scenario })
    },
  )

  it.each(['positive', 'low'] as const)('real NNN3 damage reveals the printed FLIP (%s)', scenario => {
    const state = fixture(scenario)
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard).toMatchObject({ id: 'ST8-007', type: 'cookie',
      name: 'Blue Slushy Cookie', energyColor: 'green', level: 1, hp: 1, attack: 2 })
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
      expect(result.players[owner].battleArea.some(source => source.card.id === 'ST8-007')).toBe(false)
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

  it.each(['cost-yellow', 'cost-green', 'cost-blue', 'cost-purple', 'cost-black', 'cost-trap', 'cost-stage', 'rested-carrier'])('%s pays an arbitrary physical hand card without energy or REST', scenario => {
    const state = fixture(scenario), self = state.players[owner]
    const next = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true,
      discardHandIds: [self.hand[0].instanceId] })
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(self.battleArea[0].hpCards.length + 1)
    expect(next.players[owner].battleArea[0].rested).toBe(self.battleArea[0].rested)
    expect(next.players[owner].supportArea).toEqual(self.supportArea)
    expect(next.players[owner].discardPile.some(card => card.instanceId === self.hand[0].instanceId)).toBe(true)
  })

  it('heals its own printed HP1 bearer from the actual deck top, then the remaining attack causes fainting', () => {
    const state = fixture('own-carrier'), before = structuredClone(state)
    const self = state.players[owner], carrier = self.battleArea[0], other = self.battleArea[1]
    expect(carrier.card).toMatchObject({ id: 'ST8-007', hp: 1, level: 1 })
    expect(carrier.hpCards).toHaveLength(0)
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('ST8-007')
    expect(state.commandLog?.some(entry => entry.commandKind === 'declare-attack')).toBe(true)
    const cost = self.hand[0], deckTop = self.deck[0]
    let next = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner,
      activate: true, discardHandIds: [cost.instanceId] })
    const healed = next.players[owner].battleArea.find(cookie => cookie.card.instanceId === carrier.card.instanceId)
    expect(healed?.hpCards).toEqual([deckTop])
    expect(next.players[owner].hand).toEqual(self.hand.slice(1))
    expect(next.players[owner].discardPile.some(card => card.instanceId === cost.instanceId)).toBe(true)
    expect(next.players[owner].battleArea.find(cookie => cookie.card.instanceId === other.card.instanceId)).toEqual(other)
    expect(next.players[owner].supportArea).toEqual(self.supportArea)
    expect(next.players[owner].deck).toEqual(self.deck.slice(1))
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: owner })
    expect(next.players[owner].battleArea.some(cookie => cookie.card.instanceId === carrier.card.instanceId)).toBe(false)
    expect(next.players[owner].breakArea.some(card => card.instanceId === carrier.card.instanceId)).toBe(true)
    expect(next.players[owner].battleArea.find(cookie => cookie.card.instanceId === other.card.instanceId)).toEqual(other)
    expect(state).toEqual(before)
  })

  it('declines its own last-HP FLIP without discarding a hand card or healing another Cookie', () => {
    const state = fixture('own-carrier'), before = structuredClone(state)
    const self = state.players[owner], carrier = self.battleArea[0], other = self.battleArea[1]
    const next = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: false })
    expect(next.players[owner].hand).toEqual(self.hand)
    expect(next.players[owner].deck).toEqual(self.deck)
    expect(next.players[owner].battleArea.some(cookie => cookie.card.instanceId === carrier.card.instanceId)).toBe(false)
    expect(next.players[owner].breakArea.some(card => card.instanceId === carrier.card.instanceId)).toBe(true)
    expect(next.players[owner].battleArea.find(cookie => cookie.card.instanceId === other.card.instanceId)).toEqual(other)
    expect(next.players[owner].supportArea).toEqual(self.supportArea)
    expect(state).toEqual(before)
  })
  it('continues the remaining two real ordinary damage points after FLIP', () => {
    const state = fixture('positive')
    let next = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true,
      discardHandIds: [state.players[owner].hand[0].instanceId] })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: owner })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: owner })
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(1)
    expect(next.players[owner].battleArea[1]).toEqual(state.players[owner].battleArea[1])
  })

  it('uses real ST7-018 healing to verify a gain beyond printed starting HP', () => {
    const state = fixture('over-printed')
    expect(state.commandLog?.some(entry => entry.commandKind === 'play-trap')).toBe(true)
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('ST8-007')
    expect(state.players[owner].battleArea[0].card.hp).toBe(3)
    expect(state.players[owner].battleArea[0].hpCards).toHaveLength(3)
    const next = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true,
      discardHandIds: [state.players[owner].hand[0].instanceId] })
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(4)
    expect(next.players[owner].battleArea[1]).toEqual(state.players[owner].battleArea[1])
  })

  it.each(['last-deck', 'last-deck-low'])('gains HP then performs actual Refresh after %s', scenario => {
    const state = fixture(scenario)
    const cost = state.players[owner].hand[0]
    let next = applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true, discardHandIds: [cost.instanceId] })
    expect(next.players[owner].deck).toHaveLength(0)
    expect(next.pendingRefresh?.playerId).toBe(owner)
    next = applyGameCommand(next, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost.instanceId, shuffleSeed: 1 })
    expect(next.players[owner].breakArea.some(card => card.instanceId === cost.instanceId)).toBe(true)
    expect(next.players[owner].deck.length).toBeGreaterThan(0)
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(scenario === 'last-deck-low' ? 1 : 3)
  })

  it('deploys the original LV1 Blue Slushy from hand with exactly one HP', () => {
    const state = fixture('play'), source = state.players[owner].hand[0]
    expect(source.id).toBe('ST8-007')
    const next = applyGameCommand(state, { kind: 'deploy-cookie', playerId: owner, instanceId: source.instanceId })
    expect(next.players[owner].battleArea.find(cookie => cookie.card.id === 'ST8-007')?.hpCards).toHaveLength(1)
    expect(next.players[owner].hand).toHaveLength(0)
  })

  it.each([3, 4, 5] as const)('Lv%i pays the real discard and saves the original HP bearer', level => {
    const state = fixture('low'), before = structuredClone(state)
    const decision = takeAiStep(state, owner, { level, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    expect(decision.state.players[owner].battleArea[0].hpCards).toHaveLength(1)
    expect(decision.state.players[owner].hand).toHaveLength(1)
    expect(state).toEqual(before)
  })

  it.each([3, 4, 5] as const)('Lv%i declines unpayable FLIP without an illegal payment', level => {
    const state = fixture('last-no-hand')
    const decision = takeAiStep(state, owner, { level, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    expect(decision.state.players[owner].hand).toHaveLength(0)
    expect(decision.state.players[owner].breakArea.some(card => card.instanceId === state.players[owner].battleArea[0].card.instanceId)).toBe(true)
  })

  it('pays exactly GG for printed Arrow Shot 2 and adds no attack effect', () => {
    const state = fixture('attack'), before = structuredClone(state)
    let next = attack(state)
    expect(next.players[owner].battleArea[0].card).toMatchObject({ hp: 1, level: 1, attack: 2 })
    expect(next.players[owner].battleArea[0].card.attackEffects ?? []).toEqual([])
    expect(next.players[owner].supportArea.every(support => support.rested)).toBe(true)
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-battle', playerId: owner })
    expect(next.players['player-two'].battleArea).toHaveLength(0)
    expect(next.players[owner].battleArea[0].rested).toBe(true)
    expect(state).toEqual(before)
  })

  it.each(['attack-negative', 'wrong-color', 'wrong-phase', 'attack-few', 'first-turn', 'source-rested'] as const)('blocks attack with %s', scenario => {
    const state = fixture(scenario)
    expect(() => attack(state)).toThrow()
    expect(getLegalTurnCommands(state, owner).some(command => command.kind === 'attack' &&
      command.attackerInstanceId === state.players[owner].battleArea[0].card.instanceId)).toBe(false)
  })
})
