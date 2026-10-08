import { expect, it } from 'vitest'
import { createBs12MilkyWayDemoState, createBs12CaramelArrowDemoState, parseTestStateConfig, BS12_CARAMEL_ARROW_SCENARIOS } from './demo'
import type { Bs12CaramelArrowScenario } from './demo'
import { getFaintTriggeredCost } from './skills'
import { getTrashToHandCandidates, executeCardEffect } from './effects'
import { applyGameCommand } from './commands'
import { getFaintEffectCardCandidates, getFaintEffectMinMax, getFaintSourceCostUnavailableReason, getBlockerCandidates } from './battle'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import { isOnlineGameCommand } from '../net/onlineProtocol'
import { getRefreshCandidates } from './refresh'
import type { GameState } from './types'

const faintedArrow = () => {
  const base=createBs12CaramelArrowDemoState('BS12-091','direct-attack')
  const player=base.players['player-one'],source=player.battleArea[0].card
  const state={...base,players:{...base.players,'player-one':{...player,deck:[{...player.deck[0],instanceId:'091-milled-blocker'},player.deck[1],{...source,instanceId:'091-milled-same-name'},...player.deck.slice(3)]}}}
  let next=applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
  for(let hit=0;next.pendingBattle?.stage==='damage'&&hit<2;hit++)next=applyGameCommand(next,{kind:'resolve-next-damage',playerId:'player-one'})
  return next
}

it('091 shows a separate cost phase with no recovery target before paying', () => {
  const state = faintedArrow()
  expect(state.pendingFaintEffects?.[0].cost).toEqual({ deckToTrash: { amount: 3 } })
  expect(getFaintEffectCardCandidates(state)).toEqual([])
  expect(getFaintEffectMinMax(state, state.pendingFaintEffects![0].effect)).toEqual({ min: 0, max: 0 })
})

it('091 pays three actual top cards once, then offers the newly milled Blocker and excludes same name', () => {
  const before = faintedArrow()
  const command = { kind: 'resolve-faint-effect' as const, playerId: 'player-one' as const, targetIds: [], payDeckToTrash: true }
  const paid = applyGameCommand(before, command)
  expect(paid.players['player-one'].deck).toHaveLength(9)
  expect(paid.players['player-one'].discardPile).toEqual([...before.players['player-one'].discardPile, ...before.players['player-one'].deck.slice(0, 3)])
  expect(paid.pendingFaintEffects?.[0].cost).toBeUndefined()
  expect(getFaintEffectCardCandidates(paid).map(card => card.instanceId)).toEqual(['091-milled-blocker'])
  const recovered = applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: ['091-milled-blocker'] })
  expect(recovered.players['player-one'].hand.map(card => card.instanceId)).toContain('091-milled-blocker')
  expect(recovered.players['player-one'].deck).toEqual(paid.players['player-one'].deck)
})

it('091 retains the independent printed top-three faint cost instead of inheriting Blocker cost', () => {
  const source=createBs12CaramelArrowDemoState('BS12-091','attack').players['player-one'].battleArea[0].card
  expect(getFaintTriggeredCost(source.skill!)).toEqual({deckToTrash:{amount:3}})
})

it('091 trash recovery requires Cookie-and-printed-Blocker on the same actual card', () => {
  const before = createBs12MilkyWayDemoState('BS12-090', 'response')
  const source = before.players['player-one'].battleArea[0].card
  const nonBlocker = before.players['player-one'].battleArea[1].card
  const state = { ...before, players: { ...before.players, 'player-one': { ...before.players['player-one'], discardPile: [source, nonBlocker] } } }
  const effect = { kind: 'trash-to-hand' as const, max: 1, cookieOnly: true, blockerOnly: true, excludeCardName: 'Caramel Arrow Cookie' }
  expect(getTrashToHandCandidates(state, { sourcePlayerId: 'player-one', sourceInstanceId: '091' }, effect).map(card => card.instanceId)).toEqual([source.instanceId])
})

