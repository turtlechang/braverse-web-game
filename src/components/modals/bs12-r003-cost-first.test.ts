import { expect, it } from 'vitest'
import { createBs12ClottedDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { assertBs12PhysicalFixture } from '../../game/bs12-physical-fixtures.test-helpers'
it.each(['BS12-036', 'BS12-036@1'] as const)('%s selects only another own battle Arena cost before opening public Break targets', number => {
  let game = createBs12ClottedDemoState('then-positive', number)
  assertBs12PhysicalFixture(game)
  game = applyGameCommand(game, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-036-source', targetInstanceId: 'bs12-036-opponent', supportPaymentIds: game.players['player-one'].supportArea.map(s => s.card.instanceId) })
  game = applyGameCommand(game, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; i < 3; i++) game = applyGameCommand(game, { kind: 'resolve-next-damage', playerId: 'player-two' })
  game = applyGameCommand(game, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
  const snapshot = structuredClone(game), prompt = getOptionalCostAttackPrompt(game, 'player-one')!
  expect(prompt.cookieBreakCandidates.map(c => c.instanceId)).toEqual(['bs12-036-ally'])
  expect(prompt.needsTarget).toBe(false)
  expect(prompt.costText).toMatch(/己方戰鬥區.*來源以外.*支付後再選擇效果目標/)
  expect(prompt.costText).not.toContain('手牌')
  expect(game).toEqual(snapshot)
})
