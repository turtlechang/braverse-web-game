import { describe, expect, it } from 'vitest'
import { createBs12CreamSodaDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getEffectSelectionCandidates } from './effects'
import { hasPendingCardResolution } from './pending'
import type { GameState } from './types'

const playerId = 'player-one' as const
const sourceId = 'bs12-072-source'
const begin = (state: GameState, paymentIds = ['bs12-069-payment-0']) => applyGameCommand(state, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds })
const resolve = (state: GameState, targetIds = ['bs12-072-target']) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })

describe.each(['BS12-072', 'BS12-072@1'] as const)('%s real Activate commands', number => {
  const initial = (scenario: Parameters<typeof createBs12CreamSodaDemoState>[0] = 'positive') => createBs12CreamSodaDemoState(scenario, number)
  it('pays one B before moving only the other own Arena Cookie to the actual bottom', () => {
    const before = initial()
    const target = before.players['player-one'].battleArea[1]
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'bs12-072-source', trigger: 'activate', paymentIds: ['bs12-069-payment-0'] })
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['bs12-072-target'] })
    expect(after.players['player-one'].deck).toEqual([...before.players['player-one'].deck, target.card])
    expect(after.players['player-one'].discardPile).toEqual([...before.players['player-one'].discardPile, ...target.hpCards])
    expect(after.players['player-one'].battleArea).toEqual([before.players['player-one'].battleArea[0]])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  })
  it('isolates the candidate route from public hosts', () => {
    expect(parseTestStateConfig(`?test-state=bs12-072:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-072', scenario: 'positive', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=bs12-072:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'level-one', 'rested-target', 'equipped-target', 'same-name', 'source-rested', 'one-energy', 'short-deck'] as const)('real payment and exact movement: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    const target = before.players[playerId].battleArea[1]
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(true)
    const paid = begin(before)
    expect(paid.players[playerId].supportArea[0].rested).toBe(true)
    expect(paid.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
    const after = resolve(paid)
    expect(after.players[playerId].deck).toEqual([...before.players[playerId].deck, target.card])
    expect(after.players[playerId].battleArea).toEqual([before.players[playerId].battleArea[0]])
    expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, ...target.hpCards, ...(target.equippedCards ?? [])])
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.pendingFaintEffects ?? []).toEqual([])
    expect(after.cookiesPlacedFromBattleToDeckThisTurn?.[playerId]).toBe(true)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingRefresh ?? null).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['positive', 'non-arena', 'level-three', 'no-target', 'hand-only', 'support-only', 'stage-only', 'awakened-target'] as const)('zero is legal and pays B even without a confirmed target: %s', scenario => {
    const before = initial(scenario)
    const paid = begin(before)
    const effect = paid.pendingAbilityEffect!.effects[0]
    const candidates = getEffectSelectionCandidates(paid, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, effect)
    expect(candidates.map(card => card.instanceId)).toEqual(['positive', 'awakened-target'].includes(scenario) ? ['bs12-072-target'] : [])
    const after = resolve(paid, [])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'once-used'] as const)('rejects unavailable declaration atomically: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(() => begin(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-069-payment-0', 'bs12-069-payment-1'], ['bs12-072-source'], ['bs12-069-payment-0', 'bs12-069-payment-0']].map(paymentIds => ({ paymentIds })))('rejects wrong exact B payment: $paymentIds', ({ paymentIds }) => {
    const before = initial()
    const snapshot = structuredClone(before)
    expect(() => begin(before, paymentIds)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([['bs12-072-source'], ['bs12-064-opponent'], ['bs12-072-replacement'], ['bs12-069-payment-0'], ['bs12-072-target', 'bs12-072-target'], ['bs12-072-source', 'bs12-072-target']].map(ids => ({ ids })))('rejects invalid or excess target without additional movement: $ids', ({ ids }) => {
    const paid = begin(initial())
    const snapshot = structuredClone(paid)
    expect(() => resolve(paid, ids)).toThrow()
    expect(paid).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-three', 'awakened-target'] as const)('forbids invalid target even after valid payment: %s', scenario => {
    const paid = begin(initial(scenario))
    const snapshot = structuredClone(paid)
    if (scenario === 'awakened-target') {
      // Isolated attachment routing; the actual printed Awaken parent is tested separately.
      const target = paid.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-072-target')!
      const after = resolve(paid)
      expect(after.players[playerId].discardPile).toEqual([...paid.players[playerId].discardPile, ...target.hpCards, ...(target.equippedCards ?? []), ...(target.awakenedUnderlay ?? [])])
    } else expect(() => resolve(paid)).toThrow()
    expect(paid).toEqual(snapshot)
  })
  it('replacement waits until movement completes and then deploys from hand with normal HP', () => {
    const moved = resolve(begin(initial()))
    expect(moved.pendingReplacement).toMatchObject({ tasks: [{ playerId, remaining: 1 }] })
    const after = applyGameCommand(moved, { kind: 'replace-cookie', playerId, instanceId: 'bs12-072-replacement' })
    expect(after.players[playerId].battleArea.map(cookie => cookie.card.instanceId)).toEqual([sourceId, 'bs12-072-replacement'])
    expect(after.players[playerId].battleArea[1].hpCards).toHaveLength(3)
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.players[playerId].deck.at(-1)?.instanceId).toBe('bs12-072-target')
  })
  it('once belongs to the field instance and resets for a new entry', () => {
    const used = resolve(begin(initial()), [])
    const reentered: GameState = { ...used, players: { ...used.players, [playerId]: { ...used.players[playerId],
      supportArea: used.players[playerId].supportArea.map(card => ({ ...card, rested: false })),
      battleArea: used.players[playerId].battleArea.map(cookie => cookie.card.instanceId === sourceId ? { ...cookie, battleEntryId: 'new-entry' } : cookie),
    } } }
    expect(canActivateCookieSkill(used, playerId, sourceId, 'activate')).toBe(false)
    expect(canActivateCookieSkill(reentered, playerId, sourceId, 'activate')).toBe(true)
  })
  it('JSON transport keeps the exact selector and permits the same decision', () => {
    const paid = begin(initial())
    expect(resolve(JSON.parse(JSON.stringify(paid)))).toEqual(resolve(paid))
  })
  it('BB ordinary two preserves resources until R004 Then is explicitly chosen or skipped', () => {
    const before = initial()
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: ['bs12-069-payment-0', 'bs12-069-payment-1'] })
    expect(after.pendingBattle?.declaredDamage).toBe(2)
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 5; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(after.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([4, 4])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
    expect(after.pendingBattle?.stage).toBe('attack-effect')
    const offered = applyGameCommand(after, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    const skipped = applyGameCommand(offered, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(skipped.players).toEqual(after.players)
    expect(hasPendingCardResolution(skipped)).toBe(false)
  })
  it.each(['one-energy', 'wrong-energy', 'rested-energy', 'source-rested'] as const)('rejects illegal ordinary BB: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: before.players[playerId].supportArea.map(card => card.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
})
