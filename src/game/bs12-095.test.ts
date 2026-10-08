import { expect, it } from 'vitest'
import { BS12_BLUEBERRY_SCENARIOS, createBs12BlueberryDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canSpecialPlayCookie } from './actions'
import { getTrashBattleCookieCostCandidates } from './skills'
import { getEffectTargetCandidatesForEffect } from './effects'
import { hasPendingCardResolution } from './pending'

const owner = 'player-one' as const
const source = 'bs12-095-source', cost = 'bs12-095-cost', bearer = 'bs12-095-bearer', other = 'bs12-095-companion'
const flipContext = { sourcePlayerId: owner, sourceInstanceId: source, sourceCardName: 'Blueberry Cake Hound' }
type State = ReturnType<typeof createBs12BlueberryDemoState>
const deploy = (state: State, ids?: string[]) => applyGameCommand(state, { kind: 'deploy-cookie', playerId: owner, instanceId: source, ...(ids ? { specialPlayCookieInstanceIds: ids } : {}) })
const activate = (state: State, targets: string[], discardHandIds = ['bs12-095-hand-cost']) => applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true, targetIds: targets, discardHandIds })
const finish = (input: State) => {
  let state = input
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}
const attack = (before: State) => applyGameCommand(before, { kind: 'declare-attack', playerId: owner, attackerInstanceId: source, targetInstanceId: 'bs12-095-opponent', supportPaymentIds: ['bs12-095-payment-0', 'bs12-095-payment-1'] })

it.each(['special', 'special-non-arena', 'special-rested', 'special-full', 'special-two-candidates'] as const)('095 Special Play pays one actual black LV1 body and its HP, then schedules replacement without faint or FLIP: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario), snapshot = structuredClone(before)
  const chosen = before.players[owner].battleArea.find(c => c.card.instanceId === cost)!
  expect(getTrashBattleCookieCostCandidates(before.players[owner].hand[0].skill!.specialPlayCost!, before.players[owner].battleArea).map(c => c.card.instanceId))
    .toEqual(scenario === 'special-two-candidates' ? [cost, 'bs12-095-other-cost'] : [cost])
  expect(canSpecialPlayCookie(before, owner, source)).toBe(true)
  if (scenario === 'special-rested') expect(chosen.rested).toBe(true)
  if (scenario === 'special-non-arena') expect(chosen.card.keywords ?? []).toEqual([])
  const after = deploy(before, [cost])
  expect(after.players[owner].discardPile).toEqual([chosen.card, ...chosen.hpCards])
  expect(after.players[owner].battleArea).toHaveLength(before.players[owner].battleArea.length)
  expect(after.players[owner].battleArea.at(-1)?.hpCards).toEqual(before.players[owner].deck.slice(0, 1))
  expect(after.players[owner].deck).toEqual(before.players[owner].deck.slice(1))
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].breakArea).toEqual([])
  expect(after.players[owner].supportArea).toEqual(before.players[owner].supportArea)
  expect(after.cookiesPlayedViaSpecialPlayThisTurn?.[owner]).toBe(true)
  expect(after.pendingOnPlay).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(after.pendingReplacement).toEqual({ tasks: [{ playerId: owner, remaining: 1 }] })
  expect(applyGameCommand(after, { kind: 'skip-replacement', playerId: owner }).pendingReplacement).toBeNull()
  expect(before).toEqual(snapshot)
})

it('095 normal entry keeps the optional Special Play cost Cookie and adds only printed one HP', () => {
  const before = createBs12BlueberryDemoState('deploy'), after = deploy(before)
  expect(after.players[owner].battleArea[0]).toEqual(before.players[owner].battleArea[0])
  expect(after.players[owner].battleArea[1].hpCards).toEqual(before.players[owner].deck.slice(0, 1))
  expect(after.players[owner].discardPile).toEqual([])
  expect(after.cookiesPlayedViaSpecialPlayThisTurn?.[owner]).toBeUndefined()
  expect(after.pendingOnPlay).toBeNull()
})

it.each(['special-wrong-color', 'special-wrong-level', 'special-wrong-zone', 'special-no-cost', 'special-opponent-only', 'special-other-turn', 'special-outside-main'] as const)('095 blocks an illegal Special Play without changing any zone: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario), snapshot = structuredClone(before)
  expect(canSpecialPlayCookie(before, owner, source)).toBe(false)
  expect(() => deploy(before, [scenario === 'special-opponent-only' ? 'bs12-095-opponent-cost' : cost])).toThrow()
  expect(before).toEqual(snapshot)
})

