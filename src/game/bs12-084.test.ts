import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createBs12GuitarStringDemoState, createBs12SummerSodaDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateStage } from './card-abilities'
import { describeCommandSteps } from './command-log'
import { getTrashToDeckBottomCostCandidates } from './skills'
import { chooseAiStageCostIds } from './ai/turn-handler'
import { isClientMessage } from '../net/onlineProtocol'
import { takeAiStep } from './ai'
import { maskGameStateForViewer } from './masked-state'
import type { GameCard, GameState } from './types'

const actor = 'player-one' as const
const enemy = 'player-two' as const
const ids = ['bs12-083-blocker', 'bs12-083-red-blocker']
const stageCard = (): GameCard => {
  const result = convertOfficialCardToGameCard(candidate.cards.find(card => card.cardNumber === 'BS12-084') as OfficialCardRecord, 'stage')
  if (result.status !== 'converted') throw new Error('Missing 084')
  return { ...result.gameCard, instanceId: 'stage' }
}
const setup = (handCount = 6): GameState => {
  const base = createBs12GuitarStringDemoState('two-blockers')
  return { ...base, players: { ...base.players,
    [actor]: { ...base.players[actor], stage: { card: stageCard(), rested: false } },
    [enemy]: { ...base.players[enemy], hand: Array.from({ length: handCount }, (_, i) => ({ ...base.players[actor].discardPile[i % 2 + 2], instanceId: `enemy-hand-${i}` })) },
  } }
}
const command = { kind: 'begin-activate-stage' as const, playerId: actor, paymentIds: ['bs12-083-payment'], trashToDeckBottomIds: ids }
const begin = (state: GameState, selected = ids) => applyGameCommand(state, { ...command, trashToDeckBottomIds: selected })

it.each([ids, [...ids].reverse()].map(selected => ({ selected })))('084 pays two printed Blockers in the submitted bottom order: $selected', ({ selected }) => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(canActivateStage(before, actor)).toBe(true)
  const paid = begin(before, selected)
  expect(paid.players[actor].deck.slice(0, -2)).toEqual(before.players[actor].deck)
  expect(paid.players[actor].deck.slice(-2).map(card => card.instanceId)).toEqual(selected)
  expect(paid.players[actor].discardPile.map(card => card.instanceId)).toEqual(['bs12-083-non-blocker', 'bs12-083-non-cookie'])
  expect(paid.players[actor].stage?.rested).toBe(true)
  expect(paid.players[actor].supportArea[0].rested).toBe(true)
  expect(paid.players[actor].battleArea).toEqual(before.players[actor].battleArea)
  expect(paid.players[actor].hand).toEqual(before.players[actor].hand)
  expect(paid.players[enemy]).toEqual(before.players[enemy])
  expect(paid.skillUsesThisTurn).not.toContain('stage')
  expect(before).toEqual(snapshot)
})

it('084 includes a red non-Arena Blocker with unpayable printed Blocker cost', () => {
  const before = setup()
  const cost = before.players[actor].stage!.card.stageAbility!.cost
  expect(getTrashToDeckBottomCostCandidates(cost, before.players[actor].discardPile).map(card => card.instanceId)).toEqual(ids)
  expect(before.players[actor].discardPile[1]).toMatchObject({ id: 'BS1-009', energyColor: 'red' })
})

