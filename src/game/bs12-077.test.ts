import { describe, expect, it } from 'vitest'
import { createBs12SpotlightFanDemoState as create, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getBlockerCandidates, getTrapCandidates, hasActivatableFlipEffect, isBlockDisabled } from './battle'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import type { GameState } from './types'

const actor = 'player-one' as const
const enemy = 'player-two' as const
const declare = (state: GameState, source = 'bs12-077-host', ids = state.players[actor].supportArea.filter(s => !s.rested).map(s => s.card.instanceId)) => applyGameCommand(state, {
  kind: 'declare-attack', playerId: actor, attackerInstanceId: source, targetInstanceId: 'bs12-077-opponent', supportPaymentIds: ids,
})
const finish = (state: GameState) => {
  let next = applyGameCommand(state, { kind: 'skip-trap', playerId: enemy })
  for (let i = 0; next.pendingBattle && i < 8; i++) {
    if (next.pendingBattle.stage === 'damage') next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: enemy })
    else if (next.pendingBattle.stage === 'attack-effect') next = applyGameCommand(next, { kind: 'resolve-attack-effect', playerId: actor, targetIds: [] })
    else break
  }
  return next
}

describe('077 attached-state isolation; unresolved Equip stays blocked', () => {
  it('captures named-host battle prevention and rejects forged Blocker without spending its REST', () => {
    const before = create()
    const snapshot = structuredClone(before)
    const after = declare(before)
    expect(after.pendingBattle?.blockerPrevention).toEqual({ playerId: enemy, sourceInstanceId: 'bs12-077-source', sourceCardName: 'Spotlight Fan' })
    expect(isBlockDisabled(after, enemy)).toBe(true)
    expect(isBlockDisabled(after, actor)).toBe(false)
    expect(getBlockerCandidates(after, enemy)).toEqual([])
    expect(after.pendingBattle?.flipBlocker).toBeUndefined()
    expect(after.pendingBattle?.trapsDisabled).toBeUndefined()
    expect(() => applyGameCommand(after, { kind: 'play-blocker', playerId: enemy, sourceInstanceId: 'bs12-077-blocker', paymentIds: [] })).toThrow(/Spotlight Fan.*本次戰鬥.*Blocker/)
    expect(after.players[enemy]).toEqual(before.players[enemy])
    expect(before).toEqual(snapshot)
  })
  it.each(['no-equipment', 'wrong-host', 'other-attacker'] as const)('allows an actual Blocker outside the named equipped attack: %s', scenario => {
    const before = create(scenario)
    const after = declare(before, scenario === 'other-attacker' ? 'bs12-077-other-attacker' : 'bs12-077-host',
      before.players[actor].supportArea.slice(0, scenario === 'no-equipment' ? 1 : 2).map(s => s.card.instanceId))
    expect(after.pendingBattle?.blockerPrevention).toBeUndefined()
    expect(getBlockerCandidates(after, enemy).map(c => c.card.instanceId)).toEqual(['bs12-077-blocker'])
    const redirected = applyGameCommand(after, { kind: 'play-blocker', playerId: enemy, sourceInstanceId: 'bs12-077-blocker', paymentIds: [] })
    expect(redirected.pendingBattle?.targetInstanceId).toBe('bs12-077-blocker')
    expect(redirected.players[enemy].battleArea[1].rested).toBe(true)
  })
  it('expires before another Cookie attacks in the same turn without installing a turn-wide restriction', () => {
    const before = create('other-attacker')
    const first = declare(before, 'bs12-077-host', ['bs12-077-payment-0'])
    const finished = finish(first)
    expect(finished.pendingBattle).toBeNull()
    expect(isBlockDisabled(finished, enemy)).toBe(false)
    expect(finished.blockDisabledUntilTurn).toBeUndefined()
    const second = declare(finished, 'bs12-077-other-attacker')
    expect(second.turnNumber).toBe(first.turnNumber)
    expect(second.pendingBattle?.blockerPrevention).toBeUndefined()
    expect(getBlockerCandidates(second, enemy)).toHaveLength(1)
  })
  it('cannot reuse a REST-cost Blocker when another Cookie attacks in the same turn', () => {
    const before = create('other-attacker')
    const hostWithoutEquipment = { ...before, players: { ...before.players, [actor]: { ...before.players[actor],
      battleArea: before.players[actor].battleArea.map(c => ({ ...c, equippedCards: [] })),
    } } }
    const first = declare(hostWithoutEquipment, 'bs12-077-host', ['bs12-077-payment-0'])
    const redirected = applyGameCommand(first, { kind: 'play-blocker', playerId: enemy, sourceInstanceId: 'bs12-077-blocker', paymentIds: [] })
    let finished = redirected
    for (let i = 0; finished.pendingBattle && i < 8; i++) {
      finished = finished.pendingBattle.stage === 'damage'
        ? applyGameCommand(finished, { kind: 'resolve-next-damage', playerId: enemy })
        : applyGameCommand(finished, { kind: 'resolve-attack-effect', playerId: actor, targetIds: [] })
    }
    expect(finished.pendingBattle).toBeNull()
    const second = declare(finished, 'bs12-077-other-attacker')
    expect(second.pendingBattle?.blockerPrevention).toBeUndefined()
    expect(getBlockerCandidates(second, enemy)).toEqual([])
    const snapshot = structuredClone(second)
    expect(() => applyGameCommand(second, { kind: 'play-blocker', playerId: enemy, sourceInstanceId: 'bs12-077-blocker', paymentIds: [] })).toThrow(/REST cost requires an active/)
    expect(second).toEqual(snapshot)
  })
  it('keeps a real payable Trap available to the defender while Blocker is prevented', () => {
    const declared = create('defender-trap')
    expect(isBlockDisabled(declared, actor)).toBe(true)
    expect(getTrapCandidates(declared, actor).map(c => c.instanceId)).toEqual(['bs12-077-trap'])
  })
  it('has no Blocker candidate when its printed REST cost cannot be paid', () => {
    const declared = create('defender-rested-blocker')
    expect(declared.pendingBattle?.blockerPrevention).toBeUndefined()
    expect(getBlockerCandidates(declared, actor)).toEqual([])
    expect(() => applyGameCommand(declared, { kind: 'play-blocker', playerId: actor, sourceInstanceId: 'bs12-077-blocker', paymentIds: [] })).toThrow(/REST cost requires an active/)
  })
  it('does not disable a funded FLIP on the attacked Cookie', () => {
    const declared = declare(create('flip'))
    const skipped = applyGameCommand(declared, { kind: 'skip-trap', playerId: enemy })
    const flipped = applyGameCommand(skipped, { kind: 'resolve-next-damage', playerId: enemy })
    expect(flipped.pendingBattle?.stage).toBe('flip')
    expect(flipped.pendingBattle?.flipBlocker).toBeUndefined()
    const revealed = flipped.pendingBattle?.revealedHpCard
    expect(revealed?.instanceId).toBe('bs12-077-flip')
    if (!revealed?.flip) throw new Error('Missing funded FLIP')
    expect(hasActivatableFlipEffect(flipped, revealed.flip, { sourcePlayerId: enemy, sourceInstanceId: revealed.instanceId }, 'bs12-077-opponent')).toBe(true)
    const activated = applyGameCommand(flipped, { kind: 'resolve-flip', playerId: enemy, activate: true,
      discardHandIds: ['bs12-077-flip-cost'], targetIds: ['bs12-077-opponent'] })
    expect(activated.players[enemy].hand).toEqual([])
    expect(activated.players[enemy].battleArea[0].hpCards).toHaveLength(4)
  })
  it('naturally equips after printed deployment and trashes source HP without replacement', () => {
    const before = create('equip-blocked'), snapshot = structuredClone(before)
    const source = before.players['player-one'].battleArea.find(c => c.card.instanceId === 'bs12-077-source')!
    const host = before.players['player-one'].battleArea.find(c => c.card.instanceId === 'bs12-077-host')!
    expect(canActivateCookieSkill(before, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    expect(getCookieSkillUnavailableReason(before, 'player-one', source.card.instanceId, 'activate')).toBeUndefined()
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: ['bs12-077-payment-0'] })
    expect(paid.players['player-one'].battleArea).toHaveLength(2)
    const equipped = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [host.card.instanceId] })
    expect(equipped.players['player-one'].battleArea).toHaveLength(1)
    expect(equipped.players['player-one'].battleArea[0].hpCards).toEqual(host.hpCards)
    expect(equipped.players['player-one'].battleArea[0].equippedCards).toEqual([source.card])
    expect(equipped.players['player-one'].discardPile).toEqual(source.hpCards)
    expect(equipped.pendingReplacement).toBeNull()
    expect(equipped.players['player-one'].breakArea).toEqual([])
    expect(before).toEqual(snapshot)
  })
  it('normally deploys three HP without triggering the unresolved Equip', () => {
    const before = create('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId: actor, instanceId: 'bs12-077-source' })
    expect(after.players[actor].battleArea[0].hpCards).toEqual(before.players[actor].deck.slice(0, 3))
    expect(after.pendingOnPlay).toBeNull()
  })
  it.each(['attack', 'mixed-energy'] as const)('pays actual PN and deals one ordinary damage: %s', scenario => {
    const before = create(scenario)
    const after = finish(declare(before, 'bs12-077-source'))
    expect(after.players[enemy].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players[actor].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players[actor].supportArea.every(s => s.rested)).toBe(true)
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('rejects illegal ordinary PN payment or timing: %s', scenario => {
    const before = create(scenario)
    expect(() => declare(before, 'bs12-077-source')).toThrow()
  })
  it.each(['equipped', 'no-equipment', 'wrong-host', 'other-attacker', 'defender', 'defender-no-equipment', 'defender-rested-blocker', 'defender-trap', 'flip', 'equip-blocked', 'deploy', 'attack', 'mixed-energy', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('isolates a local fixture with legal capacity and unique physical identities: %s', scenario => {
    expect(parseTestStateConfig(`?test-state=bs12-077:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-077', scenario })
    expect(parseTestStateConfig(`?test-state=bs12-077:${scenario}`, 'example.com')).toBeNull()
    const state = create(scenario)
    const ids = Object.values(state.players).flatMap(p => {
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      return [...p.hand, ...p.deck, ...p.breakArea, ...p.discardPile, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards, ...(c.equippedCards ?? [])])].map(c => c.instanceId)
    })
    expect(new Set(ids).size).toBe(ids.length)
  })
})
