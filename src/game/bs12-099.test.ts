import { expect, it } from 'vitest'
import { BS12_CAKE_HOUND_SCENARIOS, createBs12CakeHoundDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getFaintEffectCardCandidates, getFaintEffectMinMax, getFaintSourceCostUnavailableReason } from './battle'
import { canActivateCookieSkill, getFaintTriggeredCost } from './skills'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'
import { getRefreshCandidates } from './refresh'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import type { GameState } from './types'

const playerId = 'player-one' as const, sourceId = 'bs12-099-source'
const pay = (state: GameState) => applyGameCommand(state, { kind: 'resolve-faint-effect', playerId, targetIds: [], payDeckToTrash: true })
const recover = (state: GameState, targetIds: string[] = ['bs12-099-milled-target']) => applyGameCommand(state, { kind: 'resolve-faint-effect', playerId, targetIds })
const candidates = (state: GameState) => getFaintEffectCardCandidates(state).map(card => card.instanceId)

it.each(['faint', 'own-turn', 'rested-source', 'hand-and-support', 'effect-damage', 'direct-faint'] as const)(
  '099 real source faint queues the independent top-three cost regardless of turn, REST or spare resources: %s', scenario => {
    const before = createBs12CakeHoundDemoState(scenario), snapshot = structuredClone(before)
    expect(before.pendingFaintEffects?.[0]).toMatchObject({ sourceInstanceId: sourceId, cost: { deckToTrash: { amount: 3 } },
      effect: { kind: 'trash-to-hand', max: 1, cookieOnly: true, energyColor: 'black', keyword: 'arena' } })
    expect(candidates(before)).toEqual([])
    const paid = pay(before), after = recover(paid)
    expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual([
      ...(scenario === 'hand-and-support' ? ['bs12-099-hand-cost'] : []), 'bs12-099-milled-target',
    ])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
    expect(before.players[playerId].discardPile.filter(card => card.instanceId.startsWith('bs12-099-source-hp-')).map(card => card.instanceId).sort()).toEqual(['bs12-099-source-hp-0', 'bs12-099-source-hp-1'])
    expect(before.players[playerId].discardPile).toHaveLength(scenario === 'effect-damage' ? 5 : 2)
    expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual([...before.players[playerId].discardPile.map(card => card.instanceId), 'bs12-099-milled-item', 'bs12-099-milled-red'])
    expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual([sourceId])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingFaintEffects).toBeUndefined()
    expect(before).toEqual(snapshot)
  },
)

it.each(['faint', 'same-name', 'lv-one'] as const)('099 recovery allows any printed name and LV1 or LV3 without Blocker: %s', scenario => {
  const before = createBs12CakeHoundDemoState(scenario), paid = pay(before)
  expect(candidates(paid)).toEqual(['bs12-099-milled-target'])
  expect(recover(paid).players[playerId].hand[0]).toEqual(before.players[playerId].deck[0])
})

