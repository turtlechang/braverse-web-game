import { expect, it } from 'vitest'
import { createBs12BlackLemonadeDemoState, createCardCheckDemoState, parseTestStateConfig, BS12_BLACK_LEMONADE_SCENARIOS } from './demo'
import type { Bs12BlackLemonadeScenario } from './demo'
import { applyGameCommand } from './commands'
import { canPlayExtraDeckCookie, getExtraDeckCookieUnavailableReason } from './actions'
import { executeCardEffect } from './effects'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import { printedFixtureCard } from './bs12-physical-fixtures.test-helpers'

const own = 'player-one' as const
const enemy = 'player-two' as const
const source = 'bs12-092-source'
const enter = (scenario: Bs12BlackLemonadeScenario = 'extra', number: 'BS12-092' | 'BS12-092@1' = 'BS12-092') => applyGameCommand(createBs12BlackLemonadeDemoState(number, scenario), { kind: 'play-extra-deck-cookie', playerId: own, instanceId: source })
const faintAlly = (scenario: Bs12BlackLemonadeScenario = 'friendly-faint', number: 'BS12-092' | 'BS12-092@1' = 'BS12-092') => {
  let state = createBs12BlackLemonadeDemoState(number, scenario)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: own })
  for(let hit=0;state.pendingBattle?.stage==='damage'&&hit<4;hit++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:own})
  return state
}

it.each(['BS12-092', 'BS12-092@1'] as const)('%s pays battle Cookie and attached HP before five-HP EXTRA entry', number => {
  const before = createBs12BlackLemonadeDemoState(number, 'extra-full')
  const snapshot = structuredClone(before)
  expect(canPlayExtraDeckCookie(before, own, source)).toBe(true)
  const pending = applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId: own, instanceId: source })
  expect(pending.players).toEqual(before.players)
  const prompt = getOptionalCostAttackPrompt(pending, own)!
  expect(prompt).toMatchObject({ mandatory: true, extraDeckEntry: true, needsTarget: true, targetMin: 1, targetMax: 1 })
  expect(prompt.targetCandidates.map(c => c.instanceId)).toEqual(['bs12-092-cost'])
  expect(prompt.costText).toContain('棄牌區')
  expect(compilePendingDecisionDescriptor(pending, undefined, { viewerPlayerId: own })?.steps).toContainEqual(expect.objectContaining({ kind: 'cost', min: 1, max: 1, candidateIds: ['bs12-092-cost'] }))
  const command = { kind: 'resolve-optional-cost-attack' as const, playerId: own, action: 'pay' as const, targetIds: ['bs12-092-cost'], paymentIds: [], discardCardIds: [] }
  const after = applyGameCommand(pending, command)
  expect(after.players[own].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-092-other', source])
  expect(after.players[own].battleArea[1].hpCards).toEqual(before.players[own].deck.slice(0, 5))
  expect(before.players[own].battleArea[0].hpCards).toHaveLength(3)
  expect(after.players[own].discardPile.map(c => c.instanceId)).toEqual(['bs12-092-cost',...before.players[own].battleArea[0].hpCards.map(c=>c.instanceId)])
  expect(after.players[own].breakArea).toEqual(before.players[own].breakArea)
  expect(after.cookiesFaintedThisTurn?.[own] ?? 0).toBe(0)
  expect(after.pendingFaintEffects).toBeUndefined()
  expect(after.pendingOpponentHandDiscard).toBeFalsy()
  expect(after.players[own].extraDeck).toEqual([])
  expect(after.extraDeckPlayUsedThisTurn).toBe(true)
  expect(after.players[enemy]).toEqual(before.players[enemy])
  expect(describeCommandSteps(pending, after, command)?.some(step => step.text.includes('EXTRA') && step.text.includes('棄牌區'))).toBe(true)
  expect(before).toEqual(snapshot)
})

