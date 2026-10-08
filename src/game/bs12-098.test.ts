import { expect, it } from 'vitest'
import { BS12_CARAMEL_PUDDING_SCENARIOS, createBs12CaramelPuddingDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canSpecialPlayCookie } from './actions'
import { hasActivatableFlipEffect } from './battle'
import { hasPendingCardResolution } from './pending'

const owner = 'player-one' as const, source = 'bs12-098-source', cost = 'bs12-095-cost'
type State = ReturnType<typeof createBs12CaramelPuddingDemoState>
const deploy = (state: State, ids?: string[]) => applyGameCommand(state, { kind: 'deploy-cookie', playerId: owner, instanceId: source, ...(ids ? { specialPlayCookieInstanceIds: ids } : {}) })
const activate = (state: State) => applyGameCommand(state, { kind: 'resolve-flip', playerId: owner, activate: true, discardHandIds: [] })
const activatable = (state: State) => hasActivatableFlipEffect(state, (state.pendingBattle?.revealedHpCard ?? state.players[owner].discardPile.find(card => card.instanceId === source))!.flip!, {
  sourcePlayerId: owner, sourceInstanceId: source, sourceCardName: 'Caramel Pudding Cake Hound',
}, 'bs12-098-bearer')
const finish = (input: State) => {
  let state = input
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}
const attack = (state: State) => applyGameCommand(state, { kind: 'declare-attack', playerId: owner, attackerInstanceId: source, targetInstanceId: 'bs12-095-opponent', supportPaymentIds: ['bs12-095-payment-0', 'bs12-095-payment-1'] })

it.each(['special', 'special-non-arena', 'special-rested', 'special-full', 'special-two-candidates'] as const)('098 pays actual black LV1 body plus HP without faint, then enters with one HP: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), snapshot = structuredClone(before), paid = before.players[owner].battleArea[0]
  expect(canSpecialPlayCookie(before, owner, source)).toBe(true)
  const after = deploy(before, [cost])
  expect(after.players[owner].discardPile).toEqual([paid.card, ...paid.hpCards])
  expect(after.players[owner].battleArea.at(-1)?.card.id).toBe('BS12-098')
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

it('098 normal entry leaves the optional Special Play cost and only adds its printed one HP', () => {
  const before = createBs12CaramelPuddingDemoState('deploy'), after = deploy(before)
  expect(after.players[owner].battleArea[0]).toEqual(before.players[owner].battleArea[0])
  expect(after.players[owner].battleArea[1].hpCards).toEqual(before.players[owner].deck.slice(0, 1))
  expect(after.players[owner].discardPile).toEqual([])
  expect(after.cookiesPlayedViaSpecialPlayThisTurn?.[owner]).toBeUndefined()
})

it.each(['special-wrong-color', 'special-wrong-level', 'special-wrong-zone', 'special-no-cost', 'special-opponent-only', 'special-other-turn', 'special-outside-main'] as const)('098 blocks invalid Special Play before paying any card: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), snapshot = structuredClone(before)
  expect(canSpecialPlayCookie(before, owner, source)).toBe(false)
  expect(() => deploy(before, [cost])).toThrow()
  expect(before).toEqual(snapshot)
})

it('098 requires exactly one distinct battle cost, including another eligible black Cookie', () => {
  const before = createBs12CaramelPuddingDemoState('special-two-candidates'), snapshot = structuredClone(before)
  for (const ids of [[], [cost, cost], [cost, 'bs12-095-other-cost'], [source], ['missing']]) expect(() => deploy(before, ids)).toThrow()
  const after = deploy(before, ['bs12-095-other-cost'])
  expect(after.players[owner].battleArea[0]).toEqual(before.players[owner].battleArea[0])
  expect(before).toEqual(snapshot)
})

