import { describe, expect, it } from 'vitest'
import { createSt8009PreviewState as fixture, st8009Scenarios } from './st8-009-demo'
import { applyGameCommand } from './commands'
import { selectEnergyPayment } from './energy'
import { commandFromLogEntry } from './replay'

const owner = 'player-one' as const
const drawFlip = (state: ReturnType<typeof fixture>, drawCount: number) => applyGameCommand(
  applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true }),
  { kind: 'resolve-draw-up-to', playerId: owner, drawCount },
)
const replay = (scenario: string, final: ReturnType<typeof fixture>) => {
  let state = fixture(scenario, true)
  for (const entry of final.commandLog ?? []) state = applyGameCommand(state, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(state))).toEqual(JSON.parse(JSON.stringify(final)))
}
const attack = (state: ReturnType<typeof fixture>, ids = selectEnergyPayment({ green: 3 }, state.players[owner].supportArea) ?? []) => applyGameCommand(state, {
  kind: 'declare-attack', playerId: owner, attackerInstanceId: state.players[owner].battleArea[0].card.instanceId,
  targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId, supportPaymentIds: ids,
})

describe('ST8-009 original physical acceptance', () => {
  it.each(st8009Scenarios)('%s uses original sixty-card decks, unique instances and printed starting HP', scenario => {
    const state = fixture(scenario, true), allIds: string[] = []
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
        ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
      expect(cards).toHaveLength(60)
      allIds.push(...cards.map(card => card.instanceId))
      const counts = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
        counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      }
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    }
    expect(new Set(allIds).size).toBe(120)
  })

  it.each([0, 1])('activates and chooses %s without any payment or HP restoration', count => {
    const start = fixture('positive'), before = structuredClone(start), self = start.players[owner]
    expect(start.pendingBattle?.revealedHpCard).toMatchObject({ id: 'ST8-009', level: 2, hp: 3, attack: 3 })
    const state = drawFlip(start, count)
    expect(state.players[owner].hand).toEqual([...self.hand, ...self.deck.slice(0, count)])
    expect(state.players[owner].deck).toEqual(self.deck.slice(count))
    expect(state.players[owner].battleArea).toEqual(self.battleArea)
    expect(state.players[owner].supportArea).toEqual(self.supportArea)
    expect(start).toEqual(before)
    replay('positive', state)
  })

  it('declining FLIP is a distinct no-draw command from activating then choosing zero', () => {
    const start = fixture('positive'), state = applyGameCommand(start, { kind: 'resolve-flip', playerId: owner, activate: false })
    expect(state.players[owner].hand).toEqual(start.players[owner].hand)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.commandLog?.at(-1)?.payload).toMatchObject({ kind: 'resolve-flip', activate: false })
    expect(drawFlip(start, 0).commandLog?.at(-1)?.commandKind).toBe('resolve-draw-up-to')
    replay('positive', state)
  })

  it.each(['rested-carrier', 'no-hand', 'high-hand', 'no-support', 'rested-support'])('free FLIP does not invent resource or hand conditions: %s', scenario => {
    const start = fixture(scenario), state = drawFlip(start, 1)
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand, start.players[owner].deck[0]])
    expect(state.players[owner].supportArea).toEqual(start.players[owner].supportArea)
    expect(state.players[owner].battleArea).toEqual(start.players[owner].battleArea)
    replay(scenario, state)
  })

  it.each(['top-cookie', 'top-item', 'top-trap', 'top-stage', 'top-blue'])('draws the actual unrestricted top card: %s', scenario => {
    const start = fixture(scenario), top = start.players[owner].deck[0]
    if (scenario === 'top-cookie') expect(top.type).toBe('cookie')
    if (scenario === 'top-item') expect(top.type).toBe('item')
    if (scenario === 'top-trap') expect(top.type).toBe('trap')
    if (scenario === 'top-stage') expect(top.type).toBe('stage')
    if (scenario === 'top-blue') expect(top.energyColor).toBe('blue')
    const state = drawFlip(start, 1)
    expect(state.players[owner].hand.at(-1)).toEqual(top)
    replay(scenario, state)
  })

  it.each([['low', 0], ['low', 1], ['own-carrier', 0], ['own-carrier', 1]] as const)('resolves the last-HP draw before normal faint, without rescuing %s / draw%s', (scenario, count) => {
    const start = fixture(scenario), source = start.players[owner].battleArea[0]
    expect(source.hpCards).toHaveLength(0)
    let state = applyGameCommand(start, { kind: 'resolve-flip', playerId: owner, activate: true })
    expect(state.pendingDrawUpTo?.playerId).toBe(owner)
    expect(state.players[owner].battleArea.some(cookie => cookie.card.instanceId === source.card.instanceId)).toBe(true)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: count })
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand, ...start.players[owner].deck.slice(0, count)])
    expect(state.players[owner].battleArea.some(cookie => cookie.card.instanceId === source.card.instanceId)).toBe(false)
    expect(state.players[owner].breakArea.some(card => card.instanceId === source.card.instanceId)).toBe(true)
    expect(state.players[owner].battleArea[0]).toEqual(start.players[owner].battleArea[1])
    replay(scenario, state)
  })

  it.each(['low', 'own-carrier'])('declining a real last-HP FLIP causes normal faint without drawing: %s', scenario => {
    const start = fixture(scenario), source = start.players[owner].battleArea[0]
    const state = applyGameCommand(start, { kind: 'resolve-flip', playerId: owner, activate: false })
    expect(state.players[owner].hand).toEqual(start.players[owner].hand)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.players[owner].battleArea.some(cookie => cookie.card.instanceId === source.card.instanceId)).toBe(false)
    expect(state.players[owner].breakArea.some(card => card.instanceId === source.card.instanceId)).toBe(true)
    replay(scenario, state)
  })

  it('allows a truly drawn Cookie to replace the fainted carrier only after the FLIP draw completes', () => {
    const start = fixture('low'), drawn = start.players[owner].deck[0]
    if (drawn.type !== 'cookie') throw new Error('Actual low fixture top card must be an original Cookie')
    const waiting = applyGameCommand(start, { kind: 'resolve-flip', playerId: owner, activate: true })
    expect(() => applyGameCommand(waiting, { kind: 'replace-cookie', playerId: owner, instanceId: drawn.instanceId })).toThrow()
    const afterDraw = applyGameCommand(waiting, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })
    expect(afterDraw.pendingReplacement?.tasks[0].playerId).toBe(owner)
    const state = applyGameCommand(afterDraw, { kind: 'replace-cookie', playerId: owner, instanceId: drawn.instanceId })
    expect(state.players[owner].battleArea.find(cookie => cookie.card.instanceId === drawn.instanceId)?.hpCards).toHaveLength(drawn.hp)
    expect(state.players[owner].hand.some(card => card.instanceId === drawn.instanceId)).toBe(false)
    replay('low', state)
  })

  it('continues the remaining two real ordinary damage points after drawing', () => {
    const start = fixture('positive')
    let state = drawFlip(start, 1)
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(state.players[owner].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players[owner].battleArea[1]).toEqual(start.players[owner].battleArea[1])
    replay('positive', state)
  })

  it.each(['last-deck', 'last-deck-low'])('draws the final top card, Refreshes, then resumes the actual battle: %s', scenario => {
    const start = fixture(scenario), source = start.players[owner].battleArea[0]
    let state = drawFlip(start, 1)
    expect(state.pendingRefresh?.playerId).toBe(owner)
    expect(state.players[owner].hand.at(-1)).toEqual(start.players[owner].deck[0])
    const cost = state.players[owner].discardPile.find(card => card.type === 'cookie')
    if (!cost) throw new Error('Actual short-deck discard requires a Refresh Cookie')
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost.instanceId, shuffleSeed: 1 })
    expect(state.pendingRefresh).toBeNull()
    if (state.pendingBattle) state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(state.players[owner].battleArea.find(cookie => cookie.card.instanceId === source.card.instanceId)?.hpCards.length ?? 0).toBe(scenario === 'last-deck-low' ? 0 : 1)
    replay(scenario, state)
  })

  it('choosing zero on the final deck card does not trigger Refresh', () => {
    const start = fixture('last-deck'), state = drawFlip(start, 0)
    expect(state.pendingRefresh).toBeNull()
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    replay('last-deck', state)
  })

  it('allows two real HP FLIPs during one attack without Once restriction', () => {
    const start = fixture('multiple-flip')
    let state = drawFlip(start, 1)
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: owner })
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('ST8-009')
    state = drawFlip(state, 1)
    expect(state.players[owner].hand).toEqual([...start.players[owner].hand, ...start.players[owner].deck.slice(0, 2)])
    expect(state.players[owner].deck).toEqual(start.players[owner].deck.slice(2))
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(state.players[owner].battleArea[0].hpCards).toHaveLength(1)
    replay('multiple-flip', state)
  })

  it.each([-1, 2])('rejects an invalid draw amount %s without mutation', count => {
    const state = applyGameCommand(fixture('positive'), { kind: 'resolve-flip', playerId: owner, activate: true }), before = structuredClone(state)
    expect(() => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: count })).toThrow()
    expect(state).toEqual(before)
  })
  it('rejects drawing before actual FLIP activation and the wrong draw owner', () => {
    expect(() => applyGameCommand(fixture('positive'), { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })).toThrow()
    const state = applyGameCommand(fixture('positive'), { kind: 'resolve-flip', playerId: owner, activate: true })
    expect(() => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 1 })).toThrow()
  })

  it('deploys the printed Cookie with three HP and does not trigger a draw OnPlay', () => {
    const start = fixture('play'), source = start.players[owner].hand[0]
    const state = applyGameCommand(start, { kind: 'deploy-cookie', playerId: owner, instanceId: source.instanceId })
    expect(state.players[owner].battleArea.find(cookie => cookie.card.id === 'ST8-009')?.hpCards).toHaveLength(3)
    expect(state.players[owner].hand).toEqual(start.players[owner].hand.slice(1))
    expect(state.pendingOnPlay).toBeNull()
    expect(state.pendingDrawUpTo).toBeUndefined()
    replay('play', state)
  })

  it('pays exactly GGG for ordinary three and produces no attack Then', () => {
    const start = fixture('attack')
    let state = attack(start)
    expect(state.players[owner].supportArea.every(support => support.rested)).toBe(true)
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: owner })
    expect(state.players['player-two'].breakArea.some(card => card.id === 'ST1-005')).toBe(true)
    expect(state.players[owner].hand).toEqual(start.players[owner].hand)
    expect(state.players[owner].deck).toEqual(start.players[owner].deck)
    expect(state.pendingDrawUpTo).toBeUndefined()
    replay('attack', state)
  })

  it.each(['negative', 'attack-negative', 'wrong-color', 'attack-few'])('has no alternative legal GGG payment anywhere in the support area: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(selectEnergyPayment({ green: 3 }, state.players[owner].supportArea)).toBeNull()
    expect(() => attack(state)).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['wrong-phase', 'first-turn', 'source-rested'])('rejects actual attack despite available GGG for %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(selectEnergyPayment({ green: 3 }, state.players[owner].supportArea)).not.toBeNull()
    expect(() => attack(state)).toThrow()
    expect(state).toEqual(before)
  })
})