it('099 existing trash targets stay hidden until payment; then both old and freshly milled targets are legal', () => {
  const before = createBs12CakeHoundDemoState('old-target')
  expect(candidates(before)).toEqual([])
  expect(getFaintEffectMinMax(before, before.pendingFaintEffects![0].effect)).toEqual({ min: 0, max: 0 })
  const paid = pay(before)
  expect(candidates(paid)).toEqual(['bs12-099-old-target', 'bs12-099-milled-target'])
  expect(recover(paid, ['bs12-099-old-target']).players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-099-old-target'])
  expect(recover(paid).players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-099-milled-target'])
})

it.each(['non-arena', 'wrong-color', 'split', 'zero-target', 'zones'] as const)('099 requires black AND Arena on one own trash Cookie: %s', scenario => {
  const before = createBs12CakeHoundDemoState(scenario), paid = pay(before)
  expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
  expect(candidates(paid)).toEqual([])
  const after = recover(paid, [])
  expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
  expect(after.players[playerId].discardPile).toEqual(paid.players[playerId].discardPile)
  expect(after.pendingFaintEffects).toBeUndefined()
})

it('099 choosing zero after payment spends all three cards; declining payment spends nothing', () => {
  const before = createBs12CakeHoundDemoState('old-target'), paid = pay(before)
  const zero = recover(paid, [])
  expect(zero.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
  expect(zero.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, ...before.players[playerId].deck.slice(0, 3)])
  const skipped = recover(before, [])
  expect(skipped.players).toEqual(before.players)
  expect(skipped.pendingFaintEffects).toBeUndefined()
})

it.each(['target', 'energy', 'hand', 'support-trash', 'support-hand'] as const)('099 rejects pre-payment %s choices atomically', field => {
  const before = createBs12CakeHoundDemoState('old-target'), snapshot = structuredClone(before)
  expect(() => applyGameCommand(before, { kind: 'resolve-faint-effect', playerId, payDeckToTrash: true,
    targetIds: field === 'target' ? ['bs12-099-old-target'] : [],
    ...(field === 'energy' ? { paymentIds: ['bs12-099-payment-0'] } : {}),
    ...(field === 'hand' ? { discardHandIds: ['bs12-099-hand-cost'] } : {}),
    ...(field === 'support-trash' ? { supportToTrashIds: ['bs12-099-payment-0'] } : {}),
    ...(field === 'support-hand' ? { supportToHandIds: ['bs12-099-payment-0'] } : {}),
  })).toThrow(/先支付牌庫頂代價/)
  expect(before).toEqual(snapshot)
})
it.each([true, false])('099 rejects repeated milling after its payment: %s', payDeckToTrash => {
  const paid = pay(createBs12CakeHoundDemoState())
  expect(() => applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId, targetIds: [], payDeckToTrash })).toThrow(/沒有待支付/)
})
it.each([['bs12-099-milled-item'], ['bs12-099-milled-red'], [sourceId], ['bs12-099-ally'], ['unknown'],
  ['bs12-099-milled-target', 'bs12-099-milled-target']])('099 rejects non-Cookie, wrong color, Break, field, unknown or duplicate recovery: %s', (...ids) => {
  expect(() => recover(pay(createBs12CakeHoundDemoState()), ids)).toThrow()
})
it('099 rejects more than one otherwise legal target', () => {
  expect(() => recover(pay(createBs12CakeHoundDemoState('old-target')), ['bs12-099-old-target', 'bs12-099-milled-target'])).toThrow()
})
it.each(['bs12-099-opponent-trash-target', 'bs12-099-hand-target', 'bs12-099-break-target', 'bs12-099-payment-0', 'bs12-099-ally'])('099 rejects a qualifying card in another player or zone: %s', id => {
  expect(() => recover(pay(createBs12CakeHoundDemoState('zones')), [id])).toThrow()
})

it.each(['short-deck', 'empty-deck', 'exact-deck'] as const)('099 finishes exactly three actual mill cards across Refresh before target selection: %s', scenario => {
  const paid = pay(createBs12CakeHoundDemoState(scenario))
  expect(paid.pendingRefresh).toBeDefined()
  expect(paid.pendingFaintEffects?.[0].cost).toBeUndefined()
  const refresh = getRefreshCandidates(paid, playerId).find(card => card.instanceId === (scenario === 'exact-deck' ? 'bs12-099-milled-red' : 'bs12-099-refresh-cookie'))!
  const after = applyGameCommand(paid, { kind: 'refresh-deck', playerId, cookieInstanceId: refresh.instanceId }, { shuffleSeed: 31 })
  expect(after.deckTrashResolution?.cards).toHaveLength(3)
  expect(after.pendingRefresh).toBeNull()
  expect(after.pendingFaintEffects?.[0].cost).toBeUndefined()
  expect(() => recover(after, [])).not.toThrow()
})
it('099 cannot pay an empty deck without a Refresh Cookie and skips the whole trigger', () => {
  const before = createBs12CakeHoundDemoState('unpayable')
  expect(getFaintSourceCostUnavailableReason(before)).toMatch(/無法支付牌庫頂代價/)
  expect(recover(before, []).pendingFaintEffects).toBeUndefined()
})
it('099 Refresh LV10 defeat stops remaining milling and recovery', () => {
  const paid = pay(createBs12CakeHoundDemoState('refresh-defeat'))
  const after = applyGameCommand(paid, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-099-milled-target' }, { shuffleSeed: 31 })
  expect(after.status).toBe('finished')
  expect(after.pendingFaintEffects).toBeUndefined()
  expect(after.players[playerId].hand).toEqual([])
})

it('099 last-HP FLIP rescue precedes faint; skipping that FLIP queues the actual Cake Hound cost', () => {
  const before = createBs12CakeHoundDemoState('last-hp-flip')
  const rescued = applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: true, targetIds: [sourceId], discardHandIds: ['bs12-099-hand-cost'] })
  expect(rescued.players[playerId].battleArea[0].hpCards).toHaveLength(1)
  expect(rescued.pendingFaintEffects).toBeUndefined()
  const declined = applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: false, targetIds: [] })
  expect(declined.pendingFaintEffects?.[0].cost).toEqual({ deckToTrash: { amount: 3 } })
})

