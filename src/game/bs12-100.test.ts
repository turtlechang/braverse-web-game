import { expect, it } from 'vitest'
import { BS12_STRATEGIST_SCENARIOS, createBs12StrategistDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canSpecialPlayCookie } from './actions'
import { getTrashToHandCandidates } from './effects'
import { hasPendingCardResolution } from './pending'
import { takeAiStep } from './ai'
import { describeCommandSteps } from './command-log'
import type { GameState } from './types'

const playerId = 'player-one' as const, source = 'bs12-100-source', target = 'bs12-100-target', cost = 'bs12-095-cost'
const context = { sourcePlayerId: playerId, sourceInstanceId: source, sourceCardName: 'Strategist Cake Hound' }
const effect = { kind: 'trash-to-hand' as const, max: 1, cookieOnly: true, keyword: 'arena' as const, hasSpecialPlay: true }
const candidates = (state: GameState) => getTrashToHandCandidates(state, context, effect).map(card => card.instanceId)
const deploy = (state: GameState, ids?: string[]) => applyGameCommand(state, { kind: 'deploy-cookie', playerId, instanceId: source, ...(ids ? { specialPlayCookieInstanceIds: ids } : {}) })
const finish = (input: GameState) => {
  let state = input
  for (let i = 0; state.pendingBattle?.stage === 'damage' && !state.pendingFaintEffects?.length && !state.pendingReplacement && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}
const recover = (state: GameState, targetIds: string[] = [target]) => finish(applyGameCommand(state, { kind: 'resolve-flip', playerId, activate: true, targetIds }))

it.each(['flip', 'flip-two-targets', 'flip-same-name', 'flip-pudding', 'flip-rested', 'flip-hand-and-support'] as const)('100 free FLIP recovers one actual own Arena Special Play Cookie: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario), snapshot = structuredClone(before), recovered = before.players[playerId].discardPile.find(card => card.instanceId === target)!
  expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-100')
  expect(candidates(before)).toEqual(scenario === 'flip-two-targets' ? [target, 'bs12-100-other-target'] : [target])
  const after = recover(before)
  expect(after.players[playerId].hand).toEqual([...before.players[playerId].hand, recovered])
  expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile.filter(card => card.instanceId !== target), before.pendingBattle!.revealedHpCard])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
  expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  expect(after.pendingBattle).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(before).toEqual(snapshot)
})
it.each(['flip-only-arena', 'flip-only-special', 'flip-split', 'flip-non-cookie', 'flip-no-target', 'flip-zones'] as const)('100 cannot combine criteria or borrow other zones: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario)
  expect(candidates(before)).toEqual([])
  const after = recover(before, [])
  expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
  expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.pendingBattle!.revealedHpCard])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  expect(after.pendingBattle).toBeNull()
})
it.each([true, false])('100 selecting zero or declining never consumes energy or hand: activate=%s', activate => {
  const before = createBs12StrategistDemoState('flip-hand-and-support')
  const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId, activate, targetIds: [] }))
  expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
  expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
})
it.each([[source], ['bs12-100-arena-only'], ['bs12-100-special-only'], [target, target], [target, 'bs12-100-other-target'], ['missing']].map(ids => ({ids})))('100 refuses current revealed source, invalid targets, duplicates or excess atomically: $ids', ({ids}) => {
  const before = createBs12StrategistDemoState('flip-two-targets'), snapshot = structuredClone(before)
  expect(() => recover(before, ids)).toThrow()
  expect(before).toEqual(snapshot)
})
it.each(['bs12-100-hand-target', 'bs12-100-support-target', 'bs12-100-break-target', 'bs12-100-opponent-target', 'bs12-100-companion'])('100 refuses real legal-text cards in the wrong zone: %s', id => {
  const before = createBs12StrategistDemoState('flip-zones'), snapshot = structuredClone(before)
  expect(() => recover(before, [id])).toThrow()
  expect(before).toEqual(snapshot)
})
it('100 can choose the other legal Cookie instead of the first candidate', () => {
  const before = createBs12StrategistDemoState('flip-two-targets'), after = recover(before, ['bs12-100-other-target'])
  expect(after.players[playerId].hand.map(card => card.id)).toEqual(['BS12-096'])
  expect(after.players[playerId].discardPile.some(card => card.instanceId === target)).toBe(true)
})
it.each(['flip-last-hp', 'flip-last-hp-same-name'] as const)('100 recovery does not rescue last HP; recovered Cookie can replace the fainted bearer: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario), after = recover(before)
  expect(after.players[playerId].battleArea.map(cookie => cookie.card.instanceId)).toEqual(['bs12-100-companion'])
  expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual(['bs12-100-bearer'])
  expect(after.players[playerId].hand[0].instanceId).toBe(target)
  expect(after.pendingReplacement?.tasks).toEqual([{ playerId, remaining: 1 }])
  const replaced = applyGameCommand(after, { kind: 'replace-cookie', playerId, instanceId: target })
  expect(replaced.players[playerId].battleArea.at(-1)?.hpCards).toEqual(before.players[playerId].deck.slice(0, 1))
  expect(replaced.players[playerId].hand).toEqual([])
  expect(replaced.pendingReplacement).toBeNull()
})
it('100 recovered FLIP card enters trash only after recovery, then an independent 099 faint skill may recover it', () => {
  const before = createBs12StrategistDemoState('flip-last-hp-faint-chain'), recovered = recover(before)
  expect(recovered.players[playerId].hand.map(card => card.id)).toEqual(['BS12-095'])
  expect(recovered.pendingFaintEffects?.[0].sourceCardName).toBe('Cake Hound')
  const paid = applyGameCommand(recovered, { kind: 'resolve-faint-effect', playerId, targetIds: [], payDeckToTrash: true })
  const after = applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId, targetIds: [source] })
  expect(after.players[playerId].hand.map(card => card.id)).toEqual(['BS12-095', 'BS12-100'])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
  expect(after.pendingFaintEffects).toBeUndefined()
})
it('100 AI selects a real legal trash recovery with the same shared rule', () => {
  const before = createBs12StrategistDemoState('flip'), after = takeAiStep(before, playerId).state
  expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual([target])
})
it('100 public log identifies real recovered card and zero-selection outcome', () => {
  const before = createBs12StrategistDemoState('flip'), command = { kind: 'resolve-flip' as const, playerId, activate: true, targetIds: [target] }
  expect(describeCommandSteps(before, recover(before), command)?.map(step => step.text).join(' ')).toMatch(/Blueberry Cake Hound.*棄牌區.*手牌/)
  expect(describeCommandSteps(before, recover(before, []), { ...command, targetIds: [] })?.map(step => step.text).join(' ')).toMatch(/沒有卡牌從棄牌區返回手牌/)
})
it.each(['special', 'special-non-arena', 'special-rested', 'special-full', 'special-two-candidates'] as const)('100 Special Play pays real black LV1 body and HP without faint: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario), snapshot = structuredClone(before), paid = before.players[playerId].battleArea[0]
  expect(canSpecialPlayCookie(before, playerId, source)).toBe(true)
  const after = deploy(before, [cost])
  expect(after.players[playerId].discardPile).toEqual([paid.card, ...paid.hpCards])
  expect(after.players[playerId].breakArea).toEqual([])
  expect(after.players[playerId].battleArea.at(-1)?.card.id).toBe('BS12-100')
  expect(after.players[playerId].battleArea.at(-1)?.hpCards).toEqual(before.players[playerId].deck.slice(0, 1))
  expect(after.players[playerId].hand).toEqual([])
  expect(after.pendingReplacement?.tasks).toEqual([{ playerId, remaining: 1 }])
  expect(before).toEqual(snapshot)
})
it.each(['special-wrong-color', 'special-wrong-level', 'special-wrong-zone', 'special-no-cost', 'special-opponent-only', 'special-other-turn', 'special-outside-main'] as const)('100 refuses invalid Special Play without any payment: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario), snapshot = structuredClone(before)
  expect(canSpecialPlayCookie(before, playerId, source)).toBe(false)
  expect(() => deploy(before, [cost])).toThrow()
  expect(before).toEqual(snapshot)
})
it('100 ordinary entry adds one HP and leaves the optional cost Cookie intact', () => {
  const before = createBs12StrategistDemoState('deploy'), after = deploy(before)
  expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
  expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 1))
  expect(after.players[playerId].discardPile).toEqual([])
})
it('100 Special Play accepts exactly one eligible cost, including the other actual Cookie', () => {
  const before = createBs12StrategistDemoState('special-two-candidates'), snapshot = structuredClone(before)
  for (const ids of [[], [cost, cost], [cost, 'bs12-095-other-cost'], [source], ['missing']]) expect(() => deploy(before, ids)).toThrow()
  const after = deploy(before, ['bs12-095-other-cost'])
  expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
  expect(before).toEqual(snapshot)
})
it.each(['attack', 'attack-spare-energy', 'attack-faint'] as const)('100 KK ordinary two does not add a Then or consume unselected support: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario)
  const declared = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: source, targetInstanceId: 'bs12-095-opponent', supportPaymentIds: ['bs12-095-payment-0', 'bs12-095-payment-1'] })
  const after = finish(applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-two' }))
  expect(after.players[playerId].supportArea.map(support => support.rested)).toEqual(scenario === 'attack-spare-energy' ? [true, true, false] : [true, true])
  expect(after.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual(scenario === 'attack-faint' ? [] : [3])
  expect(after.players['player-two'].discardPile).toHaveLength(2)
  expect(after.pendingBattle).toBeNull()
})
it.each(['attack-wrong-energy', 'attack-few-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main'] as const)('100 blocks illegal attack atomically: %s', scenario => {
  const before = createBs12StrategistDemoState(scenario), snapshot = structuredClone(before)
  expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: source, targetInstanceId: 'bs12-095-opponent', supportPaymentIds: ['bs12-095-payment-0', 'bs12-095-payment-1'] })).toThrow()
  expect(before).toEqual(snapshot)
})
it.each(BS12_STRATEGIST_SCENARIOS)('100 finite fixture %s uses unique real cards, maximum four copies and two battle Cookies', scenario => {
  expect(parseTestStateConfig(`?test-state=bs12-100:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-100', scenario })
  const state = createBs12StrategistDemoState(scenario), ids: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
    const copies = new Map<string, number>()
    for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
    expect([...copies.values()].every(count => count <= 4)).toBe(true)
    ids.push(...cards.map(card => card.instanceId))
  }
  expect(new Set(ids).size).toBe(ids.length)
})
