import { describe, expect, it } from 'vitest'
import { BS12_WEREWOLF_SCENARIOS, createBs12WerewolfDemoState, parseTestStateConfig } from './demo'
import type { Bs12WerewolfScenario } from './demo'
import { applyGameCommand } from './commands'
import { getBlockerCandidates, getBattleAttackEffectPrevention } from './battle'
import { executeCardEffect } from './effects'
import { describeCommandSteps } from './command-log'
import type { GameState, PlayerId } from './types'

const sourceId = 'bs12-089-source'
const initial = (scenario: Bs12WerewolfScenario = 'response', number: 'BS12-089' | 'BS12-089@1' = 'BS12-089') => createBs12WerewolfDemoState(number, scenario)
const block = (state: GameState, discardHandIds = ['bs12-089-cost']) => applyGameCommand(state, {
  kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: sourceId, paymentIds: [], discardHandIds,
})
const damage = (state: GameState): GameState => {
  let next = state
  for (let i = 0; next.pendingBattle?.stage === 'damage' && i < 10; i++) next = applyGameCommand(next, {
    kind: 'resolve-next-damage', playerId: next.pendingBattle.damagePlayerId ?? next.pendingBattle.defenderPlayerId,
  })
  return next
}
const attackEffect = (state: GameState) => applyGameCommand(state, {
  kind: 'resolve-attack-effect', playerId: state.pendingBattle!.attackerPlayerId, targetIds: [],
})