it('095 accepts real Licorice only after its actual Activate makes printed LV2 effective LV1', () => {
  const before = createBs12BlueberryDemoState('special-licorice')
  expect(before.players[owner].battleArea[0].card.level).toBe(2)
  expect(canSpecialPlayCookie(before, owner, source)).toBe(false)
  const ready = applyGameCommand(before, { kind: 'activate-skill', playerId: owner, sourceInstanceId: cost, trigger: 'activate', paymentIds: [], effectTargets: [[cost]] })
  expect(ready.players[owner].battleArea[0]).toMatchObject({ card: { level: 2 }, levelOverride: 1 })
  expect(canSpecialPlayCookie(ready, owner, source)).toBe(true)
  const after = deploy(ready, [cost])
  expect(after.players[owner].discardPile).toEqual([ready.players[owner].battleArea[0].card, ...ready.players[owner].battleArea[0].hpCards])
  expect(after.players[owner].battleArea[0].hpCards).toHaveLength(1)
  expect(after.pendingOnPlay).toBeNull()
  expect(after.pendingReplacement).toEqual({ tasks: [{ playerId: owner, remaining: 1 }] })
  expect(applyGameCommand(after, { kind: 'skip-replacement', playerId: owner }).pendingReplacement).toBeNull()
})

it('095 exact cost rejects zero, two, duplicate, hand and unknown Cookie ids atomically', () => {
  const before = createBs12BlueberryDemoState('special-two-candidates'), snapshot = structuredClone(before)
  for (const ids of [[], [cost, cost], [cost, 'bs12-095-other-cost'], [source], ['missing']]) expect(() => deploy(before, ids)).toThrow()
  expect(before).toEqual(snapshot)
  const after = deploy(before, ['bs12-095-other-cost'])
  expect(after.players[owner].battleArea[0]).toEqual(before.players[owner].battleArea[0])
})

it.each(['attack', 'attack-spare-energy', 'attack-faint'] as const)('095 pays two actual black supports and ordinary two, with no Then: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario)
  const after = finish(applyGameCommand(attack(before), { kind: 'skip-trap', playerId: 'player-two' }))
  expect(after.players[owner].supportArea.map(c => c.rested)).toEqual(scenario === 'attack-spare-energy' ? [true, true, false] : [true, true])
  expect(after.players[owner].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[owner].battleArea[0].hpCards })
  expect(after.players['player-two'].discardPile).toHaveLength(2)
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual(scenario === 'attack-faint' ? [] : [3])
  expect(after.players['player-two'].breakArea).toHaveLength(scenario === 'attack-faint' ? 1 : 0)
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  expect(hasPendingCardResolution(after)).toBe(false)
})

it.each(['attack-wrong-energy', 'attack-few-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main'] as const)('095 attack rejects wrong resources and timing atomically: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario), snapshot = structuredClone(before)
  expect(() => attack(before)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each(['flip', 'flip-red', 'flip-blue', 'flip-green', 'flip-purple', 'flip-black', 'flip-yellow', 'flip-rested'] as const)('095 FLIP can heal either own Arena Cookie, including other colors and REST: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario), effect = before.pendingBattle!.revealedHpCard!.flip!.effects[0]
  expect(getEffectTargetCandidatesForEffect(before, flipContext, effect).map(c => c.card.instanceId)).toEqual([bearer, other])
  const snapshot = structuredClone(before)
  for (const target of [bearer, other]) {
    const after = finish(activate(before, [target]))
    expect(after.players[owner].battleArea.map(c => c.hpCards.length)).toEqual(before.players[owner].battleArea.map(c=>c.hpCards.length+(c.card.instanceId===target?1:0)))
    expect(after.players[owner].battleArea.find(c => c.card.instanceId === target)?.hpCards.at(-1)).toEqual(before.players[owner].deck[0])
    expect(after.players[owner].deck).toEqual(before.players[owner].deck.slice(1))
    expect(after.players[owner].hand).toEqual([])
    expect(after.players[owner].discardPile.map(c => c.instanceId)).toEqual(['bs12-095-hand-cost', source])
    expect(after.players[owner].supportArea).toEqual(before.players[owner].supportArea)
    expect(after.pendingBattle).toBeNull()
  }
  expect(before).toEqual(snapshot)
})

it.each(['flip-non-arena', 'flip-support-only', 'flip-opponent-only'] as const)('095 has no eligible target outside own Arena battle Cookies, but paid zero remains legal: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario), effect = before.pendingBattle!.revealedHpCard!.flip!.effects[0]
  expect(getEffectTargetCandidatesForEffect(before, flipContext, effect)).toEqual([])
  const after = finish(activate(before, []))
  expect(after.players[owner].battleArea).toEqual(before.players[owner].battleArea)
  expect(after.players[owner].deck).toEqual(before.players[owner].deck)
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].discardPile).toHaveLength(2)
})