it.each(['extra-lv1', 'extra-non-arena', 'extra-rested'] as const)('accepts printed battle cost without Arena or active restriction: %s', scenario => {
  const pending = enter(scenario)
  expect(applyGameCommand(pending, { kind: 'resolve-optional-cost-attack', playerId: own, action: 'pay', targetIds: ['bs12-092-cost'], paymentIds: [], discardCardIds: [] }).players[own].battleArea.at(-1)?.hpCards).toHaveLength(5)
})

it.each(['break-two', 'split-break', 'non-arena-blocker', 'wrong-zones', 'cost-red', 'cost-lv3', 'no-cost', 'outside-main', 'extra-used', 'extra-opponent-turn'] as const)('blocks the exact EXTRA requirement/cost: %s', scenario => {
  const before = createBs12BlackLemonadeDemoState('BS12-092', scenario)
  expect(canPlayExtraDeckCookie(before, own, source)).toBe(false)
  expect(getExtraDeckCookieUnavailableReason(before, own, source)).not.toBeNull()
  expect(() => applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId: own, instanceId: source })).toThrow()
})

it.each([[], ['bs12-092-cost', 'bs12-092-cost'], ['bs12-092-other'], ['bs12-092-blocker-0'], ['bs12-092-opponent'], [source]].map(ids => ({ ids })))('rejects invalid battle payment $ids without mutation', ({ ids }) => {
  const before = enter('extra-full')
  const snapshot = structuredClone(before)
  expect(() => applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId: own, action: 'pay', targetIds: ids, paymentIds: [], discardCardIds: [] })).toThrow()
  expect(before).toEqual(snapshot)
})

it('cannot skip mandatory EXTRA cost', () => expect(() => applyGameCommand(enter(), { kind: 'resolve-optional-cost-attack', playerId: own, action: 'skip' })).toThrow())

it.each(['BS12-092', 'BS12-092@1'] as const)('%s queues friendly faint and lets only the opponent choose their own discard', number => {
  const state = faintAlly('friendly-faint', number)
  expect(state.players[own].breakArea.map(c => c.instanceId)).toEqual(['bs12-092-ally'])
  expect(state.pendingFaintEffects?.[0]).toMatchObject({ sourceInstanceId: source, sourcePlayerId: own, effect: { kind: 'opponent-discard-hand', count: 1 } })
  const begun = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: own, targetIds: [] })
  expect(begun.pendingOpponentHandDiscard).toMatchObject({ playerId: enemy, count: 1, sourceInstanceId: source })
  expect(compilePendingDecisionDescriptor(begun, undefined, { viewerPlayerId: own })?.steps.flatMap(s => s.candidateIds ?? [])).not.toContain('bs12-092-enemy-hand-0')
  expect(() => applyGameCommand(begun, { kind: 'resolve-opponent-hand-discard', playerId: own, cardIds: ['bs12-092-enemy-hand-1'] })).toThrow()
  expect(() => applyGameCommand(begun, { kind: 'resolve-opponent-hand-discard', playerId: enemy, cardIds: ['bs12-092-ally'] })).toThrow()
  const after = applyGameCommand(begun, { kind: 'resolve-opponent-hand-discard', playerId: enemy, cardIds: ['bs12-092-enemy-hand-1'] })
  expect(after.players[enemy].hand.map(c => c.instanceId)).toEqual(['bs12-092-enemy-hand-0', 'bs12-092-enemy-hand-2'])
  expect(after.players[enemy].discardPile.at(-1)?.instanceId).toBe('bs12-092-enemy-hand-1')
  expect(after.pendingOpponentHandDiscard).toBeNull()
})

it.each(['hand-two', 'source-faint'] as const)('does not trigger when the threshold or living battle source is absent: %s', scenario => expect(faintAlly(scenario).pendingFaintEffects?.length ?? 0).toBe(0))
it('still triggers with a rested battle source', () => expect(faintAlly('source-rested').pendingFaintEffects?.[0]?.sourceInstanceId).toBe(source))

