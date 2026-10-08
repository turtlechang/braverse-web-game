import { describe, expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { createBs12PeppermintDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12PeppermintDemoState>
const activate = (state: State, ids = ['bs12-058-hand']) => applyGameCommand(state, { kind: 'resolve-flip', playerId, activate: true, discardHandIds: ids })
const draw = (state: State, count: number) => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
const finish = (before: State) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}

describe.each(['BS12-058', 'BS12-058@1'] as const)('%s actual FLIP cost, deck order, draw and battle continuation', number => {
  it('pays one real blue support for ordinary one, without skill or Then', () => {
    const before = createBs12PeppermintDemoState('attack', number)
    let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-058-source', targetInstanceId: 'bs12-058-opponent', supportPaymentIds: ['bs12-058-payment'] })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = finish(state)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players[playerId].supportArea[0].rested).toBe(true)
    expect(state.players[playerId].battleArea[1].rested).toBe(true)
    expect(hasPendingCardResolution(state)).toBe(false)
    expect(state.commandLog?.some(c => c.commandKind === 'resolve-attack-effect')).toBe(false)
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-source-rested'] as const)('rejects illegal ordinary payment/source: %s', scenario => {
    const before = createBs12PeppermintDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-058-source', targetInstanceId: 'bs12-058-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['positive', 'red-hand', 'green-hand', 'item-hand', 'stage-hand'] as const)('reveals and places one any-color/type Arena hand card on bottom: %s', scenario => {
    const before = createBs12PeppermintDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-058')
    expect(before.pendingBattle?.revealedHpCard?.imageUrl).toBe(candidate.cards.find(card => card.cardNumber === number)!.imageUrl)
    const cost = before.players[playerId].hand[0]
    const paid = activate(before)
    expect(paid.players[playerId].hand.map(c => c.instanceId)).toEqual(['bs12-058-invalid-hand'])
    expect(paid.players[playerId].deck).toEqual([...before.players[playerId].deck, cost])
    expect(paid.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-058-source'])
    expect(paid.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(paid.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(paid.players['player-two']).toEqual(before.players['player-two'])
    expect(paid.pendingDrawUpTo).toBeTruthy()
    const after = finish(draw(paid, 2))
    expect(after.players[playerId].hand).toEqual([before.players[playerId].hand[1], ...before.players[playerId].deck.slice(0, 2)])
    expect(after.players[playerId].deck).toEqual([...before.players[playerId].deck.slice(2), cost])
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
    const text = (paid.commandLog?.at(-1)?.steps ?? []).map(s => s.text).join(' ')
    expect(text).toContain(cost.name)
    expect(text).toContain('公開手牌並放到自己的牌庫底')
    expect(text).not.toContain('棄置手牌')
  })
  it.each([0, 1, 2])('draws exactly the chosen %i after the mandatory cost', count => {
    const before = createBs12PeppermintDemoState('positive', number)
    const after = finish(draw(activate(before), count))
    expect(after.players[playerId].hand).toHaveLength(1 + count)
    expect(after.players[playerId].deck).toHaveLength(13 - count)
    expect(after.players[playerId].deck.at(-1)).toEqual(before.players[playerId].hand[0])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-058-source'])
  })
  it('declines without paying or opening a draw decision', () => {
    const before = createBs12PeppermintDemoState('positive', number)
    const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: false, discardHandIds: [] }))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-058-source'])
    expect(after.pendingDrawUpTo).toBeUndefined()
  })
  it.each([[], ['bs12-058-invalid-hand'], ['bs12-058-payment'], ['bs12-058-source'], ['bs12-058-hand', 'bs12-058-hand'], ['bs12-058-hand', 'bs12-058-invalid-hand']].map(ids => ({ ids })))('rejects missing, wrong-zone, non-Arena, duplicate or excess cost $ids', ({ ids }) => {
    const before = createBs12PeppermintDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['no-hand', 'non-arena-hand', 'opponent-cost-only'] as const)('cannot pay the printed Arena cost: %s', scenario => {
    const before = createBs12PeppermintDemoState(scenario, number)
    expect(() => activate(before)).toThrow()
    const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: false }))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  })
  it('rejects drawing three and preserves the already paid pending decision', () => {
    const before = activate(createBs12PeppermintDemoState('positive', number))
    const snapshot = structuredClone(before)
    expect(() => draw(before, 3)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('can draw the just-paid bottom card after the sole original top card, then refreshes', () => {
    const before = createBs12PeppermintDemoState('last-deck', number)
    const after = draw(activate(before), 2)
    expect(after.players[playerId].hand).toEqual([before.players[playerId].hand[1], before.players[playerId].deck[0], before.players[playerId].hand[0]])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toContain('bs12-058-source')
    expect(after.pendingRefresh?.playerId).toBe(playerId)
    const refreshed = finish(applyGameCommand(after, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-058-refresh-0', shuffleSeed: 3 }))
    expect(refreshed.players[playerId].deck).toHaveLength(6)
    expect(refreshed.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-058-refresh-0'])
    expect(hasPendingCardResolution(refreshed)).toBe(false)
  })
  it('Refresh at LV10 terminates after the draw and preserves drawn cards', () => {
    const paid = activate(createBs12PeppermintDemoState('refresh-lv10', number))
    const waiting = draw(paid, 2)
    const ended = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-058-refresh-0', shuffleSeed: 3 })
    expect(ended.result?.winnerId).toBe('player-two')
    expect(ended.players[playerId].hand).toEqual(waiting.players[playerId].hand)
  })
  it('defers last-HP faint until the draw and Refresh both complete', () => {
    const paid = activate(createBs12PeppermintDemoState('last-hp-refresh', number))
    const waiting = draw(paid, 2)
    expect(waiting.pendingRefresh).toBeTruthy()
    expect(waiting.players[playerId].battleArea[0].hpCards).toHaveLength(0)
    expect(waiting.players[playerId].breakArea).toHaveLength(0)
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-058-refresh-0', shuffleSeed: 3 })
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-058-ally'])
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-058-refresh-0', 'bs12-058-bearer'])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each([false, true])('resumes the parent damage ability after effect-damage FLIP draw, existing outer battle %s', existingBattle => {
    const fixture = createBs12PeppermintDemoState('last-hp', number)
    const flip = fixture.pendingBattle!.revealedHpCard!
    let state: State = { ...fixture, pendingBattle: null,
      players: { ...fixture.players,
        'player-one': { ...fixture.players[playerId], battleArea: fixture.players[playerId].battleArea.map((cookie, i) => i === 0 ? { ...cookie, hpCards: [flip] } : cookie) },
        'player-two': { ...fixture.players['player-two'], battleArea: fixture.players['player-two'].battleArea.map(cookie => ({ ...cookie, rested: false, card: { ...cookie.card, skill: { trigger: 'activate', oncePerTurn: false, yourTurn: true, restSource: false, cost: {}, text: 'Damage then draw test.', effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } }, { kind: 'draw-up-to', max: 1 }] } } })) },
      },
    }
    if (existingBattle) {
      const original = state.players['player-two'].battleArea[0]
      state.players['player-two'].battleArea = [...state.players['player-two'].battleArea, {
        ...original, card: { ...original.card, instanceId: 'original-attacker', skill: undefined },
        hpCards: original.hpCards.map((card, i) => ({ ...card, instanceId: `original-attacker-hp-${i}` })),
      }]
      state = { ...state, pendingBattle: { ...fixture.pendingBattle!, stage: 'attack-effect', revealedHpCard: null, attackerInstanceId: 'original-attacker' } }
      state.pendingAbilityEffect = { playerId: 'player-two', sourcePlayerId: 'player-two', sourceInstanceId: 'bs12-058-attacker', sourceCardName: 'Parent effect', sourceKind: 'trap', effects: state.players['player-two'].battleArea[0].card.skill!.effects, effectIndex: 0, battleContinuation: 'finish' }
    } else {
      state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-two', sourceInstanceId: 'bs12-058-attacker', trigger: 'activate', paymentIds: [] })
    }
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: ['bs12-058-bearer'] })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.effectDamageSequence?.continuationSourceInstanceId).toBe('bs12-058-attacker')
    const paid = activate(state)
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    const after = draw(paid, 2)
    if (!existingBattle) expect(after.pendingBattle).toBeNull()
    expect(after.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-058-bearer'])
    if (existingBattle) {
      expect(after.pendingBattle?.attackerInstanceId).toBe('original-attacker')
      expect(after.pendingBattle?.effectDamageSequence).toBeUndefined()
      return
    }
    const then = applyGameCommand(after, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [] })
    const finished = applyGameCommand(then, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 1 })
    expect(hasPendingCardResolution(finished)).toBe(false)
    expect(finished.players['player-two'].hand).toHaveLength(1)
  })
  it('draw zero still completes the paid FLIP before last-HP faint', () => {
    const after = draw(activate(createBs12PeppermintDemoState('last-hp', number)), 0)
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-058-bearer'])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['last-hp', 'follow-up'] as const)('resolves the paid draw before faint or remaining damage: %s', scenario => {
    const before = createBs12PeppermintDemoState(scenario, number)
    const paid = activate(before)
    expect(paid.players[playerId].breakArea).toHaveLength(0)
    expect(paid.players[playerId].battleArea[0].hpCards).toHaveLength(scenario === 'last-hp' ? 0 : 3)
    const after = finish(draw(paid, 2))
    expect(after.players[playerId].hand).toHaveLength(3)
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-058-ally'])
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-058-bearer'])
  })
  it('has no Your Turn restriction in an explicitly isolated own-turn FLIP', () => {
    expect(draw(activate(createBs12PeppermintDemoState('isolated-own-turn', number)), 1).players[playerId].hand).toHaveLength(2)
  })
  it('normal hand deployment configures one HP without OnPlay', () => {
    const before = createBs12PeppermintDemoState('deploy', number)
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: 'bs12-058-source' })
    expect(after.players[playerId].battleArea[1].hpCards).toHaveLength(1)
    expect(after.players[playerId].deck).toHaveLength(11)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('keeps its print-specific fixture local', () => {
    const query = `?test-state=bs12-058:${number}:positive`
    expect(parseTestStateConfig(query, 'localhost')).toEqual({ kind: 'bs12-058', scenario: 'positive', cardNumber: number })
    expect(parseTestStateConfig(query, 'example.com')).toBeNull()
  })
})