const fainted = (scenario: Bs12CaramelArrowScenario = 'faint', number: 'BS12-091' | 'BS12-091@1' = 'BS12-091') => {
  const start = createBs12CaramelArrowDemoState(number, scenario)
  const next = ['direct-attack', 'no-hand-faint', 'last-hp-flip', 'unpayable'].includes(scenario)
    ? applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' })
    : applyGameCommand(start, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-091-source', paymentIds: [], discardHandIds: ['bs12-091-cost'] })
  let state=next
  for(let hit=0;state.pendingBattle?.stage==='damage'&&hit<2;hit++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'})
  return state
}
const pay = (state: GameState) => applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], payDeckToTrash: true })
const recover = (state: GameState, targetIds: string[] = ['bs12-091-milled-blocker']) => applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds })

it.each(['BS12-091', 'BS12-091@1'] as const)('actual %s faints after Blocker and requires a separate payment with no hand or support cost', number => {
  const before = fainted('faint', number)
  const original = structuredClone(before)
  expect(before.players['player-one'].hand).toHaveLength(0)
  expect(before.pendingFaintEffects?.[0].cost).toEqual({ deckToTrash: { amount: 3 } })
  const paid = pay(before)
  const after = recover(paid)
  expect(after.players['player-one'].hand.map(card => card.instanceId)).toEqual(['bs12-091-milled-blocker'])
  expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(3))
  expect(after.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(before).toEqual(original)
})