it.each(['field-to-trash', 'return-to-hand'] as const)('099 non-faint %s departure does not trigger recovery', kind => {
  const before = createBs12CakeHoundDemoState(kind === 'field-to-trash' ? 'non-faint-trash' : 'non-faint-hand')
  assertBs12PhysicalFixture(before)
  const after = kind === 'field-to-trash'
    ? applyGameCommand(before, {kind: 'deploy-cookie', playerId, instanceId: 'bs12-099-special', specialPlayCookieInstanceIds: [sourceId]})
    : applyGameCommand(applyGameCommand(before, {kind: 'begin-play-item', playerId, instanceId: 'bs12-099-return-item', paymentIds: ['bs12-099-payment-0']}), {kind: 'resolve-ability-effect', playerId, targetIds: [sourceId]})
  assertBs12PhysicalFixture(after)
  if (kind === 'return-to-hand') {
    expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual([sourceId])
    expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual(['bs12-099-return-item', 'bs12-099-source-hp-0', 'bs12-099-source-hp-1'])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
  }
  expect(after.pendingFaintEffects).toBeUndefined()
  expect(after.players[playerId].breakArea).toEqual([])
  expect(after.players[playerId].battleArea.some(cookie => cookie.card.instanceId === sourceId)).toBe(false)
})
it('099 paid Special Play trash departure is not faint', () => {
  const before = createBs12CakeHoundDemoState('non-faint-trash')
  const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: 'bs12-099-special', specialPlayCookieInstanceIds: [sourceId] })
  expect(after.pendingFaintEffects).toBeUndefined()
  expect(after.players[playerId].breakArea).toEqual([])
  expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual([sourceId, 'bs12-099-source-hp-0', 'bs12-099-source-hp-1'])
})

