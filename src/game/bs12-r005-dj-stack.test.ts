import { expect, it } from 'vitest'
import { createBs12DjDemoState } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem, getItemActivateDiscardRequirement } from './card-abilities'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'
const owner = 'player-one' as const
const command = { kind: 'begin-play-item' as const, playerId: owner, instanceId: 'bs12-082-item', paymentIds: ['bs12-082-payment-0'] }
it('both real DJ sources require two new discards on each successive Item', () => {
  let state = createBs12DjDemoState('multi-twice')
  assertBs12PhysicalFixture(state)
  for (const [index, cardIds] of [['bs12-082-tax', 'r005-second-tax'], ['bs12-082-tax-two', 'r005-fourth-tax']].entries()) {
    const pending = applyGameCommand(state, { ...command, instanceId: index ? 'bs12-082-item-two' : command.instanceId, paymentIds: [`bs12-082-payment-${index}`] })
    expect(pending.players).toEqual(state.players)
    expect(pending.pendingOpponentHandDiscard?.count).toBe(2)
    state = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    assertBs12PhysicalFixture(state)
  }
  expect(state.players[owner].hand).toEqual([])
  expect(state.players[owner].discardPile).toHaveLength(6)
  expect(state.players[owner].supportArea.every(card => card.rested)).toBe(true)
  expect(state.itemsActivatedThisTurn?.[owner]).toBe(2)
})
it.each(['multi-positive', 'multi-cookie', 'multi-item', 'multi-stage', 'multi-trap', 'multi-rested'] as const)('each real DJ requires one distinct additional hand card: %s', scenario => {
  const before = createBs12DjDemoState(scenario)
  assertBs12PhysicalFixture(before)
  expect(getItemActivateDiscardRequirement(before, owner)?.count).toBe(2)
  expect(canPlayItem(before, owner, command.instanceId)).toBe(true)
  const pending = applyGameCommand(before, command)
  expect(pending.players).toEqual(before.players)
  expect(pending.pendingOpponentHandDiscard).toMatchObject({ count: 2, excludedCardIds: [command.instanceId] })
  const paid = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: ['bs12-082-tax', 'r005-second-tax'] })
  expect(paid.players[owner].hand).toEqual([])
  expect(paid.players[owner].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-tax', 'r005-second-tax', command.instanceId])
  expect(paid.players[owner].supportArea[0].rested).toBe(true)
  assertBs12PhysicalFixture(paid)
})
it('preserves the old two-DJ one-card case as an illegal declaration', () => {
  const before = createBs12DjDemoState('multiple-source'), snapshot = structuredClone(before)
  expect(getItemActivateDiscardRequirement(before, owner)?.count).toBe(2)
  expect(canPlayItem(before, owner, command.instanceId)).toBe(false)
  expect(() => applyGameCommand(before, command)).toThrow()
  expect(before).toEqual(snapshot)
})
it('rejects fewer, duplicate, item itself and wrong-zone additional cards before paying', () => {
  const pending = applyGameCommand(createBs12DjDemoState('multi-positive'), command), snapshot = structuredClone(pending)
  for (const ids of [[], ['bs12-082-tax'], ['bs12-082-tax', 'bs12-082-tax'], ['bs12-082-tax', command.instanceId], ['bs12-082-tax', 'bs12-082-payment-0']]) expect(() => applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: ids })).toThrow()
  expect(() => applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: 'player-two', cardIds: ['bs12-082-tax', 'r005-second-tax'] })).toThrow()
  expect(pending).toEqual(snapshot)
  const cancelled = applyGameCommand(pending, { kind: 'cancel-item-activation', playerId: owner })
  expect(cancelled.players).toEqual(pending.players)
})
it('keeps the printed Arena-to-Break cost separate from both DJ discards', () => {
  const before = createBs12DjDemoState('multi-original')
  assertBs12PhysicalFixture(before)
  const pending = applyGameCommand(before, { ...command, handToBreakAreaIds: ['bs12-082-original-cost'] })
  expect(pending.pendingOpponentHandDiscard?.excludedCardIds).toEqual(['bs12-082-item', 'bs12-082-original-cost'])
  expect(() => applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: ['bs12-082-tax', 'bs12-082-original-cost'] })).toThrow()
  const paid = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: owner, cardIds: ['bs12-082-tax', 'r005-second-tax'] })
  expect(paid.players[owner].breakArea.map(c => c.instanceId)).toEqual(['bs12-082-original-cost'])
  expect(paid.players[owner].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-tax', 'r005-second-tax', 'bs12-082-item'])
  assertBs12PhysicalFixture(paid)
})