it('098 accepts printed LV2 Licorice after its real Activate lowers effective level to one', () => {
  const before = createBs12CaramelPuddingDemoState('special-licorice')
  expect(canSpecialPlayCookie(before, owner, source)).toBe(false)
  const ready = applyGameCommand(before, { kind: 'activate-skill', playerId: owner, sourceInstanceId: cost, trigger: 'activate', paymentIds: [], effectTargets: [[cost]] })
  expect(ready.players[owner].battleArea[0]).toMatchObject({ card: { level: 2 }, levelOverride: 1 })
  const after = deploy(ready, [cost])
  expect(after.players[owner].discardPile).toEqual([ready.players[owner].battleArea[0].card, ...ready.players[owner].battleArea[0].hpCards])
  expect(after.players[owner].battleArea[0].hpCards).toHaveLength(1)
})

it.each(['special-refresh', 'special-refresh-defeat'] as const)('098 entry preserves payment through Refresh or terminal LV10: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), paid = deploy(before, [cost])
  expect(paid.pendingRefresh).toBeTruthy()
  const after = applyGameCommand(paid, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost, shuffleSeed: 3 })
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].battleArea.at(-1)?.hpCards).toHaveLength(1)
  expect(after.result?.winnerId).toBe(scenario === 'special-refresh-defeat' ? 'player-two' : undefined)
})

it.each(['attack', 'attack-spare-energy', 'attack-faint'] as const)('098 pays KK and resolves ordinary two without Then: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), after = finish(applyGameCommand(attack(before), { kind: 'skip-trap', playerId: 'player-two' }))
  expect(after.players[owner].supportArea.map(s => s.rested)).toEqual(scenario === 'attack-spare-energy' ? [true, true, false] : [true, true])
  expect(after.players[owner].battleArea[0].rested).toBe(true)
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual(scenario === 'attack-faint' ? [] : [3])
  expect(after.players['player-two'].discardPile).toHaveLength(2)
  expect(after.players['player-two'].breakArea).toHaveLength(scenario === 'attack-faint' ? 1 : 0)
  expect(hasPendingCardResolution(after)).toBe(false)
})

it.each(['attack-wrong-energy', 'attack-few-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main'] as const)('098 refuses illegal attack payment or timing atomically: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), snapshot = structuredClone(before)
  expect(() => attack(before)).toThrow()
  expect(before).toEqual(snapshot)
})


it.each(['flip', 'flip-level-three', 'flip-black-bearer', 'flip-non-arena-bearer', 'flip-rested', 'flip-level-three-condition'] as const)('098 free FLIP restores only its original LV2-or-higher HP bearer: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), snapshot = structuredClone(before), after = finish(activate(before))
  expect(activatable(before)).toBe(true)
  expect(after.players[owner].battleArea[0].hpCards).toEqual([...before.players[owner].battleArea[0].hpCards, before.players[owner].deck[0]])
  expect(after.players[owner].battleArea[1]).toEqual(before.players[owner].battleArea[1])
  expect(after.players[owner].deck).toEqual(before.players[owner].deck.slice(1))
  expect(after.players[owner].hand).toEqual(before.players[owner].hand)
  expect(after.players[owner].supportArea).toEqual(before.players[owner].supportArea)
  expect(after.players[owner].discardPile.map(c => c.instanceId)).toEqual([source])
  expect(after.players[owner].breakArea).toEqual([])
  expect(after.pendingBattle).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(before).toEqual(snapshot)
})

it.each(['flip-lv-one', 'flip-no-black', 'flip-black-non-arena', 'flip-split', 'flip-support-only', 'flip-hand-only', 'flip-trash-only', 'flip-break-only', 'flip-opponent-only'] as const)('098 cannot borrow another bearer, Cookie or zone to qualify its FLIP: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), snapshot = structuredClone(before)
  expect(activatable(before)).toBe(false)
  expect(() => activate(before)).toThrow()
  expect(before.pendingBattle).toBeNull()
  expect(before.players[owner].deck).toHaveLength(12)
  expect(before.players[owner].battleArea.map(c => c.hpCards.length)).toEqual(scenario==='flip-lv-one'?[1,4]:scenario==='flip-black-non-arena'?[3,1]:scenario==='flip-split'?[3,3]:[2,2])
  expect(before.players[owner].discardPile.at(-1)?.instanceId).toBe(source)
  expect(before).toEqual(snapshot)
})