it.each(['damage', 'make-faint'] as const)('queues on a genuine nonbattle %s effect, not a direct trash movement', kind => {
  const before = createBs12BlackLemonadeDemoState('BS12-092', 'damage-faint')
  const snapshot = structuredClone(before)
  const after = executeCardEffect(before, { sourcePlayerId: enemy, sourceInstanceId: 'bs12-092-opponent' }, kind === 'damage'
    ? { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } }
    : { kind: 'make-faint', target: { side: 'opponent', min: 1, max: 1 } }, ['bs12-092-ally'])
  expect(after.pendingFaintEffects?.[0]?.sourceInstanceId).toBe(source)
  expect(before).toEqual(snapshot)
})

it('does not trigger from an opponent Cookie fainting', () => {
  const before = createBs12BlackLemonadeDemoState('BS12-092', 'opponent-faint')
  const after = executeCardEffect(before, { sourcePlayerId: own, sourceInstanceId: source }, { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } }, ['bs12-092-opponent'])
  expect(after.pendingFaintEffects?.length ?? 0).toBe(0)
})

it('AI can pay the mandatory EXTRA battle cost', () => {
  const after = takeAiStep(enter('extra-full'), own).state
  expect(after.players[own].battleArea.at(-1)?.card.instanceId).toBe(source)
  expect(after.pendingOptionalCostAttack).toBeNull()
})

it.each(['BS12-092', 'BS12-092@1'] as const)('%s resolves ordinary PPPP four and independent second-player Then with one card', number => {
  for (const scenario of ['attack', 'then-one', 'then-zero', 'first-player'] as const) {
    const before = createBs12BlackLemonadeDemoState(number, scenario)
    let state = applyGameCommand(before, { kind: 'declare-attack', playerId: own, attackerInstanceId: source, targetInstanceId: 'bs12-092-opponent', supportPaymentIds: before.players[own].supportArea.map(s => s.card.instanceId) })
    expect(state.pendingBattle?.declaredDamage).toBe(4)
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: enemy })
    for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 8; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: enemy })
    expect(state.players[enemy].battleArea[0].card.id).toBe('BS12-064')
    expect(before.players[enemy].battleArea[0].hpCards).toHaveLength(5)
    expect(state.players[enemy].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players[own].supportArea.every(s => s.rested)).toBe(true)
    const command = { kind: 'resolve-attack-effect' as const, playerId: own, targetIds: [] }
    const after = applyGameCommand(state, command)
    if (scenario === 'first-player' || scenario === 'then-zero') {
      expect(after.pendingOpponentHandDiscard).toBeFalsy()
      expect(after.players[enemy].hand).toEqual(before.players[enemy].hand)
      if (scenario === 'first-player') expect(describeCommandSteps(state, after, command)?.some(s => s.text.includes('條件不成立'))).toBe(true)
    } else {
      expect(after.pendingOpponentHandDiscard).toMatchObject({ playerId: enemy, count: 1 })
      const resolved = applyGameCommand(after, { kind: 'resolve-opponent-hand-discard', playerId: enemy, cardIds: [before.players[enemy].hand[0].instanceId] })
      expect(resolved.players[enemy].hand.length).toBe(before.players[enemy].hand.length - 1)
      expect(resolved.pendingOpponentHandDiscard).toBeNull()
    }
  }
})

it('last HP FLIP resolves before the friendly faint listener; rescue prevents the event', () => {
  const revealed = faintAlly('last-hp-flip')
  expect(revealed.pendingBattle?.stage).toBe('flip')
  expect(revealed.pendingFaintEffects?.length ?? 0).toBe(0)
  const rescued = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: own, activate: true, targetIds: ['bs12-092-ally'], discardHandIds: ['bs12-092-flip-cost'] })
  expect(rescued.players[own].battleArea.some(c => c.card.instanceId === 'bs12-092-ally' && c.hpCards.length === 1)).toBe(true)
  expect(rescued.pendingFaintEffects?.length ?? 0).toBe(0)
  expect(applyGameCommand(revealed, { kind: 'resolve-flip', playerId: own, activate: false, targetIds: [] }).pendingFaintEffects?.[0]?.sourceInstanceId).toBe(source)
})

