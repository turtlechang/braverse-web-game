import { expect, it } from 'vitest'
import { BS12_CRIMSON_SCENARIOS, createBs12CrimsonDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canSpecialPlayCookie } from './actions'
import { hasActivatableFlipEffect } from './battle'
import { hasPendingCardResolution } from './pending'

const owner = 'player-one' as const, source = 'bs12-096-source', cost = 'bs12-095-cost'
type State = ReturnType<typeof createBs12CrimsonDemoState>
const deploy = (state: State, ids?: string[]) => applyGameCommand(state, { kind: 'deploy-cookie', playerId: owner, instanceId: source, ...(ids ? { specialPlayCookieInstanceIds: ids } : {}) })
const activate = (state: State) => applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true, discardHandIds: [] })
const draw = (state: State, drawCount: number) => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })
const activatable = (state: State) => hasActivatableFlipEffect(state, (state.pendingBattle?.revealedHpCard ?? state.players[owner].discardPile.find(card => card.instanceId === source))!.flip!, {
  sourcePlayerId: owner, sourceInstanceId: source, sourceCardName: 'Crimson Danger Cake Hound',
}, 'bs12-096-bearer')
const finish = (input: State) => {
  let state = input
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}
const attack = (state: State) => applyGameCommand(state, { kind: 'declare-attack', playerId: owner, attackerInstanceId: source, targetInstanceId: 'bs12-095-opponent', supportPaymentIds: ['bs12-095-payment-0', 'bs12-095-payment-1'] })

it.each(['special', 'special-non-arena', 'special-rested', 'special-full', 'special-two-candidates'] as const)('096 pays actual black LV1 body plus HP without faint, then enters with one HP: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), snapshot = structuredClone(before), paid = before.players[owner].battleArea[0]
  expect(canSpecialPlayCookie(before, owner, source)).toBe(true)
  const after = deploy(before, [cost])
  expect(after.players[owner].discardPile).toEqual([paid.card, ...paid.hpCards])
  expect(after.players[owner].battleArea.at(-1)?.card.id).toBe('BS12-096')
  expect(after.players[owner].battleArea.at(-1)?.hpCards).toEqual(before.players[owner].deck.slice(0, 1))
  expect(after.players[owner].deck).toEqual(before.players[owner].deck.slice(1))
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].breakArea).toEqual([])
  expect(after.players[owner].supportArea).toEqual(before.players[owner].supportArea)
  expect(after.pendingOnPlay).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(after.pendingReplacement).toEqual({ tasks: [{ playerId: owner, remaining: 1 }] })
  expect(applyGameCommand(after, { kind: 'skip-replacement', playerId: owner }).pendingReplacement).toBeNull()
  expect(before).toEqual(snapshot)
})

it('096 normal entry leaves the optional Special Play cost and only adds its printed one HP', () => {
  const before = createBs12CrimsonDemoState('deploy'), after = deploy(before)
  expect(after.players[owner].battleArea[0]).toEqual(before.players[owner].battleArea[0])
  expect(after.players[owner].battleArea[1].hpCards).toEqual(before.players[owner].deck.slice(0, 1))
  expect(after.players[owner].discardPile).toEqual([])
  expect(after.cookiesPlayedViaSpecialPlayThisTurn?.[owner]).toBeUndefined()
})

it.each(['special-wrong-color', 'special-wrong-level', 'special-wrong-zone', 'special-no-cost', 'special-opponent-only', 'special-other-turn', 'special-outside-main'] as const)('096 blocks invalid Special Play before paying any card: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), snapshot = structuredClone(before)
  expect(canSpecialPlayCookie(before, owner, source)).toBe(false)
  expect(() => deploy(before, [cost])).toThrow()
  expect(before).toEqual(snapshot)
})

it('096 requires exactly one distinct battle cost, including another eligible black Cookie', () => {
  const before = createBs12CrimsonDemoState('special-two-candidates'), snapshot = structuredClone(before)
  for (const ids of [[], [cost, cost], [cost, 'bs12-095-other-cost'], [source], ['missing']]) expect(() => deploy(before, ids)).toThrow()
  const after = deploy(before, ['bs12-095-other-cost'])
  expect(after.players[owner].battleArea[0]).toEqual(before.players[owner].battleArea[0])
  expect(before).toEqual(snapshot)
})

it('096 accepts printed LV2 Licorice after its real Activate lowers effective level to one', () => {
  const before = createBs12CrimsonDemoState('special-licorice')
  expect(canSpecialPlayCookie(before, owner, source)).toBe(false)
  const ready = applyGameCommand(before, { kind: 'activate-skill', playerId: owner, sourceInstanceId: cost, trigger: 'activate', paymentIds: [], effectTargets: [[cost]] })
  expect(ready.players[owner].battleArea[0]).toMatchObject({ card: { level: 2 }, levelOverride: 1 })
  const after = deploy(ready, [cost])
  expect(after.players[owner].discardPile).toEqual([ready.players[owner].battleArea[0].card, ...ready.players[owner].battleArea[0].hpCards])
  expect(after.players[owner].battleArea[0].hpCards).toHaveLength(1)
})