it('098 checks effective LV1 reached by actual Licorice Activate after completing the preceding battle',()=>{
  const before=createBs12CaramelPuddingDemoState('flip-non-arena-bearer')
  expect(before.players[owner].battleArea[0].card).toMatchObject({id:'BS11-092',level:2,hp:4})
  expect(activatable(before)).toBe(true)
  let completed=finish(activate(before))
  for(let i=0;i<10&&(completed.activePlayerId!==owner||completed.phase!=='main');i++)completed=applyGameCommand(completed,{kind:'advance-phase',playerId:completed.activePlayerId})
  expect(completed.activePlayerId).toBe(owner);expect(completed.phase).toBe('main')
  expect(activatable(completed)).toBe(true)
  const lowered=applyGameCommand(completed,{kind:'activate-skill',playerId:owner,sourceInstanceId:'bs12-098-bearer',trigger:'activate',paymentIds:[],effectTargets:[['bs12-098-bearer']]})
  expect(lowered.players[owner].battleArea[0]).toMatchObject({card:{id:'BS11-092',level:2,hp:4},levelOverride:1})
  expect(lowered.commandLog?.at(-1)?.commandKind).toBe('activate-skill')
  expect(activatable(lowered)).toBe(false)
})

it('098 never redirects a fixed-bearer gain through supplied target IDs', () => {
  const before = createBs12CaramelPuddingDemoState('flip-level-three')
  for (const targetIds of [['bs12-098-companion'], ['bs12-098-opponent'], ['unknown']]) {
    const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: owner, activate: true, targetIds, discardHandIds: [] }))
    expect(after.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([4, 2])
    expect(after.players[owner].battleArea[1]).toEqual(before.players[owner].battleArea[1])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  }
})

it('098 allows declining a free eligible FLIP without gaining HP or spending hand or energy', () => {
  const before = createBs12CaramelPuddingDemoState('flip'), after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: owner, activate: false }))
  expect(after.players[owner].battleArea).toEqual(before.players[owner].battleArea)
  expect(after.players[owner].deck).toEqual(before.players[owner].deck)
  expect(after.players[owner].hand).toEqual([])
  expect(after.players[owner].discardPile.map(c => c.instanceId)).toEqual([source])
})

it.each(['flip-last-hp', 'flip-last-hp-self'] as const)('098 rescues the original zero-HP LV2+ bearer, including a self-qualifying black Arena: %s', scenario => {
  const before = createBs12CaramelPuddingDemoState(scenario), after = finish(activate(before))
  expect(before.players[owner].battleArea[0].hpCards).toEqual([])
  expect(after.players[owner].battleArea[0].hpCards).toEqual([before.players[owner].deck[0]])
  expect(after.players[owner].battleArea[1]).toEqual(before.players[owner].battleArea[1])
  expect(after.players[owner].breakArea).toEqual([])
  expect(after.pendingReplacement).toBeNull()
})

