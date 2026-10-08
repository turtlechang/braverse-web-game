import { describe, expect, it } from 'vitest'
import { createBs12FinalPhysicalDemoState } from './demo'
import { applyGameCommand, getPendingDecision } from './commands'
import { getEffectSelectionCandidates, getPlaceHandHpCandidates } from './effects'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'
import { takeAiStep } from './ai'
import { createPlayerView } from './player-view'
import { buildCardContractActionTrace } from '../cards/contracts/action-trace'
import type { GameState } from './types'
const owner = 'player-one' as const, foe = 'player-two' as const
export const attack109 = (state: GameState) => {
  let next = applyGameCommand(state, { kind: 'declare-attack', playerId: owner, attackerInstanceId: 'final-source', targetInstanceId: 'final-enemy', supportPaymentIds: ['final-payment-0', 'final-payment-1'] })
  next = applyGameCommand(next, { kind: 'skip-trap', playerId: foe })
  for (let i = 0; i < 2; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: foe })
  return next
}
const select = (state: GameState, id = 'final-companion') => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [id] })
describe.each(['BS12-109', 'BS12-109@1', 'BS12-109@2'] as const)('%s R006 printed Special Play hand Cookie as face-up top HP', number => {
  it.each(['then-positive', 'then-source', 'then-one-hp', 'then-rested'] as const)('accepts any own Cookie at printed HP, including source/REST/one HP: %s', scenario => {
    const before = createBs12FinalPhysicalDemoState(number, scenario)
    assertBs12PhysicalFixture(before)
    expect(Object.values(before.players).flatMap(p => p.battleArea).every(c => c.hpCards.length === c.card.hp)).toBe(true)
    const attacked = attack109(before), targetId = scenario === 'then-source' ? 'final-source' : 'final-companion'
    const queued = select(attacked, targetId)
    expect(queued.players).toEqual(attacked.players)
    expect(getPendingDecision(queued)).toMatchObject({ kind: 'place-hand-hp', required: true, targetInstanceId: targetId })
    expect(getPlaceHandHpCandidates(queued, owner).map(c => c.instanceId)).toEqual(['final-hand-special', 'final-hand-non-arena-special'])
    const beforeTarget = queued.players[owner].battleArea.find(c => c.card.instanceId === targetId)!
    const hand = queued.players[owner].hand.find(c => c.instanceId === 'final-hand-special')!
    const done = applyGameCommand(queued, { kind: 'resolve-place-hand-hp', playerId: owner, handCardInstanceId: hand.instanceId })
    const target = done.players[owner].battleArea.find(c => c.card.instanceId === targetId)!
    expect(target.hpCards).toEqual([...beforeTarget.hpCards, hand])
    expect(target.faceUpHpCardInstanceIds).toContain(hand.instanceId)
    expect(done.players[owner].hand.map(c => c.instanceId)).not.toContain(hand.instanceId)
    expect(done.players[owner].deck).toEqual(queued.players[owner].deck)
    expect(done.players[owner].supportArea).toEqual(queued.players[owner].supportArea)
    expect(done.pendingAbilityEffect).toBeFalsy()
    expect(done.pendingBattle).toBeFalsy()
    expect(done.commandLog?.at(-1)?.summary).toMatch(/Blueberry Cake Hound.*面朝上.*最上方/)
    const trace = buildCardContractActionTrace(done.commandLog ?? [], 'BS12-109')
    const placementTrace = trace.find(entry => entry.commandKind === 'resolve-place-hand-hp')!
    expect(placementTrace).toBeDefined()
    expect(placementTrace.summary).toMatch(/Blueberry Cake Hound.*面朝上.*最上方/)
    expect(placementTrace.steps.join('\n')).toMatch(/Blueberry Cake Hound.*正面朝上.*最上方/)
    expect(JSON.stringify(placementTrace)).not.toMatch(/Mold Dough Cookie|final-hand-non-arena-special|payload|handCardInstanceId/)
    expect(JSON.stringify(createPlayerView(done, foe))).toContain(hand.imageUrl!)
    assertBs12PhysicalFixture(done)
  })
  it('permits a printed non-Arena Special Play Cookie and has no color/LV restriction on the hand card', () => {
    const queued = select(attack109(createBs12FinalPhysicalDemoState(number, 'then-non-arena-special')))
    const card = queued.players[owner].hand.find(c => c.instanceId === 'final-hand-non-arena-special')!
    expect(card.type).toBe('cookie')
    expect(card.keywords?.includes('arena')).not.toBe(true)
    const done = applyGameCommand(queued, { kind: 'resolve-place-hand-hp', playerId: owner, handCardInstanceId: card.instanceId })
    expect(done.players[owner].battleArea[1].hpCards.at(-1)).toEqual(card)
    expect(done.players[owner].battleArea[1].faceUpHpCardInstanceIds).toContain(card.instanceId)
  })
  it('permits choosing zero Cookie before hand placement without changing zones', () => {
    const attacked = attack109(createBs12FinalPhysicalDemoState(number, 'then-positive'))
    const done = applyGameCommand(attacked, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
    expect(done.players).toEqual(attacked.players)
    expect(done.pendingAbilityEffect).toBeFalsy()
    expect(done.pendingBattle).toBeFalsy()
  })
  it('requires exactly one legal hand card once a Cookie has been chosen', () => {
    const queued = select(attack109(createBs12FinalPhysicalDemoState(number, 'then-positive'))), snapshot = structuredClone(queued)
    for (const id of [undefined, 'final-hand-no-special', 'final-payment-0', 'missing']) expect(() => applyGameCommand(queued, { kind: 'resolve-place-hand-hp', playerId: owner, handCardInstanceId: id })).toThrow()
    expect(() => applyGameCommand(queued, { kind: 'resolve-place-hand-hp', playerId: foe, handCardInstanceId: 'final-hand-special' })).toThrow()
    expect(queued).toEqual(snapshot)
    const descriptor = compilePendingDecisionDescriptor(queued, undefined, { viewerPlayerId: owner })!
    expect(descriptor.steps[0]).toMatchObject({ required: true, min: 1, max: 1, candidateIds: ['final-hand-special', 'final-hand-non-arena-special'] })
    expect(compilePendingDecisionDescriptor(queued, undefined, { viewerPlayerId: foe })?.steps[0].candidateIds).toEqual([])
  })
  it('rejects opponent Cookie, two own Cookies and an unknown target immutably', () => {
    const attacked = attack109(createBs12FinalPhysicalDemoState(number, 'then-positive')), snapshot = structuredClone(attacked)
    for (const ids of [['final-enemy'], ['final-source', 'final-companion'], ['missing']]) expect(() => applyGameCommand(attacked, { kind: 'resolve-attack-effect', playerId: owner, targetIds: ids })).toThrow()
    expect(attacked).toEqual(snapshot)
  })
  it('counts all opponent support CARDS including an Item and a rested card', () => {
    const before = createBs12FinalPhysicalDemoState(number, 'then-positive')
    expect(before.players[foe].supportArea.some(s => s.card.type === 'item')).toBe(true)
    expect(before.players[foe].supportArea.some(s => s.rested)).toBe(true)
    const attacked = attack109(before)
    expect(select(attacked).pendingAbilityEffect?.pendingPlace).toBeDefined()
    const few = attack109(createBs12FinalPhysicalDemoState(number, 'then-two-support'))
    const done = few.pendingBattle ? applyGameCommand(few, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] }) : few
    expect(done.pendingAbilityEffect).toBeFalsy()
    expect(done.players[owner].hand).toHaveLength(3)
    expect(done.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
  })
  it('offers no Cookie when the hand has only plain Cookie/Item/Stage/Trap', () => {
    const attacked = attack109(createBs12FinalPhysicalDemoState(number, 'then-no-special'))
    const effect = attacked.players[owner].battleArea[0].card.attackEffects![0]
    expect(getEffectSelectionCandidates(attacked, { sourcePlayerId: owner, sourceInstanceId: 'final-source' }, effect)).toEqual([])
    if (attacked.pendingBattle) expect(() => select(attacked)).toThrow()
    expect(attacked.players[owner].hand).toHaveLength(4)
  })
  it.each([1, 5] as const)('AI level %s selects a legal printed Special Play card and completes placement', level => {
    const queued = select(attack109(createBs12FinalPhysicalDemoState(number, 'then-positive')))
    const done = takeAiStep(queued, owner, { level, seed: 7 }).state
    expect(done.pendingAbilityEffect).toBeFalsy()
    expect(done.players[owner].battleArea[1].hpCards.at(-1)?.instanceId).toMatch(/^final-hand-(special|non-arena-special)$/)
    expect(done.players[owner].battleArea[1].faceUpHpCardInstanceIds).toHaveLength(1)
  })
  it('the next actual opposing attack reveals the placed face-up Cookie first and opens its printed FLIP', () => {
    const queued = select(attack109(createBs12FinalPhysicalDemoState(number, 'then-positive')))
    let next = applyGameCommand(queued, { kind: 'resolve-place-hand-hp', playerId: owner, handCardInstanceId: 'final-hand-special' })
    for (let i = 0; i < 8 && (next.activePlayerId !== foe || next.phase !== 'main'); i++) next = applyGameCommand(next, { kind: 'advance-phase', playerId: next.activePlayerId })
    expect(next.activePlayerId).toBe(foe)
    expect(next.phase).toBe('main')
    next = applyGameCommand(next, { kind: 'declare-attack', playerId: foe, attackerInstanceId: 'final-enemy', targetInstanceId: 'final-companion', supportPaymentIds: next.players[foe].supportArea.map(s => s.card.instanceId) })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: owner })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: owner })
    expect(next.pendingBattle?.revealedHpCard?.instanceId).toBe('final-hand-special')
    expect(next.pendingBattle?.stage).toBe('flip')
    expect(next.players[owner].battleArea.find(c => c.card.instanceId === 'final-companion')?.hpCards).toHaveLength(4)
    assertBs12PhysicalFixture(next)
  })
})