it('ignores direct battle-to-trash movement and invalidates a listener that has left battle', () => {
  const before = createBs12BlackLemonadeDemoState('BS12-092', 'battle-to-trash')
  const moved = executeCardEffect(before, { sourcePlayerId: enemy, sourceInstanceId: 'bs12-092-opponent' }, { kind: 'field-to-trash', target: { side: 'opponent', min: 1, max: 1 } }, ['bs12-092-ally'])
  expect(moved.pendingFaintEffects?.length ?? 0).toBe(0)
  const queued = faintAlly()
  const left = { ...queued, players: { ...queued.players, [own]: { ...queued.players[own], battleArea: [], discardPile: [...queued.players[own].discardPile, queued.players[own].battleArea[0].card] } } }
  expect(applyGameCommand(left, { kind: 'resolve-faint-effect', playerId: own, targetIds: [] }).pendingOpponentHandDiscard).toBeFalsy()
})

it('battle-to-trash EXTRA payment also discards equipped cards without fainting', () => {
  const before = createBs12BlackLemonadeDemoState('BS12-092', 'extra')
  const equipment = createCardCheckDemoState('BS8-021').players[own].hand.find(card => card.id === 'BS8-021')!
  before.players[own].battleArea[0].equippedCards = [equipment]
  const pending = applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId: own, instanceId: source })
  const after = applyGameCommand(pending, { kind: 'resolve-optional-cost-attack', playerId: own, action: 'pay', targetIds: ['bs12-092-cost'], discardCardIds: [], paymentIds: [] })
  expect(after.players[own].discardPile.at(-1)).toEqual(equipment)
  expect(after.pendingFaintEffects).toBeUndefined()
})

it('R008 disposes a prepared underlay in the isolated EXTRA cost path without fainting', () => {
  const before = createBs12BlackLemonadeDemoState('BS12-092', 'extra')
  const underlay = printedFixtureCard('BS11-087', 'isolated-underlay')
  if (underlay.type !== 'cookie') throw new Error('Expected original Cookie underlay')
  before.players[own].battleArea[0].awakenedUnderlay = [underlay]
  const snapshot = structuredClone(before)
  expect(canPlayExtraDeckCookie(before, own, source)).toBe(true)
  expect(getExtraDeckCookieUnavailableReason(before, own, source)).toBeNull()
  const pending = enter('extra-full')
  pending.players[own].battleArea[0].awakenedUnderlay = [underlay]
  expect(getOptionalCostAttackPrompt(pending, own)?.targetCandidates.map(card => card.instanceId)).toContain('bs12-092-cost')
  expect(compilePendingDecisionDescriptor(pending, undefined, { viewerPlayerId: own })?.steps.find(step => step.id === 'battle-trash-cost')?.candidateIds).toContain('bs12-092-cost')
  const after = applyGameCommand(pending, { kind: 'resolve-optional-cost-attack', playerId: own, action: 'pay', targetIds: ['bs12-092-cost'] })
  expect(after.players[own].discardPile).toContainEqual(underlay)
  expect(after.pendingFaintEffects).toBeUndefined()
  expect(before).toEqual(snapshot)
})

it('keeps every dedicated fixture local and within per-player four-copy/two-Cookie limits', () => {
  for (const scenario of BS12_BLACK_LEMONADE_SCENARIOS) {
    expect(parseTestStateConfig(`?test-state=bs12-092:BS12-092:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-092', cardNumber: 'BS12-092', scenario })
    expect(parseTestStateConfig(`?test-state=bs12-092:BS12-092:${scenario}`, 'example.com')).toBeNull()
    const state = createBs12BlackLemonadeDemoState('BS12-092', scenario)
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(4)
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
    }
  }
})