it('098 LV1 last-HP bearer faints instead of healing a different qualifying LV3 Cookie', () => {
  const after = createBs12CaramelPuddingDemoState('flip-last-hp-lv-one')
  expect(after.players[owner].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-098-companion'])
  expect(after.players[owner].battleArea[0].hpCards).toHaveLength(4)
  expect(after.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-098-bearer'])
  expect(after.players[owner].deck).toHaveLength(12)
  expect(after.pendingBattle).toBeNull()
  expect(() => activate(after)).toThrow()
})

it('098 declined last-HP rescue still faints the original Cookie normally', () => {
  const before = createBs12CaramelPuddingDemoState('flip-last-hp'), after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: owner, activate: false }))
  expect(after.players[owner].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-098-companion'])
  expect(after.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-098-bearer'])
  expect(after.players[owner].deck).toHaveLength(12)
})

it('098 one-card HP gain resumes Refresh without adding another HP', () => {
  const before = createBs12CaramelPuddingDemoState('flip-refresh'), waiting = activate(before)
  expect(waiting.pendingRefresh).toBeTruthy()
  expect(waiting.players[owner].battleArea[0].hpCards).toEqual([...before.players[owner].battleArea[0].hpCards, before.players[owner].deck[0]])
  expect(waiting.players[owner].deck).toEqual([])
  const after = finish(applyGameCommand(waiting, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: 'bs12-098-refresh-cookie', shuffleSeed: 3 }))
  expect(after.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([3, 2])
  expect(after.players[owner].deck).toHaveLength(2)
  expect(after.players[owner].discardPile).toEqual([])
  expect(after.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-098-refresh-cookie'])
  expect(hasPendingCardResolution(after)).toBe(false)
})

it('098 Refresh LV10 interrupts after the actual one HP gain', () => {
  const before = createBs12CaramelPuddingDemoState('flip-refresh-defeat'), waiting = activate(before)
  const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: 'bs12-098-refresh-cookie', shuffleSeed: 3 })
  expect(after.status).toBe('finished')
  expect(after.result).toMatchObject({ winnerId: 'player-two', loserId: owner, reason: 'break-level-limit' })
  expect(after.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([3, 2])
})

it('098 Browser damage starts from actual attached HP for eligible and naturally skipped FLIP', () => {
  for (const scenario of ['flip', 'flip-lv-one', 'flip-last-hp-lv-one'] as const) {
    const before = createBs12CaramelPuddingDemoState(scenario, true), snapshot = structuredClone(before)
    expect(before.pendingBattle?.stage).toBe('damage')
    expect(before.players[owner].battleArea[0].hpCards[scenario==='flip-last-hp-lv-one'?0:before.players[owner].battleArea[0].hpCards.length-1]?.id).toBe('BS12-098')
    expect(before.players[owner].battleArea[0].hpCards).toHaveLength(scenario==='flip'?3:2)
    let resolved=before
    for(let i=0;i<(scenario==='flip-last-hp-lv-one'?2:1);i++)resolved=applyGameCommand(resolved,{kind:'resolve-next-damage',playerId:owner})
    expect(resolved.commandLog?.filter(e=>e.commandKind==='resolve-next-damage')).toHaveLength(scenario==='flip-last-hp-lv-one'?2:1)
    expect(resolved).toEqual(createBs12CaramelPuddingDemoState(scenario))
    expect(before).toEqual(snapshot)
  }
})

it('098 finite localhost fixtures preserve battlefield capacity, unique instances and copy limits', () => {
  for (const scenario of BS12_CARAMEL_PUDDING_SCENARIOS) {
    expect(parseTestStateConfig('?test-state=bs12-098:' + scenario, 'localhost')).toEqual({ kind: 'bs12-098', scenario })
    const state = createBs12CaramelPuddingDemoState(scenario)
    for (const id of ['player-one', 'player-two'] as const) {
      const p = state.players[id]
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      const cards = [...p.hand, ...p.deck, ...p.discardPile, ...p.breakArea, ...(p.extraDeck ?? []), ...p.supportArea.map(c => c.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards]), ...(id === owner && state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : [])]
      expect(new Set(cards.map(c => c.instanceId)).size).toBe(cards.length)
      const counts = new Map<string, number>()
      for (const c of cards) counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
      expect([...counts.values()].every(n => n <= 4), scenario).toBe(true)
    }
  }
  expect(parseTestStateConfig('?test-state=bs12-098:unknown', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-098:flip', 'braverse.example')).toBeNull()
})