it.each([[], [ids[0]], [ids[0], ids[0]], [...ids, 'bs12-083-non-blocker'], [ids[0], 'bs12-083-non-blocker'], [ids[0], 'bs12-083-non-cookie'], [ids[0], 'bs12-083-hand-blocker'], [ids[0], 'bs12-083-payment'], [ids[0], 'bs12-083-opponent-blocker'], [ids[0], 'unknown']].map(selected => ({ selected })))('084 rejects invalid costs atomically: $selected', ({ selected }) => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(() => begin(before, selected)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each([0, 1])('084 cannot activate with only %i eligible Blockers', count => {
  const before = setup()
  before.players[actor].discardPile = before.players[actor].discardPile.filter(card => !ids.includes(card.instanceId) || ids.indexOf(card.instanceId) < count)
  expect(canActivateStage(before, actor)).toBe(false)
  expect(() => begin(before)).toThrow()
})

it.each(['red-energy', 'rested-energy', 'no-energy', 'rested-stage', 'no-stage', 'opponent-turn', 'outside-main'] as const)('084 rejects illegal activation: %s', scenario => {
  const before = setup()
  if (scenario === 'red-energy') before.players[actor].supportArea[0].card = { ...before.players[actor].supportArea[0].card, energyColor: 'red' }
  if (scenario === 'rested-energy') before.players[actor].supportArea[0].rested = true
  if (scenario === 'no-energy') before.players[actor].supportArea = []
  if (scenario === 'rested-stage') before.players[actor].stage!.rested = true
  if (scenario === 'no-stage') before.players[actor].stage = null
  if (scenario === 'opponent-turn') before.activePlayerId = enemy
  if (scenario === 'outside-main') before.phase = 'active'
  const snapshot = structuredClone(before)
  expect(canActivateStage(before, actor)).toBe(false)
  expect(() => begin(before)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each([5, 6, 7])('084 pays all costs before checking the opponent hand threshold: %i', count => {
  const before = setup(count)
  const paid = begin(before)
  expect(paid.players[actor].deck).toHaveLength(14)
  expect(paid.players[actor].stage?.rested).toBe(true)
  if (count === 5) {
    expect(paid.pendingAbilityEffect).toBeFalsy()
    expect(paid.pendingOpponentHandDiscard).toBeFalsy()
    expect(paid.players[enemy]).toEqual(before.players[enemy])
    expect(describeCommandSteps(before, paid, command)?.some(step => /場景效果結果：條件不成立，效果未執行/.test(step.text))).toBe(true)
    return
  }
  const offered = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: actor, targetIds: [] })
  expect(offered.pendingOpponentHandDiscard).toMatchObject({ playerId: enemy, count: 1, sourceInstanceId: 'stage' })
  const chosen = before.players[enemy].hand[1]
  expect(() => applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: actor, cardIds: [chosen.instanceId] })).toThrow()
  for (const cardIds of [[], [chosen.instanceId, chosen.instanceId], ['enemy-hand-0', 'enemy-hand-1'], [ids[0]]]) {
    expect(() => applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: enemy, cardIds })).toThrow()
  }
  const result = applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: enemy, cardIds: [chosen.instanceId] })
  expect(result.players[enemy].hand).toHaveLength(count - 1)
  expect(result.players[enemy].discardPile.at(-1)).toEqual(chosen)
  expect(result.players[actor]).toEqual(paid.players[actor])
})

it('084 preserves ordered public cost cards in its command trace and JSON replay', () => {
  const before = setup()
  const reversed = { ...command, trashToDeckBottomIds: [...ids].reverse() }
  const paid = applyGameCommand(before, reversed)
  const costStep = describeCommandSteps(before, paid, reversed)?.find(step => /棄牌區.*牌庫底/.test(step.text))
  expect(costStep?.cards?.map(card => card.instanceId)).toEqual(reversed.trashToDeckBottomIds)
  expect(applyGameCommand(before, JSON.parse(JSON.stringify(reversed)))).toEqual(paid)
})

it.each(['activate-stage', 'begin-activate-stage'])('084 validates ordered cost protocol for %s and keeps old commands valid', kind => {
  const old = { kind, playerId: actor, paymentIds: ['payment'] }
  expect(isClientMessage({ type: 'submit-command', command: old })).toBe(true)
  expect(isClientMessage({ type: 'submit-command', command: { ...old, trashToDeckBottomIds: ids } })).toBe(true)
  for (const trashToDeckBottomIds of [null, 'card', [1], ['card', null]]) {
    expect(isClientMessage({ type: 'submit-command', command: { ...old, trashToDeckBottomIds } })).toBe(false)
  }
})

it('084 AI selects the same legal exact cost and rejects insufficient trash', () => {
  const before = setup()
  const cost = before.players[actor].stage!.card.stageAbility!.cost
  const selected = chooseAiStageCostIds(before, actor, cost, 'stage')
  expect(selected).toMatchObject({ paymentIds: ['bs12-083-payment'], trashToDeckBottomIds: ids })
  expect(() => begin(before, selected!.trashToDeckBottomIds)).not.toThrow()
  before.players[actor].discardPile.shift()
  expect(chooseAiStageCostIds(before, actor, cost, 'stage')).toBeNull()
})

it('084 dedicated route is confined to localhost', () => {
  expect(parseTestStateConfig('?test-state=bs12-084:positive', 'localhost')).toEqual({ kind: 'bs12-084', scenario: 'positive' })
  expect(parseTestStateConfig('?test-state=bs12-084:positive', 'example.com')).toBeNull()
})

