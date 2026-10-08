import { expect, it } from 'vitest'
import { createBs12CreamSodaDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import { assertBs12PhysicalFixture } from '../../game/bs12-physical-fixtures.test-helpers'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'

it.each(['BS12-072', 'BS12-072@1'] as const)('%s tells the player both hand payment and required bottom reveal before paying', number => {
  let state = createBs12CreamSodaDemoState('then-positive', number)
  assertBs12PhysicalFixture(state)
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-072-source', targetInstanceId: 'bs12-064-opponent', supportPaymentIds: ['r004-pay-0', 'r004-pay-1'] })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; i < 2; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
  const snapshot = structuredClone(state)
  const prompt = getOptionalCostAttackPrompt(state, 'player-one')
  expect(prompt?.costText).toBe('棄置 1 張手牌、展示 1 張牌庫底卡')
  expect(prompt?.discardHandCandidates.map(card => card.instanceId)).toEqual(['r004-cost'])
  expect(prompt?.needsTarget).toBe(false)
  expect(state).toEqual(snapshot)
})
