import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { beginAttack, resolveNextDamage, resolveFlip, skipTrap } from './battle'
import { applyGameCommand } from './commands'
import { createBs12AttackDemoState, createBs12EquipDemoState, createBs12EquippedAttackDemoState, parseTestStateConfig } from './demo'
import { takeAiStep } from './ai'
import { executeCardEffect } from './effects/execute'
import { getEffectSelectionCandidates } from './effects/targeting'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { assertBs12PhysicalFixture, printedFixtureCard } from './bs12-physical-fixtures.test-helpers'
import { materializeExtraDeckCookie } from './extra-deck'
import type { CookieCard, GameState } from './types'

const converted = convertOfficialCardToGameCard(candidate.cards.find(card => card.cardNumber === 'BS12-007') as OfficialCardRecord)
if (converted.status !== 'converted') throw new Error('BS12-007 adapter missing')
const mic = { ...converted.gameCard, instanceId: 'producer-mic' } as CookieCard
const convertedHost = convertOfficialCardToExtraDeckCard(candidate.cards.find(card => card.cardNumber === 'BS12-018') as OfficialCardRecord)
if (convertedHost.status !== 'converted') throw new Error('BS12-018 Shining Glitter missing')
const glitterHost = (instanceId: string) => materializeExtraDeckCookie({ ...convertedHost.extraDeckCard, instanceId })
const flip = (id: string) => printedFixtureCard('ST2-007', id)
const equippedState = () => {
  const base = createBs12EquippedAttackDemoState(true)
  const state = { ...base, activePlayerId: 'player-two' as const, players: {
    'player-one': { ...base.players['player-two'], id: 'player-one' as const },
    'player-two': { ...base.players['player-one'], id: 'player-two' as const },
  } }
  state.players['player-two'].battleArea[0] = { ...state.players['player-two'].battleArea[0],
    card: glitterHost('attacker'), equippedCards: [mic],
    hpCards: ['BS12-011', 'BS12-012', 'BS12-013', 'BS12-028'].map((number, i) => printedFixtureCard(number, 'attacker-hp-' + i)).concat([flip('attacker-top-hp')]) }
  state.players['player-one'].battleArea[0] = { ...state.players['player-one'].battleArea[0],
    card: { ...state.players['player-one'].battleArea[0].card, instanceId: 'defender' },
    hpCards: [printedFixtureCard('BS12-012', 'defender-bottom-0'), printedFixtureCard('BS12-013', 'defender-bottom-1'), ...Array.from({ length: 3 }, (_, i) => flip('defender-hp-' + i))] }
  assertBs12PhysicalFixture(state)
  return state
}
const attack = (state: ReturnType<typeof equippedState>) => beginAttack(state, 'attacker', 'defender', state.players['player-two'].supportArea.map(entry => entry.card.instanceId))
const skipRemainingAttackEffects = (state: GameState): GameState => {
  let next = state
  while (next.pendingBattle?.stage === 'attack-effect') {
    next = applyGameCommand(next, { kind: 'resolve-attack-effect', playerId: next.pendingBattle.attackerPlayerId, targetIds: [] })
  }
  return next
}