describe('089 printed Blocker cost', () => {
  it.each(['BS12-089', 'BS12-089@1'] as const)('pays one purple Arena hand card and keeps unrelated zones: %s', number => {
    const before = initial('response', number)
    const snapshot = structuredClone(before)
    expect(getBlockerCandidates(before, 'player-one').map(cookie => cookie.card.instanceId)).toEqual([sourceId])
    const after = block(before)
    expect(after.players['player-one'].hand).toEqual([])
    expect(after.players['player-one'].discardPile).toEqual([before.players['player-one'].hand[0]])
    expect(after.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
    expect(after.players['player-one'].battleArea).toEqual(before.players['player-one'].battleArea)
    expect(after.pendingBattle?.targetInstanceId).toBe(sourceId)
    expect(before).toEqual(snapshot)
  })
  it.each(['item-cost', 'stage-cost', 'trap-cost', 'rested-source'] as const)('allows any type and has no REST source cost: %s', scenario => {
    const before = initial(scenario)
    const after = block(before)
    expect(after.pendingBattle?.targetInstanceId).toBe(sourceId)
    expect(after.players['player-one'].battleArea).toEqual(before.players['player-one'].battleArea)
  })
  it.each(['wrong-color', 'non-arena', 'split-cost', 'no-hand'] as const)('requires color and keyword on the same card: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(getBlockerCandidates(before, 'player-one')).toEqual([])
    expect(() => block(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['unknown'], ['bs12-089-cost', 'bs12-089-cost'], ['bs12-089-cost', 'bs12-089-cost-two']].map(ids => ({ ids })))(
    'rejects invalid hand selection $ids', ({ ids }) => expect(() => block(initial('twice'), ids)).toThrow(),
  )
})

describe('089 participant-only attack effect prevention', () => {
  it.each(['BS12-089', 'BS12-089@1'] as const)('redirects ordinary three but suppresses the LV3 Then before its independent cost: %s', number => {
    const before = damage(block(initial('response', number)))
    expect(before.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 5])
    expect(before.pendingBattle?.stage).toBe('attack-effect')
    const snapshot = structuredClone(before)
    const after = attackEffect(before)
    expect(after.pendingOptionalCostAttack).toBeFalsy()
    expect(after.pendingBattle).toBeNull()
    expect(after.players['player-two'].hand).toEqual(before.players['player-two'].hand)
    expect(after.players['player-one'].battleArea).toEqual(before.players['player-one'].battleArea)
    expect(before).toEqual(snapshot)
  })
  it('also prevents direct attacks without activating or paying Blocker', () => {
    const start = initial('direct-attack')
    const damaged = damage(applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' }))
    const after = attackEffect(damaged)
    expect(after.pendingOptionalCostAttack).toBeFalsy()
    expect(after.players['player-one'].hand).toEqual(start.players['player-one'].hand)
    expect(after.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 5])
  })
  it('keeps the automatic during-battle restriction after the participating source faints', () => {
    const start = initial('faints')
    const damaged = damage(applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' }))
    expect(damaged.players['player-one'].breakArea.map(card => card.instanceId)).toContain(sourceId)
    const after = attackEffect(damaged)
    expect(after.pendingOptionalCostAttack).toBeFalsy()
    expect(after.players['player-two'].hand).toEqual(start.players['player-two'].hand)
    expect(after.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([5])
  })
  it.each(['unrelated', 'support-source', 'trash-source', 'break-source', 'hand-source'] as const)('does not globally suppress an unrelated battle: %s', scenario => {
    const before = damage(applyGameCommand(initial(scenario), { kind: 'skip-trap', playerId: 'player-one' }))
    const after = attackEffect(before)
    expect(after.pendingOptionalCostAttack).toMatchObject({ sourceInstanceId: 'bs12-089-attacker', cost: { discardHand: 1 } })
    expect(after.players['player-two'].hand).toEqual(before.players['player-two'].hand)
  })
  it.each(['lv2', 'lv5'] as const)('allows other printed levels to proceed normally: %s', scenario => {
    const before = damage(block(initial(scenario)))
    if (scenario === 'lv2') {
      const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [sourceId] })
      expect(after.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    } else {
      expect(before.players['player-two'].battleArea[0].card.level).toBe(5)
      expect(before.players['player-two'].battleArea[0].card.attackEffects).toBeUndefined()
      expect(before.players['player-one'].breakArea.map(card => card.instanceId)).toContain(sourceId)
      expect(before.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
      expect(before.pendingBattle).toBeNull()
    }
  })
  it('publicly identifies the prevention source rather than falsely reporting an unmet condition', () => {
    const before = damage(block(initial()))
    const command = { kind: 'resolve-attack-effect' as const, playerId: 'player-two' as const, targetIds: [] }
    const after = applyGameCommand(before, command)
    const steps = describeCommandSteps(before, after, command)
    expect(steps?.map(step => step.text).join(' ')).toMatch(/Werewolf Cookie.*LV\.3.*本次戰鬥.*無法發動/)
    expect(steps?.map(step => step.text).join(' ')).not.toMatch(/等待玩家選擇支付|條件不成立/)
  })
  it('does not suppress the normal attack or make the restriction a global own-side effect', () => {
    const start = initial('attack')
    const declared = applyGameCommand(start, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
      targetInstanceId: 'bs12-089-attacker', supportPaymentIds: ['bs12-089-payment-0', 'bs12-089-payment-1', 'bs12-089-payment-2'] })
    const step = applyGameCommand(applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-two' }), { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(step.pendingBattle?.attackEffectPreventions).toEqual([{ playerId: 'player-two', sourceInstanceId: sourceId, sourceCardName: 'Werewolf Cookie', level: 3 }])
    expect(getBattleAttackEffectPrevention(step, 'player-one')).toBeUndefined()
    const after = damage(step)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players['player-one'].supportArea.map(support => support.rested)).toEqual([true, true, true])
    expect(after.pendingBattle).toBeNull()
  })
  it('uses the actual effective attacking level, preserving the printed LV3 identity', () => {
    const before = damage(block(initial()))
    const lowered = executeCardEffect(before, { sourcePlayerId: 'player-two', sourceInstanceId: 'bs12-089-level-effect' }, { kind: 'set-cookie-level', level: 2, duration: 'this-turn', target: { side: 'self', min: 1, max: 1 } }, ['bs12-089-attacker'])
    expect(lowered.players['player-two'].battleArea[0].card.level).toBe(3)
    expect(getBattleAttackEffectPrevention(lowered, 'player-two')).toBeUndefined()
    expect(attackEffect(lowered).pendingOptionalCostAttack).toBeTruthy()
  })
  it('keeps ordinary zero damage and prevents Then after a genuine printed R REST-two Arena trap', () => {
    const before = initial('zero-damage')
    const trapped = applyGameCommand(before, { kind: 'play-trap', playerId: 'player-one', trapInstanceId: 'bs12-089-trap', paymentIds: ['bs12-089-payment-0'],
      positionCostTargetIds: [sourceId, 'bs12-089-ally'], effectTargets: [['bs12-089-attacker']], targetIds: [] })
    expect(trapped.pendingBattle?.remainingDamage).toBe(0)
    const after = attackEffect(damage(trapped))
    expect(after.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([5, 5])
    expect(after.players['player-two'].hand).toEqual(before.players['player-two'].hand)
    expect(after.pendingBattle).toBeNull()
  })
  it('last HP FLIP still offers its own payment and rescue before the LV3 Then is suppressed', () => {
    const start = initial('last-hp-flip')
    const flipped = damage(applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' }))
    expect(flipped.pendingBattle?.stage).toBe('flip')
    const rescue = applyGameCommand(flipped, { kind: 'resolve-flip', playerId: 'player-one', activate: true, targetIds: [sourceId], discardHandIds: ['bs12-089-cost'] })
    const completed = attackEffect(damage(rescue))
    expect(completed.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(completed.players['player-one'].hand).toEqual([])
    expect(completed.players['player-two'].hand).toEqual(start.players['player-two'].hand)
    expect(completed.pendingOptionalCostAttack).toBeFalsy()
  })
  it('uses the final defender after another real Blocker redirects away from Werewolf', () => {
    const start = initial('redirect-away')
    const redirected = applyGameCommand(start, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-089-ally', paymentIds: [], discardHandIds: [] })
    const before = damage(redirected)
    expect(before.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([5, 1])
    expect(getBattleAttackEffectPrevention(before, 'player-two')).toBeUndefined()
    expect(attackEffect(before).pendingOptionalCostAttack).toBeTruthy()
  })
  it('expires at battle end and does not suppress the next LV3 attacking Cookie in an unrelated battle', () => {
    const start = initial('second-battle')
    const after = attackEffect(damage(applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' })))
    expect(after.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 2])
    expect(after.pendingOptionalCostAttack?.sourceInstanceId).toBe('bs12-089-attacker-other')
  })
  it('can pay a second Blocker cost in the same turn and prevents Then even when the second attack makes the source faint', () => {
    const start = initial('second-response')
    const after = attackEffect(damage(block(start, ['bs12-089-cost-two'])))
    expect(after.players['player-one'].breakArea.map(card => card.instanceId)).toContain(sourceId)
    expect(after.players['player-one'].hand).toEqual([])
    expect(after.players['player-two'].hand).toEqual(start.players['player-two'].hand)
    expect(after.pendingOptionalCostAttack).toBeFalsy()
    expect(after.pendingBattle).toBeNull()
  })
  it('prevents automatic LV3 damage to all opponents as well as optional-cost attack effects', () => {
    const before = damage(block(initial('all-opponents')))
    expect(before.players['player-two'].supportArea.every(support => support.rested)).toBe(true)
    expect(before.pendingBattle?.attackEffects[0]).toMatchObject({ kind: 'damage-all', amount: 1, side: 'opponent', sequential: true,
      target: { side: 'opponent', min: 1, max: 2 }, condition: { kind: 'all-support-rested', side: 'self' } })
    const after = attackEffect(before)
    expect(after.players['player-one'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 5])
    expect(after.pendingBattle).toBeNull()
  })
})

describe('089 candidate fixtures', () => {
  it.each(BS12_WEREWOLF_SCENARIOS)('uses only legitimate card identities and copy counts: %s', scenario => {
    const state = initial(scenario)
    expect(parseTestStateConfig(`?test-state=bs12-089:BS12-089:${scenario}`, 'localhost')).toMatchObject({ kind: 'bs12-089', scenario })
    for (const playerId of ['player-one', 'player-two'] as PlayerId[]) {
      const player = state.players[playerId]
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      const cards = [...player.hand, ...player.deck, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(support => support.card),
        ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts].filter(([, count]) => count > 4)).toEqual([])
      expect(cards.some(card => card.id.startsWith('test-'))).toBe(false)
    }
  })
})
