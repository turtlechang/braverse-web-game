import { describe, expect, it } from 'vitest'
import { createBs12HerbDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { executeCardEffect } from './effects'
import { describeCommandSteps } from './command-log'
import { maskGameStateForViewer } from './masked-state'
import type { GameState } from './types'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-055-source'
const begin = (state: GameState, mode = 0, discardHandIds = ['bs12-055-hand-0']) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId, sourceInstanceId, trigger: 'activate', paymentIds: [], discardHandIds, chooseOneModes: [mode],
})
const resolve = (state: GameState) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] })

describe.each(['BS12-055', 'BS12-055@1'] as const)('%s Cozy Ensemble', number => {
  it.each(['positive', 'rested-entry', 'source-rested'] as const)('uses this actual support entry and completes after source trash: %s', scenario => {
    const before = createBs12HerbDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const source = before.players[playerId].battleArea[1]
    expect(source).toMatchObject({ enteredFrom: 'support', enteredTurn: before.turnNumber, hpCards: expect.any(Array) })
    expect(source.hpCards).toHaveLength(2)
    expect(canActivateCookieSkill(before, playerId, sourceInstanceId, 'activate')).toBe(true)
    const paid = begin(before)
    expect(paid.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-055-ally'])
    expect(paid.players[playerId].discardPile).toEqual([before.players[playerId].hand[0], source.card, ...source.hpCards])
    expect(paid.pendingReplacement).toBeNull()
    expect(paid.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    const after = resolve(paid)
    expect(after.players[playerId].supportArea).toEqual([...before.players[playerId].supportArea, { card: before.players[playerId].deck[0], rested: true }])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(1))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand.slice(1))
    expect(after.players[playerId].breakArea).toEqual([])
    expect(after.pendingOnPlay).toBeNull()
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(after.pendingReplacement?.tasks[0].playerId).toBe(playerId)
    expect(after.skillUsesThisTurn).toEqual(before.skillUsesThisTurn)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(before).toEqual(snapshot)
  })
  it.each(['positive', 'empty-deck'] as const)('chooses zero but pays hand and source, without drawing or Refresh: %s', scenario => {
    const before = createBs12HerbDemoState(scenario, number)
    const after = resolve(begin(before, 1))
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand.slice(1))
    expect(after.players[playerId].discardPile).toHaveLength(4)
    expect(after.pendingRefresh).toBeNull()
    expect(after.pendingReplacement?.tasks[0].playerId).toBe(playerId)
  })
  it.each(['deck-item', 'deck-stage', 'deck-blue'] as const)('places any top card type/color as rested without OnPlay: %s', scenario => {
    const before = createBs12HerbDemoState(scenario, number)
    const after = resolve(begin(before))
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: before.players[playerId].deck[0], rested: true })
    expect(after.pendingOnPlay).toBeNull()
  })
  it.each([0, 1, 2])('pays any hand type/color at index %s', index => {
    const before = createBs12HerbDemoState('positive', number)
    const after = resolve(begin(before, 0, [`bs12-055-hand-${index}`]))
    expect(after.players[playerId].discardPile[0]).toEqual(before.players[playerId].hand[index])
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand.filter((_, i) => i !== index))
  })
  it.each(['hand-origin', 'other-cookie', 'old-turn', 'no-hand', 'source-support', 'opponent-turn', 'outside-main'] as const)('blocks only the printed restriction: %s', scenario => {
    const before = createBs12HerbDemoState(scenario, number)
    const snapshot = structuredClone(before)
    if (scenario === 'other-cookie') expect(before.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    if (['hand-origin', 'other-cookie', 'old-turn'].includes(scenario)) expect(getCookieSkillUnavailableReason(before, playerId, sourceInstanceId, 'activate')).toMatch(/這張餅乾本回合從自己的支援區登場/)
    expect(canActivateCookieSkill(before, playerId, sourceInstanceId, 'activate')).toBe(false)
    expect(() => begin(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-055-source'], ['bs12-055-support-0'], ['bs12-054-foe-trash'], ['bs12-055-hand-0', 'bs12-055-hand-1'], ['bs12-055-hand-0', 'bs12-055-hand-0'], ['unknown']])('rejects invalid hand cost %j without mutation', (...ids) => {
    const before = createBs12HerbDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => begin(before, 0, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('retains the original effect when source attachments and HP are discarded', () => {
    const before = createBs12HerbDemoState('positive', number)
    const source = before.players[playerId].battleArea[1]
    const equippedCards = [before.players[playerId].supportArea[1].card]
    const prepared = { ...before, players: { ...before.players, [playerId]: { ...before.players[playerId], supportArea: before.players[playerId].supportArea.filter((_, i) => i !== 1), battleArea: [before.players[playerId].battleArea[0], { ...source, equippedCards }] } } }
    const after = resolve(begin(prepared))
    expect(after.players[playerId].discardPile).toEqual([before.players[playerId].hand[0], source.card, ...source.hpCards, ...equippedCards])
    expect(after.players[playerId].supportArea.at(-1)?.rested).toBe(true)
  })
  it('Refreshes after the final top card, before offering optional replacement', () => {
    const before = createBs12HerbDemoState('refresh', number)
    const waiting = resolve(begin(before))
    expect(waiting.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    expect(waiting.pendingReplacement).toBeNull()
    expect(waiting.players[playerId].supportArea.at(-1)).toEqual({ card: before.players[playerId].deck[0], rested: true })
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-055-hand-0', shuffleSeed: 3 })
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-055-hand-0'])
    expect(after.players[playerId].deck).toHaveLength(3)
    expect(after.pendingRefresh).toBeNull()
    expect(after.pendingReplacement?.tasks[0].playerId).toBe(playerId)
  })
  it('completes the paid non-battle effect before requiring replacement of the emptied battle area', () => {
    const base = createBs12HerbDemoState('positive', number)
    const before = { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId], battleArea: [base.players[playerId].battleArea[1]], supportArea: [...base.players[playerId].supportArea, { card: base.players[playerId].battleArea[0].card, rested: true }] } } }
    const paid = begin(before)
    expect(paid.pendingReplacement).toBeNull()
    expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe(sourceInstanceId)
    const after = resolve(paid)
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: before.players[playerId].deck[0], rested: true })
    expect(after.pendingReplacement?.tasks[0].playerId).toBe(playerId)
    expect(() => applyGameCommand(after, { kind: 'skip-replacement', playerId })).toThrow()
    const replaced = applyGameCommand(after, { kind: 'replace-cookie', playerId, instanceId: 'bs12-055-hand-2' })
    expect(replaced.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    expect(replaced.pendingAbilityEffect).toBeUndefined()
    expect(replaced.pendingReplacement).toBeNull()
  })
  it('ends at Refresh LV10 after support placement without opening replacement', () => {
    const base = createBs12HerbDemoState('refresh', number)
    const arena = base.players[playerId].deck[0]
    if (arena.type !== 'cookie') throw new Error('Expected printed LV3 Melon')
    expect(arena.level).toBe(3)
    const before = { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId], breakArea: Array.from({ length: 3 }, (_, i) => ({ ...arena, instanceId: `bs12-055-break-${i}` })) } } }
    const waiting = resolve(begin(before))
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-055-hand-0', shuffleSeed: 3 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.pendingReplacement).toBeNull()
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: arena, rested: true })
  })
  it('keeps this source origin available to online UI without revealing HP or deck', () => {
    for (const scenario of ['positive', 'other-cookie', 'old-turn'] as const) {
      const state = createBs12HerbDemoState(scenario, number)
      const masked = maskGameStateForViewer(state, playerId)
      expect(canActivateCookieSkill(masked, playerId, sourceInstanceId, 'activate')).toBe(scenario === 'positive')
      expect(masked.players[playerId].deck.every(c => c.id === 'hidden')).toBe(true)
      expect(masked.players[playerId].battleArea[1].enteredFrom).toBe(scenario === 'other-cookie' ? 'hand' : 'support')
    }
  })
  it('ends only after resolving the non-battle effect when no Cookie can fill the emptied battle area', () => {
    const base = createBs12HerbDemoState('positive', number)
    const before = { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId], hand: base.players[playerId].hand.slice(0, 1), battleArea: [base.players[playerId].battleArea[1]] } } }
    const paid = begin(before)
    expect(paid.status).toBe('playing')
    const waiting = resolve(paid)
    expect(waiting.pendingReplacement?.tasks[0].playerId).toBe(playerId)
    expect(waiting.players[playerId].supportArea.at(-1)).toEqual({ card: before.players[playerId].deck[0], rested: true })
    const after = applyGameCommand(waiting, { kind: 'skip-replacement', playerId })
    expect(after.status).toBe('finished')
    expect(after.result).toMatchObject({ winnerId: 'player-two', reason: 'no-cookie-available' })
  })
  it('pays G for one ordinary damage without Then', () => {
    const before = createBs12HerbDemoState('attack', number)
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceInstanceId, targetInstanceId: 'bs12-054-opponent', supportPaymentIds: ['bs12-055-support-0'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 3])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, false, false, false])
    expect(after.players[playerId].battleArea[1].rested).toBe(true)
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['attack-wrong', 'attack-rested-energy', 'attack-rested-source'] as const)('rejects illegal attack %s', scenario => {
    const before = createBs12HerbDemoState(scenario, number)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceInstanceId, targetInstanceId: 'bs12-054-opponent', supportPaymentIds: before.players[playerId].supportArea.slice(0, 1).map(s => s.card.instanceId) })).toThrow()
  })
  it('deploys two HP from hand and does not enable support-origin Activate', () => {
    const before = createBs12HerbDemoState('deploy', number)
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceInstanceId })
    expect(after.players[playerId].battleArea[1]).toMatchObject({ enteredFrom: 'hand', enteredTurn: before.turnNumber })
    expect(after.players[playerId].battleArea[1].hpCards).toHaveLength(2)
    expect(after.pendingOnPlay).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
  it('only exposes a local candidate route', () => {
    expect(parseTestStateConfig(`?test-state=bs12-055:${number}:positive`, 'localhost')).toMatchObject({ kind: 'bs12-055', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-055:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each([0, 1])('records exact public support result for mode %s without revealing the remaining deck', mode => {
    const paid = begin(createBs12HerbDemoState('positive', number), mode)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(paid, command)
    const steps = describeCommandSteps(paid, after, command)!
    expect(steps.map(step => step.text).join(' ')).toMatch(mode === 0 ? /1 張卡移入支援區（疲勞）：Melon Soda Cookie/ : /選擇 0 張，此段未移動卡牌/)
    expect(steps.flatMap(step => step.cards ?? []).map(c => c.instanceId)).toEqual(mode === 0 ? ['bs12-055-deck-2'] : [])
  })
  it('validates a new hand entry independently of the prior support entry of the same instance', () => {
    const before = createBs12HerbDemoState('positive', number)
    const settled = applyGameCommand(resolve(begin(before, 1)), { kind: 'skip-replacement', playerId })
    const returned = executeCardEffect(settled, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-055-ally' }, { kind: 'trash-to-hand', max: 1 }, [sourceInstanceId])
    const reentered = applyGameCommand(returned, { kind: 'deploy-cookie', playerId, instanceId: sourceInstanceId })
    const source = reentered.players[playerId].battleArea[1]
    expect(source.enteredFrom).toBe('hand')
    expect(source.battleEntryId).not.toBe(before.players[playerId].battleArea[1].battleEntryId)
    expect(reentered.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    expect(canActivateCookieSkill(reentered, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
})

it('shared explicit deck support zero neither draws nor Refreshes an empty deck', () => {
  const before = createBs12HerbDemoState('empty-deck')
  expect(executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId }, { kind: 'deck-to-support', amount: 0, rested: true }, [])).toBe(before)
})