describe('BS12-007 printed branches and user-supplied HP/no-replacement ruling', () => {
  it.each([true, false])('prepared equipment=%s reveals four actual Chestnut FLIPs with the expected activation', equipped => {
    const before = createBs12EquippedAttackDemoState(equipped)
    const snapshot = structuredClone(before)
    expect(before.players['player-one'].battleArea[0].card).toMatchObject({ id: 'BS12-018', name: 'Shining Glitter Cookie', hp: 5, attack: 4, attackCost: 4 })
    expect(before.players['player-one'].supportArea).toHaveLength(4)
    expect(before.players['player-two'].battleArea[0].card).toMatchObject({ id: 'BS6-008', name: 'Sugar Swan Cookie', hp: 6 })
    expect(before.players['player-two'].battleArea[0].hpCards.slice(2).map(card => card.id)).toEqual(['ST2-007', 'ST2-007', 'ST2-007', 'ST2-007'])
    expect(before.players['player-one'].battleArea).toHaveLength(1)
    let state = applyGameCommand(before, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: 'bs12-007-host', targetInstanceId: 'bs12-007-defender',
      supportPaymentIds: before.players['player-one'].supportArea.map(entry => entry.card.instanceId) })
    expect(Boolean(state.pendingBattle?.flipBlocker)).toBe(equipped)
    for (let i = 0; i < 30 && (state.pendingBattle || state.pendingAbilityEffect || state.pendingDrawUpTo); i++) state = takeAiStep(state, 'player-two', { level: 2 }).state
    state = skipRemainingAttackEffects(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players['player-two'].discardPile.map(card => card.id)).toEqual(['ST2-007', 'ST2-007', 'ST2-007', 'ST2-007'])
    expect(state.players['player-two'].hand).toHaveLength(equipped ? 0 : 4)
    expect(state.players['player-two'].deck).toHaveLength(equipped ? 10 : 6)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
    expect(before).toEqual(snapshot)
  })
  it('ordinary attack pays R plus blue N and deals 1, independently of the blocked skill', () => {
    const state = createBs12AttackDemoState('BS12-007', true)
    const player = state.players['player-one']
    expect(player.supportArea.map(entry => entry.card.energyColor)).toEqual(['red', 'blue'])
    const after = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: player.battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: player.supportArea.map(entry => entry.card.instanceId) })
    expect(after.pendingBattle?.remainingDamage).toBe(1)
    expect(after.pendingBattle?.flipBlocker).toBeUndefined()
  })
  it('candidate fixture supplies printed energy and a legal host without exceeding two Cookies', () => {
    expect(parseTestStateConfig('?test-state=bs12-007:blocked', 'localhost')).toEqual({ kind: 'bs12-007', scenario: 'blocked' })
    expect(parseTestStateConfig('?test-state=bs12-007:blocked', 'example.com')).toBeNull()
    const state = createBs12EquipDemoState()
    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(state.players['player-one'].battleArea[1].card).toMatchObject({ id: 'BS12-018', name: 'Shining Glitter Cookie', hp: 5, attack: 4, attackCost: 4 })
    expect(state.players['player-one'].supportArea[0]).toMatchObject({ rested: false, card: { energyColor: 'red' } })
    expect(getCookieSkillUnavailableReason(state, 'player-one', 'bs12-007-source', 'activate')).toBeUndefined()
  })
  it('captures actual equipment source and blocks every opponent HP FLIP only in this battle', () => {
    const before = equippedState()
    const snapshot = structuredClone(before)
    let state = attack(before)
    expect(state.pendingBattle?.flipBlocker).toEqual({ playerId: 'player-one', sourceInstanceId: mic.instanceId, sourceCardName: mic.name })
    state = skipTrap(state, 'player-one')
    for (let i = 0; i < 3; i++) {
      state = resolveNextDamage(state)
      expect(state.pendingBattle?.stage).not.toBe('flip')
      expect(state.players['player-one'].hand).toEqual(before.players['player-one'].hand)
    }
    if (state.pendingBattle?.stage === 'damage') state = resolveNextDamage(state)
    state = skipRemainingAttackEffects(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players['player-one'].discardPile).toHaveLength(4)
    expect(state.flipDisabledUntilTurn ?? {}).toEqual({})
    expect(before).toEqual(snapshot)
  })
  it('an unequipped attack exposes FLIP and executes its draw', () => {
    const before = equippedState()
    before.players['player-two'].battleArea[0].equippedCards = []
    let state = resolveNextDamage(skipTrap(attack(before), 'player-one'))
    expect(state.pendingBattle?.flipBlocker).toBeUndefined()
    expect(state.pendingBattle?.stage).toBe('flip')
    state = resolveFlip(state, 'player-one', { activate: true })
    expect(state.pendingDrawUpTo).toMatchObject({ playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 })
    expect(state.players['player-one'].hand).toHaveLength(before.players['player-one'].hand.length + 1)
  })
  it('does not suppress the attacking player FLIP during damage to their Cookie', () => {
    const before = equippedState()
    const state = skipTrap(attack(before), 'player-one')
    const ownDamage = { ...state, pendingBattle: { ...state.pendingBattle!, damagePlayerId: 'player-two' as const, damageTargetInstanceId: 'attacker', remainingDamage: 1 } }
    expect(resolveNextDamage(ownDamage).pendingBattle?.stage).toBe('flip')
  })
  it('keeps the declared battle lock after equipment removal, and leaves the next attack unlocked', () => {
    const before = equippedState()
    let state = skipTrap(attack(before), 'player-one')
    state = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], battleArea: state.players['player-two'].battleArea.map(entry => ({ ...entry, equippedCards: [] })) } } }
    expect(resolveNextDamage(state).pendingBattle?.stage).toBe('damage')
    const next = equippedState()
    next.players['player-two'].battleArea[0].equippedCards = []
    expect(attack(next).pendingBattle?.flipBlocker).toBeUndefined()
  })
  it('rejects a forged opponent FLIP activation even when a flip window is supplied', () => {
    const state = skipTrap(attack(equippedState()), 'player-one')
    const forged = { ...state, pendingBattle: { ...state.pendingBattle!, stage: 'flip' as const, revealedHpCard: flip('forged-flip') } }
    expect(() => resolveFlip(forged, 'player-one', { activate: true })).toThrow('Producer Mic')
  })
  it.each([false, true])('equips with source rested=%s, trashes its HP and old gear without replacement', rested => {
    const state = equippedState()
    const host = glitterHost('host')
    const hp = (i: number) => printedFixtureCard(['BS12-011', 'BS12-012', 'BS12-013'][i], 'mic-hp-' + i)
    const hostHp = printedFixtureCard('BS12-028', 'host-hp')
    const oldGear = printedFixtureCard('BS12-007', 'old-gear')
    state.players['player-two'].supportArea = [{ card: printedFixtureCard('BS12-005', 'p2-support'), rested: false }]
    state.players['player-two'].battleArea = [
      { card: mic, hpCards: [hp(0), hp(1), hp(2)], rested, battleEntryId: 'mic:entry' },
      { card: host, hpCards: [hostHp], rested: false, battleEntryId: 'host:entry', equippedCards: [oldGear] },
    ]
    assertBs12PhysicalFixture(state)
    const effect = mic.skill!.effects[0]
    expect(getEffectSelectionCandidates(state, { sourcePlayerId: 'player-two', sourceInstanceId: mic.instanceId }, effect).map(entry => entry.instanceId)).toEqual(['host'])
    const snapshot = structuredClone(state)
    expect(canActivateCookieSkill(state, 'player-two', mic.instanceId, 'activate')).toBe(true)
    let after = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-two', sourceInstanceId: mic.instanceId, trigger: 'activate', paymentIds: ['p2-support'] })
    expect(after.players['player-two'].battleArea).toHaveLength(2)
    expect(after.players['player-two'].discardPile).toEqual([])
    after = applyGameCommand(after, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: ['host'] })
    expect(after.players['player-two'].battleArea).toHaveLength(1)
    expect(after.players['player-two'].battleArea[0]).toMatchObject({ card: host, rested: false, battleEntryId: 'host:entry', hpCards: [hostHp], equippedCards: [mic] })
    expect(after.players['player-two'].discardPile.map(card => card.instanceId)).toEqual(['mic-hp-0', 'mic-hp-1', 'mic-hp-2', 'old-gear'])
    expect(after.players['player-two'].supportArea[0].rested).toBe(true)
    expect(after.players['player-two'].deck).toEqual(state.players['player-two'].deck)
    expect(after.players['player-two'].hand).toEqual(state.players['player-two'].hand)
    expect(after.players['player-two'].breakArea).toEqual([])
    expect(after.pendingReplacement).toBeNull()
    expect(after.pendingOnPlay).toBe(state.pendingOnPlay)
    expect(after.departedCookieCounts).toEqual(state.departedCookieCounts)
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(canActivateCookieSkill(after, 'player-two', mic.instanceId, 'activate')).toBe(false)
    expect(after.commandLog?.at(-1)?.steps?.some(step => step.text.includes('Producer Mic') && step.text.includes('Shining Glitter Cookie'))).toBe(true)
    expect(state).toEqual(snapshot)
  })

  it('rejects zero, self, opponent and wrong-name hosts without changing the input', () => {
    const state = createBs12EquipDemoState()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'bs12-007-source' }
    const snapshot = structuredClone(state)
    for (const targets of [[], ['bs12-007-source'], [state.players['player-two'].battleArea[0].card.instanceId]]) {
      expect(() => executeCardEffect(state, context, mic.skill!.effects[0], targets)).toThrow()
    }
    const missingHost = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], battleArea: [state.players['player-one'].battleArea[0]] } } }
    expect(canActivateCookieSkill(missingHost, 'player-one', context.sourceInstanceId, 'activate')).toBe(false)
    expect(state).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn', 'no-host', 'wrong-host', 'opponent-host'] as const)('rejects %s before payment', scenario => {
    const state = createBs12EquipDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(canActivateCookieSkill(state, 'player-one', 'bs12-007-source', 'activate')).toBe(false)
    expect(() => applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'bs12-007-source', trigger: 'activate', paymentIds: ['bs12-007-payment'] })).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('moves actual FLIP HP into trash without activating them or allowing the equipped Cookie to activate', () => {
    const before = createBs12EquipDemoState()
    let after = applyGameCommand(before, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'bs12-007-source', trigger: 'activate', paymentIds: ['bs12-007-payment'] })
    after = applyGameCommand(after, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['bs12-007-host'] })
    expect(after.players['player-one'].discardPile.map(card => card.id)).toEqual(['ST2-007', 'ST2-007', 'ST2-007'])
    expect(after.players['player-one'].hand).toEqual(before.players['player-one'].hand)
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
    expect(after.pendingBattle).toBeNull()
    expect(after.pendingReplacement).toBeNull()
    expect(canActivateCookieSkill(after, 'player-one', 'bs12-007-source', 'activate')).toBe(false)
  })
})
