import { describe, expect, it } from 'vitest'
import { createCard, getCardPoolEntry, takeAiStep } from '../../index'
import { createPlayerView } from '../../player-view'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import { assessLv5DefensiveReserve, hasReadyBlocker } from './defensive-reserve'

const formal = (id: string) => createCard(getCardPoolEntry(id)!, 'player-two', 1)
const attack = {
  kind: 'attack' as const, playerId: 'player-two' as const,
  attackerInstanceId: 'attacker', targetInstanceId: 'defender', supportPaymentIds: [],
}
const trapView = () => {
  const state = createBattleState()
  state.players['player-two'].hand = [formal('BS9-046')]
  state.players['player-two'].supportArea = [
    { card: item('yellow-a', 'yellow'), rested: false },
    { card: item('yellow-b', 'yellow'), rested: false },
    { card: item('red-a', 'red'), rested: false },
  ]
  return { state, view: createPlayerView(state, 'player-two') }
}
const blockerView = (withArena: boolean) => {
  const state = createBattleState()
  const card = formal('BS12-089')
  if (card.type !== 'cookie') throw new Error('Werewolf must be a Cookie')
  state.players['player-two'].battleArea.push({
    card, hpCards: Array.from({length: card.hp}, (_, i) => item(`werewolf-hp-${i}`)), rested: false,
  })
  state.players['player-two'].hand = withArena ? [formal('BS12-088')] : [item('wrong-card', 'purple')]
  return { state, view: createPlayerView(state, 'player-two') }
}

describe('S3 finalist defense resource costs', () => {
  it('reserves both yellow energies for Fragmented Soul', () => {
    const { state, view } = trapView()
    const after = {...view, self: {...view.self, supportArea: view.self.supportArea.slice(0, 1)}}
    expect(assessLv5DefensiveReserve(view, after, attack, state)).toMatchObject({
      reason: 'trap-in-hand', reserveRequired: 2, shortage: 1, adjustment: -24,
    })
  })
  it('detects loss of the required color even with enough active supports', () => {
    const { state, view } = trapView()
    const after = {...view, self: {...view.self, supportArea: [
      {card: item('red-after-a', 'red'), rested: false},
      {card: item('red-after-b', 'red'), rested: false},
    ]}}
    const result = assessLv5DefensiveReserve(view, after, attack, state)
    expect(result.shortage).toBeGreaterThan(0)
    expect(result.adjustment).toBeLessThan(0)
  })
  it('accepts a cheaper defensive option instead of reserving every trap cost', () => {
    const { state, view } = trapView()
    const before = {...view, hand: [...view.hand, formal('BS1-050')]}
    const after = {...before, self: {...before.self, supportArea: before.self.supportArea.slice(0, 1)}}
    expect(assessLv5DefensiveReserve(before, after, attack, state)).toMatchObject({
      reason: 'trap-in-hand', reserveRequired: 1, shortage: 0, adjustment: 0,
    })
  })
  it('does not declare an Arena-discard Blocker ready with only a non-Arena card', () => {
    expect(hasReadyBlocker(blockerView(false).view)).toBe(false)
  })
  it('does not reserve support energy for the zero-energy Arena-discard Blocker', () => {
    const { state, view } = blockerView(true)
    const after = {...view, self: {...view.self, supportArea: []}}
    expect(hasReadyBlocker(view)).toBe(true)
    expect(assessLv5DefensiveReserve(view, after, attack, state)).toMatchObject({
      reserveRequired: 0, shortage: 0, adjustment: 0,
    })
  })
  it('preserves the only eligible Arena hand payment when placing support', () => {
    const { state, view } = blockerView(true)
    const card = view.hand[0]
    const after = {...view, hand: [], self: {...view.self, supportArea: [
      ...view.self.supportArea, {card, rested: false},
    ]}}
    const result = assessLv5DefensiveReserve(view, after, {
      kind: 'place-support', playerId: 'player-two', instanceId: card.instanceId,
    }, state)
    expect(result.reason).toBe('blocker-ready')
    expect(result.adjustment).toBeLessThan(0)
    expect(result.detail).toContain('手牌')
  })
  it('takes a legal attack instead of ending the turn for nonexistent Blocker energy', () => {
    const { state } = blockerView(true)
    const player = state.players['player-two']
    player.battleArea[0].card.attack = 1
    player.battleArea[1].rested = true
    const second = createCard(getCardPoolEntry('BS12-089')!, 'player-two', 2)
    if (second.type !== 'cookie') throw new Error('Werewolf must be a Cookie')
    player.battleArea.push({card: second, hpCards: Array.from({length: second.hp}, (_, i) => item(`second-hp-${i}`)), rested: true})
    const opponent = state.players['player-one'].battleArea[0]
    opponent.card.hp = 5
    opponent.hpCards = Array.from({length: 5}, (_, i) => item(`opponent-hp-${i}`))
    const original = JSON.stringify(state)
    const decision = takeAiStep(state, 'player-two', {level: 5, seed: 20261009, searchNow: () => 0})
    expect(decision.action).toBe('attack')
    expect(decision.error).toBeUndefined()
    expect(JSON.stringify(state)).toBe(original)
    expect(decision.reason?.actionScore?.contributions.some(c =>
      c.id === 'defensive-reserve' && c.amount > 0)).toBe(false)
  })
})