it.each(['special-refresh', 'special-refresh-defeat'] as const)('096 entry preserves payment through Refresh or terminal LV10: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), paid = deploy(before, [cost])
  expect(paid.pendingRefresh).toBeTruthy()
  const after = applyGameCommand(paid, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost, shuffleSeed: 3 })
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].battleArea.at(-1)?.hpCards).toHaveLength(1)
  expect(after.result?.winnerId).toBe(scenario === 'special-refresh-defeat' ? 'player-two' : undefined)
})

it.each(['attack', 'attack-spare-energy', 'attack-faint'] as const)('096 pays KK and resolves ordinary two without Then: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), after = finish(applyGameCommand(attack(before), { kind: 'skip-trap', playerId: 'player-two' }))
  expect(after.players[owner].supportArea.map(s => s.rested)).toEqual(scenario === 'attack-spare-energy' ? [true, true, false] : [true, true])
  expect(after.players[owner].battleArea[0].rested).toBe(true)
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual(scenario === 'attack-faint' ? [] : [3])
  expect(after.players['player-two'].discardPile).toHaveLength(2)
  expect(after.players['player-two'].breakArea).toHaveLength(scenario === 'attack-faint' ? 1 : 0)
  expect(hasPendingCardResolution(after)).toBe(false)
})

it.each(['attack-wrong-energy', 'attack-few-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main'] as const)('096 refuses illegal attack payment or timing atomically: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), snapshot = structuredClone(before)
  expect(() => attack(before)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each(['flip', 'flip-hand-one', 'flip-hand-four', 'flip-hand-five', 'flip-rested', 'flip-level-three', 'flip-both-black', 'flip-opponent-hand-six'] as const)('096 free FLIP draws two for own hand <=5 and at least one same black Arena battle Cookie: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), snapshot = structuredClone(before)
  expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-096')
  expect(activatable(before)).toBe(true)
  const waiting = activate(before)
  expect(waiting.players[owner].hand).toEqual(before.players[owner].hand)
  expect(waiting.players[owner].deck).toEqual(before.players[owner].deck)
  expect(waiting.players[owner].supportArea).toEqual(before.players[owner].supportArea)
  expect(waiting.pendingDrawUpTo).toBeTruthy()
  const after = finish(draw(waiting, 2))
  expect(after.players[owner].hand).toEqual([...before.players[owner].hand, ...before.players[owner].deck.slice(0, 2)])
  expect(after.players[owner].deck).toEqual(before.players[owner].deck.slice(2))
  if(scenario==='flip-both-black'){
    expect(after.players[owner].battleArea).toEqual(before.players[owner].battleArea.slice(1))
    expect(after.players[owner].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[owner].breakArea).toEqual([before.players[owner].battleArea[0].card])
    expect(after.pendingReplacement).toEqual({tasks:[{playerId:owner,remaining:1}]})
  }else expect(after.players[owner].battleArea).toEqual(before.players[owner].battleArea)
  expect(after.players[owner].discardPile.map(c => c.instanceId)).toEqual([source])
  expect(after.pendingBattle).toBeNull()
  expect(before).toEqual(snapshot)
})

it.each(['flip-hand-six', 'flip-hand-seven', 'flip-no-black', 'flip-black-non-arena', 'flip-split', 'flip-support-only', 'flip-hand-only', 'flip-trash-only', 'flip-break-only', 'flip-opponent-only'] as const)('096 conditions prevent drawing without paying or borrowing another zone: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), snapshot = structuredClone(before)
  expect(activatable(before)).toBe(false)
  expect(() => draw(before, 2)).toThrow()
  // Real damage already discarded the inactive FLIP and finished the battle.
  expect(() => activate(before)).toThrow()
  expect(before.pendingBattle).toBeNull()
  expect(before.pendingDrawUpTo).toBeUndefined()
  expect(before.players[owner].deck).toHaveLength(12)
  expect(before.players[owner].battleArea.map(cookie => cookie.hpCards.length)).toEqual(scenario==='flip-black-non-arena'?[1]:scenario==='flip-split'?[2]:['flip-no-black','flip-support-only','flip-hand-only','flip-trash-only','flip-break-only','flip-opponent-only'].includes(scenario)?[1,2]:[1,1])
  expect(before.players[owner].discardPile.at(-1)?.instanceId).toBe(source)
  expect(before).toEqual(snapshot)
})

it.each([0, 1, 2])('096 draw choice %s is exact and never a post-draw hand cap', count => {
  const before = createBs12CrimsonDemoState('flip-hand-five'), after = finish(draw(activate(before), count))
  expect(after.players[owner].hand).toHaveLength(5 + count)
  expect(after.players[owner].hand).toEqual([...before.players[owner].hand, ...before.players[owner].deck.slice(0, count)])
  expect(after.players[owner].deck).toHaveLength(12 - count)
})

