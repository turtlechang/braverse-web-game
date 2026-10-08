import { describe, expect, it } from 'vitest'
import { createBs12CreamSodaDemoState, createBs12DjMiyaDemoState } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { isEffectConditionMet } from './effects'
import { canPlayExtraDeckCookie } from './actions'
import { createPlayerView } from './player-view'
import { assessPublicCondition } from './ai/strategy/public-condition'
import { advancePhase } from './turn'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToExtraDeckCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import type { GameState } from './types'

const playerId = 'player-one' as const
const targetId = 'bs12-072-target'
const condition = { kind: 'arena-cookie-placed-from-battle-to-deck-bottom-this-turn', side: 'self' } as const
const withExtra = (state: GameState): GameState => {
  const converted = convertOfficialCardToExtraDeckCard(candidate.cards.find(card => card.cardNumber === 'BS12-074') as OfficialCardRecord)
  if (converted.status !== 'converted') throw new Error('Missing Popping Candy EXTRA')
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], extraDeck: [{ ...converted.extraDeckCard, instanceId: 'bs12-074-source' }] } } }
}

const move = (before: GameState): GameState => {
  const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: 'bs12-072-source', trigger: 'activate', paymentIds: ['bs12-069-payment-0'] })
  const moved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [targetId] })
  return moved.pendingReplacement ? applyGameCommand(moved, { kind: 'skip-replacement', playerId }) : moved
}