it('existing legal trash targets are withheld before payment and included after milling', () => {
  const before = fainted('old-target')
  expect(getFaintEffectCardCandidates(before)).toEqual([])
  const paid = pay(before)
  expect(getFaintEffectCardCandidates(paid).map(card => card.instanceId)).toEqual(['bs12-091-old-blocker', 'bs12-091-milled-blocker'])
  expect(recover(paid, ['bs12-091-old-blocker']).players['player-one'].hand.map(card => card.instanceId)).toContain('bs12-091-old-blocker')
})
it.each(['direct-attack', 'no-hand-faint', 'other-color', 'non-arena-target'] as const)('recovers an actual other-name Blocker without adding color, Arena, level or Blocker-payment restrictions: %s', scenario => {
  const before = fainted(scenario)
  const paid = pay(before)
  expect(getFaintEffectCardCandidates(paid).map(card => card.instanceId)).toEqual(['bs12-091-milled-blocker'])
  expect(recover(paid).players['player-one'].hand.map(card => card.instanceId)).toContain('bs12-091-milled-blocker')
})
it.each(['zero-target', 'same-name-only', 'no-blocker-target'] as const)('zero legal recovery still mills exactly three, then settles a zero choice: %s', scenario => {
  const before = fainted(scenario)
  const paid = pay(before)
  expect(paid.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(3))
  expect(getFaintEffectCardCandidates(paid)).toEqual([])
  const after = recover(paid, [])
  expect(after.players['player-one'].discardPile).toEqual(paid.players['player-one'].discardPile)
  expect(after.pendingFaintEffects).toBeUndefined()
})
it('declining payment skips the trigger without milling or recovery, including existing targets', () => {
  const before = fainted('old-target')
  const after = recover(before, [])
  expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
  expect(after.players['player-one'].discardPile).toEqual(before.players['player-one'].discardPile)
  expect(after.players['player-one'].hand).toEqual(before.players['player-one'].hand)
  expect(after.pendingFaintEffects).toBeUndefined()
})
it.each(['target', 'energy', 'hand', 'support-trash', 'support-hand'] as const)('rejects preselected %s during the independent top-deck cost', field => {
  const before = fainted('old-target')
  const options = { targetIds: field === 'target' ? ['bs12-091-old-blocker'] : [],
    ...(field === 'energy' ? { paymentIds: ['bs12-091-payment-0'] } : {}),
    ...(field === 'hand' ? { discardHandIds: ['bs12-091-cost'] } : {}),
    ...(field === 'support-trash' ? { supportToTrashIds: ['bs12-091-payment-0'] } : {}),
    ...(field === 'support-hand' ? { supportToHandIds: ['bs12-091-payment-0'] } : {}),
  }
  expect(() => applyGameCommand(before, { kind: 'resolve-faint-effect', playerId: 'player-one', payDeckToTrash: true, ...options })).toThrow(/先支付牌庫頂代價/)
})
it.each([true, false])('rejects a repeated cost flag after payment: %s', payDeckToTrash => {
  const paid = pay(fainted())
  expect(() => applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], payDeckToTrash })).toThrow(/沒有待支付/)
})
it.each([['bs12-091-milled-same-name'], ['bs12-091-milled-item'], ['bs12-091-cost'], ['bs12-091-source'], ['unknown'], ['bs12-091-milled-blocker', 'bs12-091-milled-blocker']])('rejects same name, non-Cookie, non-Blocker, wrong zone, unknown or repeated recovery: %s', (...ids) => {
  expect(() => recover(pay(fainted()), ids)).toThrow()
})
it.each(['short-deck', 'empty-deck', 'exact-deck'] as const)('finishes the same three-card cost across Refresh before fresh recovery: %s', scenario => {
  const paid = pay(fainted(scenario))
  expect(paid.pendingRefresh).toBeDefined()
  expect(paid.pendingFaintEffects?.[0].cost).toBeUndefined()
  const candidate = getRefreshCandidates(paid, 'player-one')[0]
  const refreshed = applyGameCommand(paid, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: candidate.instanceId }, { shuffleSeed: 31 })
  expect(refreshed.deckTrashResolution?.cards).toHaveLength(3)
  expect(refreshed.pendingRefresh).toBeNull()
  expect(refreshed.pendingFaintEffects?.[0].cost).toBeUndefined()
  expect(() => recover(refreshed, [])).not.toThrow()
})
it('cannot pay an empty deck with no legal Refresh Cookie and skips the whole trigger', () => {
  const before = fainted('unpayable')
  expect(getFaintSourceCostUnavailableReason(before)).toMatch(/無法支付牌庫頂代價/)
  const after = recover(before, [])
  expect(after.players['player-one'].deck).toEqual([])
  expect(after.pendingFaintEffects).toBeUndefined()
})
it('Refresh defeat ends the game before recovery', () => {
  const paid = pay(fainted('refresh-defeat'))
  const after = applyGameCommand(paid, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-091-old-blocker' }, { shuffleSeed: 31 })
  expect(after.status).toBe('finished')
  expect(after.pendingFaintEffects).toBeUndefined()
})
it('last-HP FLIP rescue precedes faint, while decline queues the independent deck cost', () => {
  const before = fainted('last-hp-flip')
  const rescued = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: true, targetIds: ['bs12-091-source'], discardHandIds: ['bs12-091-cost'] })
  expect(rescued.pendingFaintEffects).toBeUndefined()
  const declined = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: false, targetIds: [] })
  expect(declined.pendingFaintEffects?.[0].cost).toEqual({ deckToTrash: { amount: 3 } })
})
it('AI pays first using public counts, then independently chooses an actual post-payment target', () => {
  const before = fainted()
  const paid = takeAiStep(before, 'player-one').state
  expect(paid.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(3))
  expect(paid.pendingFaintEffects?.[0].cost).toBeUndefined()
  const after = takeAiStep(paid, 'player-one').state
  expect(after.players['player-one'].hand.map(card => card.instanceId)).toContain('bs12-091-milled-blocker')
})
it.each(['damage', 'make-faint'] as const)('effect %s queues the same faint cost independently of Blocker', kind => {
  const before = createBs12CaramelArrowDemoState('BS12-091', 'attack')
  const after = executeCardEffect(before, { sourcePlayerId: 'player-two', sourceInstanceId: 'bs12-091-attacker' }, kind === 'damage'
    ? { kind, amount: 2, target: { side: 'opponent', min: 1, max: 1 } }
    : { kind, target: { side: 'opponent', min: 1, max: 1 } }, ['bs12-091-source'])
  expect(after.pendingFaintEffects?.[0].cost).toEqual({ deckToTrash: { amount: 3 } })
  expect(pay(after).players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(3))
})
it('the shared payment phase preserves any remaining independent cost without paying it early', () => {
  const before = fainted('direct-attack')
  const state: GameState = { ...before, pendingFaintEffects: [{ ...before.pendingFaintEffects![0], cost: { deckToTrash: { amount: 3 }, discardHand: 1 } }] }
  const paid = pay(state)
  expect(paid.pendingFaintEffects?.[0].cost).toEqual({ discardHand: 1 })
  expect(paid.players['player-one'].hand).toEqual(state.players['player-one'].hand)
  const after = applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: ['bs12-091-milled-blocker'], discardHandIds: ['bs12-091-cost'] })
  expect(after.players['player-one'].hand.map(card => card.instanceId)).toEqual(['bs12-091-milled-blocker'])
  expect(after.players['player-one'].deck).toEqual(paid.players['player-one'].deck)
})
it('descriptor withholds recovery and hidden deck IDs during payment, then exposes fresh public-trash candidates', () => {
  const before = fainted('old-target')
  for (const viewerPlayerId of ['player-one', 'player-two'] as const) {
    const descriptor = compilePendingDecisionDescriptor(before, null, { viewerPlayerId })
    expect(descriptor).toBeNull()
    const actual = compilePendingDecisionDescriptor(before, undefined, { viewerPlayerId })
    expect(actual?.steps).toHaveLength(1)
    expect(actual?.steps[0]).toMatchObject({ kind: 'cost', candidateIds: [], candidateSource: 'none', cost: { deckToTrash: { amount: 3 } }, commandKinds: ['resolve-faint-effect'] })
  }
  const descriptor = compilePendingDecisionDescriptor(pay(before))
  expect(descriptor?.steps.find(step => step.kind === 'target')?.candidateIds).toEqual(['bs12-091-old-blocker', 'bs12-091-milled-blocker'])
})
it('public logs distinguish actual milling, fresh recovery, paid zero and unpaid skip', () => {
  const before = fainted()
  const command = { kind: 'resolve-faint-effect' as const, playerId: 'player-one' as const, targetIds: [], payDeckToTrash: true }
  const paid = pay(before)
  const steps = describeCommandSteps(before, paid, command)!
  expect(steps.map(step => step.text).join(' ')).toMatch(/牌庫頂 3 張.*棄牌區/)
  expect(steps.at(-1)?.cards?.map(card => card.instanceId)).toEqual(before.players['player-one'].deck.slice(0, 3).map(card => card.instanceId))
  const recovered = recover(paid)
  expect(describeCommandSteps(paid, recovered, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: ['bs12-091-milled-blocker'] })?.at(-1)?.text).toMatch(/Milky Way Cookie.*棄牌區返回手牌/)
  expect(describeCommandSteps(paid, recover(paid, []), { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })?.at(-1)?.text).toMatch(/沒有卡牌返回/)
  expect(describeCommandSteps(before, recover(before, []), { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })?.at(-1)?.text).toMatch(/未支付.*後續回收未執行/)
})
it.each([undefined, true, false, 'true', 1, null])('online protocol preserves legacy commands and validates the new explicit cost flag: %s', value => {
  expect(isOnlineGameCommand({ kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], ...(value === undefined ? {} : { payDeckToTrash: value }) })).toBe(value === undefined || typeof value === 'boolean')
})
it.each(['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source', 'second-response'] as const)('Blocker pays only the printed purple Arena hand card: %s', scenario => {
  const before = createBs12CaramelArrowDemoState('BS12-091', scenario)
  const after = applyGameCommand(before, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-091-source', paymentIds: [], discardHandIds: [scenario === 'second-response' ? 'bs12-091-cost-two' : 'bs12-091-cost'] })
  expect(after.pendingBattle?.targetInstanceId).toBe('bs12-091-source')
  expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
  expect(after.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
})
it.each(['wrong-color', 'non-arena', 'split-cost', 'no-hand'] as const)('Blocker rejects an illegal hand cost: %s', scenario => {
  const before = createBs12CaramelArrowDemoState('BS12-091', scenario)
  expect(getBlockerCandidates(before, 'player-one').map(cookie => cookie.card.instanceId)).not.toContain('bs12-091-source')
  expect(() => applyGameCommand(before, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-091-source', paymentIds: [], discardHandIds: ['bs12-091-cost'] })).toThrow()
})
it.each(BS12_CARAMEL_ARROW_SCENARIOS)('named Browser fixture parses %s with legal copies and at most two battle Cookies', scenario => {
  expect(parseTestStateConfig(`?test-state=bs12-091:BS12-091@1:${scenario}`, 'localhost')).toMatchObject({ kind: 'bs12-091', scenario })
  const state = createBs12CaramelArrowDemoState('BS12-091@1', scenario)
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(4)
  }
})