it('095 zero target still pays; decline keeps hand; the other-color hand card may pay', () => {
  const before = createBs12BlueberryDemoState('flip')
  const zero = finish(activate(before, []))
  expect(zero.players[owner].deck).toEqual(before.players[owner].deck)
  expect(zero.players[owner].hand).toEqual([])
  const skip = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: owner, activate: false }))
  expect(skip.players[owner].hand).toEqual(before.players[owner].hand)
  expect(skip.players[owner].discardPile.map(c => c.instanceId)).toEqual([source])
  const two = createBs12BlueberryDemoState('flip-two-hand')
  const paid = finish(activate(two, [bearer], ['bs12-095-other-hand']))
  expect(paid.players[owner].hand.map(c => c.instanceId)).toEqual(['bs12-095-hand-cost'])
})

it('095 rejects missing/repeated hand costs, overselected or nonself targets without any payment', () => {
  const before = createBs12BlueberryDemoState('flip'), snapshot = structuredClone(before)
  for (const ids of [[], ['unknown'], ['bs12-095-hand-cost', 'bs12-095-hand-cost']]) expect(() => activate(before, [bearer], ids)).toThrow()
  for (const targets of [[bearer, other], [bearer, bearer], ['bs12-095-opponent'], ['bs12-095-enemy-payment'], ['missing']]) expect(() => activate(before, targets)).toThrow()
  expect(before).toEqual(snapshot)
  const noHand = createBs12BlueberryDemoState('flip-no-hand')
  expect(() => activate(noHand, [bearer], [])).toThrow()
})

it('095 last HP is rescued before faint; decline or paid zero sends only the bearer to Break', () => {
  const before = createBs12BlueberryDemoState('flip-last-hp')
  expect(before.players[owner].battleArea[0].hpCards).toEqual([])
  const rescued = finish(activate(before, [bearer]))
  expect(rescued.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
  expect(rescued.players[owner].breakArea).toEqual([])
  for (const after of [finish(activate(before, [])), finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: owner, activate: false }))]) {
    expect(after.players[owner].battleArea.map(c => c.card.instanceId)).toEqual([other])
    expect(after.players[owner].breakArea.map(c => c.instanceId)).toEqual([bearer])
    expect(after.pendingReplacement).toEqual({ tasks: [{ playerId: owner, remaining: 1 }] })
    expect(applyGameCommand(after, { kind: 'skip-replacement', playerId: owner }).pendingReplacement).toBeNull()
  }
})

it.each(['flip-refresh', 'special-refresh'] as const)('095 retains gained/deployed HP while Refresh moves its actual cost Cookie to Break: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario)
  const waiting = scenario === 'flip-refresh' ? activate(before, [bearer]) : deploy(before, [cost])
  expect(waiting.pendingRefresh?.playerId).toBe(owner)
  const chosen = scenario === 'flip-refresh' ? 'bs12-095-refresh-cookie' : cost
  const after = finish(applyGameCommand(waiting, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: chosen, shuffleSeed: 3 }))
  expect(after.players[owner].battleArea.map(c => c.hpCards.length)).toEqual(scenario === 'flip-refresh' ? [2, 4] : [1])
  expect(after.players[owner].deck).toHaveLength(scenario === 'flip-refresh' ? 3 : 1)
  expect(after.players[owner].discardPile).toEqual([])
  expect(after.players[owner].breakArea.map(c => [c.instanceId, c.level])).toEqual([[chosen, scenario === 'flip-refresh' ? 2 : 1]])
  expect(hasPendingCardResolution(after)).toBe(false)
})

it.each(['flip-refresh-defeat', 'special-refresh-defeat'] as const)('095 Refresh LV10 ends the game without applying another payment: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario)
  const waiting = scenario === 'flip-refresh-defeat' ? activate(before, [bearer]) : deploy(before, [cost])
  const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: scenario === 'flip-refresh-defeat' ? 'bs12-095-refresh-cookie' : cost, shuffleSeed: 3 })
  expect(after.status).toBe('finished')
  expect(after.result).toEqual({ winnerId: 'player-two', loserId: owner, reason: 'break-level-limit' })
})

it('095 local route permits only declared scenarios and localhost', () => {
  expect(parseTestStateConfig('?test-state=bs12-095:special', 'localhost')).toEqual({ kind: 'bs12-095', scenario: 'special' })
  expect(parseTestStateConfig('?test-state=bs12-095:invalid', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-095:special', 'example.com')).toBeNull()
})

it.each(BS12_BLUEBERRY_SCENARIOS)('095 fixture uses unique actual instances, no fifth copy and at most two battle Cookies: %s', scenario => {
  const before = createBs12BlueberryDemoState(scenario), all: string[] = []
  for (const player of Object.values(before.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
    if (before.pendingBattle?.defenderPlayerId === player.id && before.pendingBattle.revealedHpCard) cards.push(before.pendingBattle.revealedHpCard)
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(n => n <= 4)).toBe(true)
    all.push(...cards.map(c => c.instanceId))
  }
  expect(new Set(all).size).toBe(all.length)
})
