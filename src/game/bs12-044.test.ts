import { describe, expect, it } from 'vitest'
import { createBs12HerbTeapotDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getEffectSelectionCandidates, isEffectConditionMet } from './effects'
import { hasPendingCardResolution } from './pending'
import bs7 from '../../data/cards/official-arena-of-glory-bs7.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'

const playerId = 'player-one' as const
const sourceId = 'bs12-044-source'
type State = ReturnType<typeof createBs12HerbTeapotDemoState>
const begin = (state: State) => applyGameCommand(state, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [] })
const resolve = (state: State, ids: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: ids })
const play = (state: State, ids = ['bs12-044-support-0']) => resolve(begin(state), ids)

describe('BS12-044 actual support entry and named continuation', () => {
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-044:positive', 'localhost')).toEqual({ kind: 'bs12-044', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-044:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'rested-herb', 'source-rested'] as const)('plays the actual Herb Cookie with printed HP before the optional ready step: %s', scenario => {
    const before = createBs12HerbTeapotDemoState(scenario)
    const snapshot = structuredClone(before)
    const after = play(before)
    expect(after.players[playerId].battleArea.map(c => [c.card.name, c.hpCards.length])).toEqual([['Herb Teapot', 2], ['Herb Cookie', 2]])
    expect(after.players[playerId].battleArea[1]).toMatchObject({ enteredFrom: 'support', enteredTurn: 2, rested: false })
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(2))
    expect(after.players[playerId].supportArea.map(s => s.card.instanceId)).toEqual(['bs12-044-support-1', 'bs12-044-support-2', 'bs12-044-support-3'])
    expect(after.pendingAbilityEffect?.effects[after.pendingAbilityEffect.effectIndex].kind).toBe('set-active')
    expect(after.pendingAbilityEffect?.previousEffectTargetIds).toEqual(['bs12-044-support-0'])
    const finished = resolve(after, ['bs12-044-support-2'])
    expect(finished.players[playerId].supportArea.map(s => s.rested)).toEqual([true, false, true])
    expect(finished.players[playerId].battleArea[0].rested).toBe(scenario === 'source-rested')
    expect(finished.players['player-two']).toEqual(before.players['player-two'])
    expect(canActivateCookieSkill(finished, playerId, sourceId, 'activate')).toBe(false)
    expect(hasPendingCardResolution(finished)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-044-support-1'], ['bs12-044-support-2'], ['bs12-044-support-3']].map(ids => ({ ids })))('can ready zero or one any-type support $ids', ({ ids }) => {
    const before = play(createBs12HerbTeapotDemoState())
    const after = resolve(before, ids)
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual(before.players[playerId].supportArea.map(s => !ids.includes(s.card.instanceId)))
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  })
  it.each(['active-target', 'all-active', 'blue-target'] as const)('permits already active cards and any support color: %s', scenario => {
    const before = play(createBs12HerbTeapotDemoState(scenario))
    const effect = before.pendingAbilityEffect!.effects[before.pendingAbilityEffect!.effectIndex]
    const context = { sourcePlayerId: playerId, sourceInstanceId: sourceId }
    expect(getEffectSelectionCandidates(before, context, effect).map(c => c.instanceId)).toEqual(['bs12-044-support-1', 'bs12-044-support-2', 'bs12-044-support-3'])
    const after = resolve(before, ['bs12-044-support-1'])
    expect(after.players[playerId].supportArea[0].rested).toBe(false)
    expect(after.players[playerId].deck).toHaveLength(10)
  })
  it.each(['not-herb', 'wrong-name'] as const)('does not open the ready step after playing %s', scenario => {
    const before = createBs12HerbTeapotDemoState(scenario)
    const after = play(before)
    expect(after.players[playerId].battleArea).toHaveLength(2)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea.slice(1))
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    // Greenbell has its own separate On Play decision even though its
    // support-count condition is false; resolving it cannot create 044 Then.
    const finished = after.pendingOnPlay ? applyGameCommand(after, { kind: 'skip-on-play', playerId, sourceInstanceId: 'bs12-044-support-0' }) : after
    expect(hasPendingCardResolution(finished)).toBe(false)
    expect(finished.players[playerId].supportArea).toEqual(before.players[playerId].supportArea.slice(1))
  })
  it.each(['positive', 'no-arena', 'item-only', 'no-support', 'full-battle', 'existing-herb'] as const)('choosing zero consumes the skill but never readies from mere Herb presence: %s', scenario => {
    const before = createBs12HerbTeapotDemoState(scenario)
    const after = play(before, [])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it('checks the previous selected ID, rather than any named Cookie in battle', () => {
    const state = play(createBs12HerbTeapotDemoState())
    const context = { sourcePlayerId: playerId, sourceInstanceId: sourceId }
    const effect = state.pendingAbilityEffect!.effects[1]
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
    expect(isEffectConditionMet({ ...state, pendingAbilityEffect: { ...state.pendingAbilityEffect!, previousEffectTargetIds: [sourceId] } }, context, effect)).toBe(false)
    expect(isEffectConditionMet({ ...state, pendingAbilityEffect: undefined }, context, effect)).toBe(false)
  })
  it.each([['bs12-044-support-2'], ['bs12-044-opponent'], [sourceId], ['unknown'], ['bs12-044-support-0', 'bs12-044-support-1'], ['bs12-044-support-0', 'bs12-044-support-0']].map(ids => ({ ids })))('rejects non-Cookie, side, zone and over-selection for entry $ids', ({ ids }) => {
    const before = begin(createBs12HerbTeapotDemoState())
    expect(() => resolve(before, ids)).toThrow()
  })
  it('rejects non-Arena entry', () => {
    expect(() => play(createBs12HerbTeapotDemoState('no-arena'))).toThrow()
  })
  it.each([['bs12-044-support-0'], [sourceId], ['bs12-044-opponent'], ['unknown'], ['bs12-044-support-1', 'bs12-044-support-2'], ['bs12-044-support-1', 'bs12-044-support-1']].map(ids => ({ ids })))('rejects departed entry card, wrong zone or duplicate ready target $ids', ({ ids }) => {
    const before = play(createBs12HerbTeapotDemoState())
    const snapshot = structuredClone(before)
    expect(() => resolve(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['opponent-turn', 'outside-main', 'used'] as const)('rejects timing or repetition: %s', scenario => {
    const before = createBs12HerbTeapotDemoState(scenario)
    expect(() => begin(before)).toThrow()
  })
  it.each(['last-deck', 'short-deck'] as const)('keeps named entry and its continuation across Refresh: %s', scenario => {
    const waiting = play(createBs12HerbTeapotDemoState(scenario))
    expect(waiting.pendingRefresh?.playerId).toBe(playerId)
    const refreshed = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-044-refresh', shuffleSeed: 3 })
    expect(refreshed.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(refreshed.players[playerId].deck).toHaveLength(scenario === 'last-deck' ? 5 : 4)
    expect(refreshed.players[playerId].breakArea.map(c => c.level)).toEqual([2])
    const after = resolve(refreshed, ['bs12-044-support-3'])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, false])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('ends the game at Refresh LV10 without continuing the ready step', () => {
    const before = play(createBs12HerbTeapotDemoState('refresh-lv10'))
    const after = applyGameCommand(before, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-044-refresh', shuffleSeed: 3 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(() => resolve(after, ['bs12-044-support-1'])).toThrow()
  })
  it('batch skill commands also preserve the named continuation', () => {
    const before = createBs12HerbTeapotDemoState()
    const after = applyGameCommand(before, { kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [],
      effectTargets: [['bs12-044-support-0'], ['bs12-044-support-2']] })
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, false, true])
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('deploys its printed two HP without On Play', () => {
    const after = applyGameCommand(createBs12HerbTeapotDemoState('deploy'), { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('pays GG for exactly two ordinary damage without Then', () => {
    const before = createBs12HerbTeapotDemoState('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-044-opponent',
      supportPaymentIds: ['bs12-044-support-0', 'bs12-044-support-1'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
    expect(after.players['player-two'].discardPile).toHaveLength(2)
    expect(after.players[playerId].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea[0].hpCards })
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, false, false])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested'] as const)('rejects ordinary payment %s', scenario => {
    const before = createBs12HerbTeapotDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-044-opponent',
      supportPaymentIds: ['bs12-044-support-0', 'bs12-044-support-1'] })).toThrow()
  })
})

describe('shared BS7-065 support entry Then draw', () => {
  const fixture = () => {
    const base = createBs12HerbTeapotDemoState()
    const record = bs7.cards.find(card => card.cardNumber === 'BS7-065') as OfficialCardRecord
    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'stage') throw new Error('Missing Stadium')
    return { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId],
      stage: { card: { ...converted.gameCard, instanceId: 'stadium' }, rested: false },
    } } }
  }
  it('keeps real support entry, HP setup and independent draw in the staged command', () => {
    const before = fixture()
    const paid = applyGameCommand(before, { kind: 'begin-activate-stage', playerId, paymentIds: [] })
    const entered = resolve(paid, ['bs12-044-support-0'])
    expect(entered.players[playerId].stage?.rested).toBe(true)
    expect(entered.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(entered.players[playerId].deck).toHaveLength(10)
    expect(entered.pendingAbilityEffect?.effects[entered.pendingAbilityEffect.effectIndex]).toMatchObject({ kind: 'draw-up-to', max: 1 })
    const drawDecision = resolve(entered, [])
    const after = applyGameCommand(drawDecision, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(2, 3))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('does not draw after choosing no entry', () => {
    const before = fixture()
    const paid = applyGameCommand(before, { kind: 'begin-activate-stage', playerId, paymentIds: [] })
    const after = resolve(paid, [])
    expect(after.players[playerId].stage?.rested).toBe(true)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
})