it('096 rejects out-of-range draw counts atomically and allows declining the free FLIP', () => {
  const before = createBs12CrimsonDemoState('flip'), waiting = activate(before), snapshot = structuredClone(waiting)
  for (const count of [-1, 3, 1.5]) expect(() => draw(waiting, count)).toThrow()
  expect(waiting).toEqual(snapshot)
  const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: owner, activate: false }))
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].deck).toHaveLength(12)
  expect(after.players[owner].discardPile.map(c => c.instanceId)).toEqual([source])
})

it('096 counts a zero-HP black Arena bearer, draws first, then faints and deploys the drawn Cookie as replacement', () => {
  const before = createBs12CrimsonDemoState('flip-last-hp')
  expect(before.players[owner].battleArea[0]).toMatchObject({ hpCards: [], card: { energyColor: 'black', keywords: ['arena'] } })
  expect(before.players[owner].battleArea[1].card.energyColor).toBe('red')
  expect(activatable(before)).toBe(true)
  const waiting = activate(before)
  expect(waiting.players[owner].breakArea).toEqual([])
  const drawn = finish(draw(waiting, 2))
  expect(drawn.players[owner].hand).toEqual(before.players[owner].deck.slice(0, 2))
  expect(drawn.players[owner].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-096-companion'])
  expect(drawn.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-096-bearer'])
  expect(drawn.pendingReplacement).toEqual({ tasks: [{ playerId: owner, remaining: 1 }] })
  const after = applyGameCommand(drawn, { kind: 'replace-cookie', playerId: owner, instanceId: 'bs12-096-drawn-cookie' })
  expect(after.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
  expect(after.players[owner].hand).toHaveLength(1)
  expect(after.players[owner].deck).toHaveLength(8)
  expect(after.pendingReplacement).toBeNull()
})

it('096 last HP hand-five draw reaches seven before faint without reevaluating the hand condition', () => {
  const before = createBs12CrimsonDemoState('flip-last-hp-five'), after = finish(draw(activate(before), 2))
  expect(after.players[owner].hand).toHaveLength(7)
  expect(after.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-096-bearer'])
  expect(applyGameCommand(after, { kind: 'skip-replacement', playerId: owner }).players[owner].hand).toHaveLength(7)
})

it.each(['flip-short-deck', 'flip-exact-deck'] as const)('096 accepts full two-card choice and resumes through natural Refresh: %s', scenario => {
  const before = createBs12CrimsonDemoState(scenario), waiting = draw(activate(before), 2)
  expect(waiting.pendingRefresh).toBeTruthy()
  expect(waiting.players[owner].hand).toEqual(before.players[owner].deck)
  expect(waiting.players[owner].battleArea).toEqual(before.players[owner].battleArea)
  const after = finish(applyGameCommand(waiting, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: 'bs12-096-refresh-cookie', shuffleSeed: 3 }))
  expect(after.players[owner].hand).toHaveLength(2)
  expect(after.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-096-refresh-cookie'])
  expect(after.players[owner].deck).toHaveLength(scenario === 'flip-short-deck' ? 1 : 2)
  expect(after.players[owner].discardPile).toEqual([])
  expect(after.pendingBattle).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
})

it('096 Refresh LV10 stops the remaining draw and retains the first drawn card', () => {
  const before = createBs12CrimsonDemoState('flip-refresh-defeat'), waiting = draw(activate(before), 2)
  expect(waiting.players[owner].hand).toHaveLength(1)
  const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: 'bs12-096-refresh-cookie', shuffleSeed: 3 })
  expect(after.status).toBe('finished')
  expect(after.result).toMatchObject({ winnerId: 'player-two', loserId: owner, reason: 'break-level-limit' })
  expect(after.players[owner].hand).toEqual(waiting.players[owner].hand)
})

it('096 Browser starts before the actual HP damage command for both a valid and a naturally skipped FLIP', () => {
  for (const scenario of ['flip-hand-five', 'flip-hand-six'] as const) {
    const before = createBs12CrimsonDemoState(scenario, true), snapshot = structuredClone(before)
    expect(before.pendingBattle?.stage).toBe('damage')
    expect(before.players[owner].battleArea[0].hpCards).toHaveLength(2)
    expect(before.players[owner].discardPile).toEqual([])
    const after = applyGameCommand(before, { kind: 'resolve-next-damage', playerId: owner })
    expect(after).toEqual(createBs12CrimsonDemoState(scenario))
    expect(before).toEqual(snapshot)
  }
})

it('096 finite localhost routes preserve actual cards, unique instances, battlefield capacity and copy limits', () => {
  for (const scenario of BS12_CRIMSON_SCENARIOS) {
    expect(parseTestStateConfig(`?test-state=bs12-096:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-096', scenario })
    const state = createBs12CrimsonDemoState(scenario)
    for (const id of ['player-one', 'player-two'] as const) {
      const player = state.players[id]
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...(player.extraDeck ?? []),
        ...player.supportArea.map(c => c.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards]),
        ...(id === owner && state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : [])]
      expect(new Set(cards.map(c => c.instanceId)).size).toBe(cards.length)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(n => n <= 4), scenario).toBe(true)
    }
  }
  expect(parseTestStateConfig('?test-state=bs12-096:unknown', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-096:flip', 'braverse.example')).toBeNull()
})