it.each(['positive', 'five', 'seven', 'three-blockers', 'one-blocker', 'no-blocker', 'wrong-energy', 'rested-energy', 'no-energy', 'rested-source', 'opponent-turn', 'outside-main', 'place', 'replace', 'one-energy', 'placement-wrong-energy', 'placement-rested-energy', 'placement-no-energy', 'receiver'] as const)('084 fixture keeps distinct physical identities and legal visible official copies: %s', scenario => {
  const state = createBs12SummerSodaDemoState(scenario)
  const allIds: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]), ...(player.stage ? [player.stage.card] : [])]
    allIds.push(...cards.map(card => card.instanceId))
    const counts = new Map<string, number>()
    for (const card of cards.filter(card => card.id.startsWith('BS12-') || card.id.startsWith('BS1-'))) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(new Set(allIds).size).toBe(allIds.length)
})

it.each(['place', 'replace', 'one-energy'] as const)('084 placement pays its separate P without consuming the Blockers: %s', scenario => {
  const before = createBs12SummerSodaDemoState(scenario)
  const placed = applyGameCommand(before, { kind: 'play-stage', playerId: actor, instanceId: 'bs12-084-stage', paymentIds: ['bs12-084-payment-0'] })
  expect(placed.players[actor].stage).toMatchObject({ card: { id: 'BS12-084' }, rested: false })
  expect(placed.players[actor].deck).toEqual(before.players[actor].deck)
  expect(placed.players[actor].battleArea).toEqual(before.players[actor].battleArea)
  expect(placed.players[actor].discardPile).toEqual([...before.players[actor].discardPile, ...(scenario === 'replace' ? [before.players[actor].stage!.card] : [])])
  expect(placed.pendingAbilityEffect).toBeFalsy()
  expect(canActivateStage(placed, actor)).toBe(scenario !== 'one-energy')
})

it.each(['placement-wrong-energy', 'placement-rested-energy', 'placement-no-energy'] as const)('084 placement rejects invalid P atomically: %s', scenario => {
  const before = createBs12SummerSodaDemoState(scenario)
  const copy = structuredClone(before)
  expect(() => applyGameCommand(before, { kind: 'play-stage', playerId: actor, instanceId: 'bs12-084-stage', paymentIds: ['bs12-084-payment-0'] })).toThrow()
  expect(before).toEqual(copy)
})

it('084 deterministic AI submits legal bottom costs before the receiver choice', () => {
  const before = createBs12SummerSodaDemoState()
  before.players[actor].hand = []
  before.players[actor].battleArea[0].rested = true
  before.turnNumber = 1
  const result = takeAiStep(before, actor, { level: 2 })
  expect(result.action).toBe('activate-stage')
  expect(result.state.players[actor].deck.slice(-2).map(card => card.instanceId)).toEqual(['bs12-084-blocker', 'bs12-084-red-blocker'])
  expect(result.state.players[actor].stage?.rested).toBe(true)
  expect(result.state.pendingOpponentHandDiscard?.playerId).toBe(enemy)
})

it.each([1, 3, 5] as const)('084 receiver AI level %i discards exactly one of its own private hand cards', level => {
  const before = createBs12SummerSodaDemoState()
  const paid = applyGameCommand(before, { kind: 'begin-activate-stage', playerId: actor, paymentIds: ['bs12-084-payment-0'], trashToDeckBottomIds: ['bs12-084-blocker', 'bs12-084-red-blocker'], targetIds: [] })
  const after = takeAiStep(paid, enemy, { level }).state
  expect(after.pendingOpponentHandDiscard).toBeFalsy()
  expect(after.players[enemy].hand).toHaveLength(5)
  expect(after.players[enemy].discardPile).toHaveLength(paid.players[enemy].discardPile.length + 1)
  expect(paid.players[enemy].hand).toContainEqual(after.players[enemy].discardPile.at(-1))
  expect(after.players[actor]).toEqual(paid.players[actor])
})

it('084 keeps receiver hand identities private from the activating player', () => {
  const before = createBs12SummerSodaDemoState()
  const paid = applyGameCommand(before, { kind: 'begin-activate-stage', playerId: actor, paymentIds: ['bs12-084-payment-0'], trashToDeckBottomIds: ['bs12-084-red-blocker', 'bs12-084-blocker'], targetIds: [] })
  expect(paid.pendingOpponentHandDiscard?.playerId).toBe(enemy)
  const sourceView = maskGameStateForViewer(paid, actor)
  const receiverView = maskGameStateForViewer(paid, enemy)
  expect(sourceView.players[enemy].hand.every(card => card.id === 'hidden')).toBe(true)
  expect(receiverView.players[enemy].hand).toEqual(before.players[enemy].hand)
  expect(receiverView.players[actor].discardPile.map(card => card.instanceId)).toEqual(['bs12-084-non-blocker', 'bs12-084-non-cookie'])
})