describe('BS12-074 precise public battle Arena to deck-bottom history', () => {
  it('records the owner only after real BS12-072 payment and movement', () => {
    const before = createBs12CreamSodaDemoState('positive')
    const snapshot = structuredClone(before)
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: 'bs12-072-source', trigger: 'activate', paymentIds: ['bs12-069-payment-0'] })
    expect(paid).not.toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [targetId] })
    expect(after).toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
    expect(after.players[playerId].deck.at(-1)).toEqual(before.players[playerId].battleArea[1].card)
    expect(after).not.toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { 'player-two': true } })
    expect(before).toEqual(snapshot)
  })
  it('does not record paid zero targets', () => {
    const before = createBs12CreamSodaDemoState('positive')
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: 'bs12-072-source', trigger: 'activate', paymentIds: ['bs12-069-payment-0'] })
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(after).not.toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
  })
  it.each(['field-to-deck-bottom', 'return-to-deck-bottom', 'field-to-deck-bottom-all'] as const)('records actual Arena Cookie movement through the existing effect: %s', kind => {
    const before = createBs12CreamSodaDemoState('positive')
    const after = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-072-source' },
      kind === 'field-to-deck-bottom-all' ? { kind, maxLevel: 2 } : { kind, target: { side: 'self', min: 1, max: 1 } }, [targetId])
    expect(after).toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
  })
  it.each(['field-to-deck-bottom', 'return-to-deck-bottom'] as const)('excludes a non-Arena Cookie while preserving existing generic history: %s', kind => {
    const before = createBs12CreamSodaDemoState('non-arena')
    const after = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-072-source' }, { kind, target: { side: 'self', min: 1, max: 1 } }, [targetId])
    expect(after).not.toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
    if (kind === 'field-to-deck-bottom') expect(after.cookiesPlacedFromBattleToDeckThisTurn?.[playerId]).toBe(true)
  })
  it('excludes deck-top movement even when the old generic deck event is true', () => {
    const before = createBs12CreamSodaDemoState('positive')
    const after = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-072-source' }, { kind: 'battle-to-deck-top', target: { side: 'self', min: 1, max: 1 } }, [targetId])
    expect(after.cookiesPlacedFromBattleToDeckThisTurn?.[playerId]).toBe(true)
    expect(after).not.toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
  })
  it('does not mistake the Arena Cookie top HP for the battle Cookie itself', () => {
    const before = createBs12CreamSodaDemoState('positive')
    const target = before.players[playerId].battleArea[1]
    target.hpCards[target.hpCards.length - 1] = { ...target.card, instanceId: 'bs12-074-arena-hp' }
    const after = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-072-source' }, { kind: 'field-to-deck-bottom', hpOnly: true, target: { side: 'self', min: 1, max: 1 } }, [targetId])
    expect(after).not.toMatchObject({ arenaCookiesPlacedFromBattleToDeckBottomThisTurn: { [playerId]: true } })
  })
  it('real BS12-073 attack Then also records the departing Arena source', () => {
    const before = createBs12DjMiyaDemoState('attack-ally')
    let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-073-source', targetInstanceId: 'bs12-064-opponent', supportPaymentIds: before.players[playerId].supportArea.map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 6; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds: ['bs12-073-cost'], targetIds: [] })
    expect(state.arenaCookiesPlacedFromBattleToDeckBottomThisTurn).toEqual({ [playerId]: true })
    expect(state.players[playerId].deck.at(-1)?.instanceId).toBe('bs12-073-source')
  })
  // Isolated shared-cost mechanism, not a claim about Cream Soda's printed cost.
  it.each([true, false])('skill self-to-bottom cost records Arena only: %s', arena => {
    const before = createBs12CreamSodaDemoState('positive')
    const source = before.players[playerId].battleArea[0]
    source.card = { ...source.card, keywords: arena ? ['arena'] : [], skill: { ...source.card.skill!, cost: { energy: {}, selfToDeckBottom: true }, effects: [{ kind: 'draw', amount: 0 }] } }
    const after = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })
    expect(after.players[playerId].deck.at(-1)?.instanceId).toBe(source.card.instanceId)
    expect(Boolean(after.arenaCookiesPlacedFromBattleToDeckBottomThisTurn?.[playerId])).toBe(arena)
  })
  // Isolated attack-cost path, not an invented cost on the printed DJ Miya card.
  it.each([true, false])('attack self-to-bottom cost records Arena only: %s', arena => {
    const before = createBs12DjMiyaDemoState('attack-ally')
    const source = before.players[playerId].battleArea[0]
    source.card = { ...source.card, keywords: arena ? ['arena'] : [], attackEffects: [{ kind: 'optional-cost-attack', effectText: 'Isolated self-to-bottom cost', cost: { energy: {}, selfToDeckBottom: true }, effects: [{ kind: 'draw', amount: 0 }] }] }
    let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: source.card.instanceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: before.players[playerId].supportArea.map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    for (let index = 0; state.pendingBattle?.stage === 'damage' && index < 6; index++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    const after = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds: [], targetIds: [] })
    expect(after.players[playerId].deck.at(-1)?.instanceId).toBe(source.card.instanceId)
    expect(Boolean(after.arenaCookiesPlacedFromBattleToDeckBottomThisTurn?.[playerId])).toBe(arena)
  })
  it('does not substitute the old generic deck event for the exact EXTRA condition', () => {
    const before = withExtra({ ...createBs12CreamSodaDemoState('positive'), cookiesPlacedFromBattleToDeckThisTurn: { [playerId]: true } })
    expect(canPlayExtraDeckCookie(before, playerId, 'bs12-074-source')).toBe(false)
    expect(isEffectConditionMet(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-074-source' }, { kind: 'draw', amount: 0, condition })).toBe(false)
    expect(assessPublicCondition(createPlayerView(before, playerId), condition).state).toBe('unmet')
    const after = move(before)
    expect(canPlayExtraDeckCookie(after, playerId, 'bs12-074-source')).toBe(true)
    expect(assessPublicCondition(createPlayerView(after, playerId), condition).state).toBe('met')
    expect(canPlayExtraDeckCookie(JSON.parse(JSON.stringify(after)), playerId, 'bs12-074-source')).toBe(true)
  })
  it('actual EXTRA entry uses five top HP, leaves the returned bottom in the deck and uses the normal once-per-turn slot', () => {
    const before = move(withExtra(createBs12CreamSodaDemoState('positive')))
    const snapshot = structuredClone(before)
    const after = applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId, instanceId: 'bs12-074-source' })
    expect(after.players[playerId].battleArea[1]).toMatchObject({ enteredFrom: 'extra-deck', card: { name: 'Popping Candy Cookie', extraDeckOrigin: 'extra' } })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 5))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(5))
    expect(after.players[playerId].deck.at(-1)?.instanceId).toBe(targetId)
    expect(after.extraDeckPlayUsedThisTurn).toBe(true)
    expect(after.players[playerId].extraDeck).toEqual([])
    expect(before).toEqual(snapshot)
  })
  it('clears the precise event at turn end and does not let it qualify next turn', () => {
    const before = move(withExtra(createBs12CreamSodaDemoState('positive')))
    const after = advancePhase(advancePhase(before))
    expect(after.turnNumber).toBe(before.turnNumber + 1)
    expect(after.arenaCookiesPlacedFromBattleToDeckBottomThisTurn).toEqual({})
    expect(assessPublicCondition(createPlayerView(after, playerId), condition).state).toBe('unmet')
  })
  it('an opponent battle Cookie going to its own deck only records that opponent', () => {
    const before = createBs12CreamSodaDemoState('positive')
    const target = { ...before.players[playerId].battleArea[1], card: { ...before.players[playerId].battleArea[1].card, instanceId: 'bs12-074-opponent-arena' } }
    const state = { ...before, players: { ...before.players, 'player-two': { ...before.players['player-two'], battleArea: [before.players['player-two'].battleArea[0], target] } } }
    const after = executeCardEffect(state, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-072-source' }, { kind: 'field-to-deck-bottom', target: { side: 'opponent', min: 1, max: 1 } }, [target.card.instanceId])
    expect(after.arenaCookiesPlacedFromBattleToDeckBottomThisTurn).toEqual({ 'player-two': true })
    expect(assessPublicCondition(createPlayerView(after, playerId), condition).state).toBe('unmet')
    expect(assessPublicCondition(createPlayerView(after, 'player-two'), condition).state).toBe('met')
  })
})