it('099 surviving damage does not open the faint cost or move its deck', () => {
  const before = createBs12CakeHoundDemoState('faint', true)
  expect(before.players[playerId].battleArea[0].hpCards).toHaveLength(2)
  const after = applyGameCommand(before, {kind: 'resolve-next-damage', playerId})
  assertBs12PhysicalFixture(after)
  expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.pendingFaintEffects).toBeUndefined()
})
it('099 another Cookie fainting does not trigger Cake Hound recovery', () => {
  const initial = createBs12CakeHoundDemoState('attack'), parent = createBs12CakeHoundDemoState('direct-faint')
  const before: GameState = {...initial, players: {...initial.players,
    [playerId]: {...initial.players[playerId], battleArea: [initial.players[playerId].battleArea[0], {...initial.players[playerId].battleArea[1], card: parent.players[playerId].battleArea[0].card}], supportArea: parent.players[playerId].supportArea.map(support => ({...support, rested: false}))},
    'player-two': {...initial.players['player-two'], battleArea: [{...initial.players['player-two'].battleArea[0], card: parent.players['player-two'].battleArea[0].card, hpCards: initial.players['player-two'].battleArea[0].hpCards.slice(0, 4)}]},
  }}
  assertBs12PhysicalFixture(before)
  expect(before.players[playerId].battleArea[1].card.id).toBe('BS8-010')
  expect(before.players[playerId].battleArea[1].hpCards).toHaveLength(4)
  expect(before.players['player-two'].battleArea[0].card.id).toBe('BS12-019')
  let after = applyGameCommand(before, {kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-099-ally', targetInstanceId: 'bs12-099-opponent', supportPaymentIds: before.players[playerId].supportArea.map(support => support.card.instanceId)})
  after = applyGameCommand(after, {kind: 'skip-trap', playerId: 'player-two'})
  while (after.pendingBattle?.stage === 'damage') after = applyGameCommand(after, {kind: 'resolve-next-damage', playerId: 'player-two'})
  after = applyGameCommand(after, {kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-099-ally']})
  assertBs12PhysicalFixture(after)
  expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual(['bs12-099-ally'])
  expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
  expect(after.pendingFaintEffects?.some(effect => effect.sourceInstanceId === sourceId)).not.toBe(true)
})

it('099 normal entry configures two actual HP, with no On Play or Special Play', () => {
  const before = createBs12CakeHoundDemoState('deploy')
  const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
  expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
  expect(after.players[playerId].deck).toHaveLength(10)
  expect(after.pendingOnPlay).toBeNull()
  expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  expect(getFaintTriggeredCost(after.players[playerId].battleArea[1].card.skill!)).toEqual({ deckToTrash: { amount: 3 } })
})
const declare = (before: GameState, supportPaymentIds = ['bs12-099-payment-0', 'bs12-099-payment-1']) => applyGameCommand(before,
  { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-099-opponent', supportPaymentIds })
it('099 KK ordinary attack deals two, rests only its selected black supports and never triggers its own faint skill', () => {
  const before = createBs12CakeHoundDemoState('spare-energy'), snapshot = structuredClone(before)
  let after = applyGameCommand(declare(before), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; i < 4 && after.pendingBattle?.stage === 'damage'; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
  expect(before.players['player-two'].battleArea[0].card.id).toBe('BS12-064')
  expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
  expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  expect(after.players[playerId].supportArea.map(support => support.rested)).toEqual([true, true, false])
  expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].battleArea[0].hpCards)
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.pendingFaintEffects).toBeUndefined()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  expect(before).toEqual(snapshot)
})
it.each(['wrong-energy', 'few-energy', 'rested-energy', 'attack-rested', 'opponent-turn', 'outside-main'] as const)('099 rejects illegal attack payment or timing: %s', scenario => {
  const before = createBs12CakeHoundDemoState(scenario), snapshot = structuredClone(before)
  expect(() => declare(before)).toThrow()
  expect(before).toEqual(snapshot)
})

it('099 descriptor exposes no private deck IDs before payment and fresh public trash afterward', () => {
  const before = createBs12CakeHoundDemoState('old-target')
  for (const viewerPlayerId of ['player-one', 'player-two'] as const) {
    expect(compilePendingDecisionDescriptor(before, undefined, { viewerPlayerId })?.steps[0]).toMatchObject({
      kind: 'cost', candidateIds: [], candidateSource: 'none', cost: { deckToTrash: { amount: 3 } }, commandKinds: ['resolve-faint-effect'],
    })
  }
  expect(compilePendingDecisionDescriptor(pay(before))?.steps.find(step => step.kind === 'target')?.candidateIds).toEqual(['bs12-099-old-target', 'bs12-099-milled-target'])
})
it('099 AI pays before choosing the newly public target', () => {
  const before = createBs12CakeHoundDemoState(), paid = takeAiStep(before, playerId).state
  expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
  expect(paid.pendingFaintEffects?.[0].cost).toBeUndefined()
  expect(takeAiStep(paid, playerId).state.players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-099-milled-target'])
})
it('099 public logs name actual three-card cost, fresh recovery, paid zero and unpaid skip', () => {
  const before = createBs12CakeHoundDemoState(), paid = pay(before)
  const cost = describeCommandSteps(before, paid, { kind: 'resolve-faint-effect', playerId, targetIds: [], payDeckToTrash: true })!
  expect(cost.map(step => step.text).join(' ')).toMatch(/牌庫頂 3 張.*棄牌區/)
  expect(cost.at(-1)?.cards?.map(card => card.instanceId)).toEqual(before.players[playerId].deck.slice(0, 3).map(card => card.instanceId))
  expect(describeCommandSteps(paid, recover(paid), { kind: 'resolve-faint-effect', playerId, targetIds: ['bs12-099-milled-target'] })?.at(-1)?.text).toMatch(/Butter Roll Cookie.*棄牌區返回手牌/)
  expect(describeCommandSteps(paid, recover(paid, []), { kind: 'resolve-faint-effect', playerId, targetIds: [] })?.at(-1)?.text).toMatch(/沒有卡牌返回/)
  expect(describeCommandSteps(before, recover(before, []), { kind: 'resolve-faint-effect', playerId, targetIds: [] })?.at(-1)?.text).toMatch(/未支付.*後續回收未執行/)
})

it.each(BS12_CAKE_HOUND_SCENARIOS)('099 finite local fixture %s preserves unique IDs, at most four copies and two battle Cookies', scenario => {
  expect(parseTestStateConfig(`?test-state=bs12-099:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-099', scenario })
  const state = createBs12CakeHoundDemoState(scenario), ids: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
    const copies = new Map<string, number>()
    for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
    expect([...copies.values()].every(count => count <= 4)).toBe(true)
    ids.push(...cards.map(card => card.instanceId))
  }
  // A last-HP FLIP remains in the pending resolution instead of a public zone.
  expect(new Set(ids).size).toBe(ids.length)
})
it('099 rejects unknown scenarios and nonlocal preview routes', () => {
  expect(parseTestStateConfig('?test-state=bs12-099:invalid', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-099:faint', 'example.com')).toBeNull()
})
