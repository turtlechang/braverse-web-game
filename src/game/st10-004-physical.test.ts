import { describe, expect, it } from 'vitest'
import { getBlockerCandidates } from './battle'
import { applyGameCommand } from './commands'
import {
  createSt10004PreviewState,
  rawSt10004,
  st10004Zones,
  type St10004Scenario,
} from './st10-004-demo'
import type { GameState, PlayerId } from './types'

const defender = 'player-one' as const
const attackerPlayer = 'player-two' as const

const settleAttack = (state: GameState, defendingPlayer: PlayerId): GameState => {
  let current = state.pendingBattle?.stage === 'trap'
    ? applyGameCommand(state, { kind: 'skip-trap', playerId: defendingPlayer })
    : state
  for (let guard = 0; guard < 8 && current.pendingBattle?.stage === 'damage'; guard += 1) {
    current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: defendingPlayer })
  }
  return current
}

const candidateIds = (state: GameState): string[] =>
  getBlockerCandidates(state, defender).map(candidate => candidate.card.id)

describe('ST10-004 original physical Blocker flow', () => {
  it('uses the printed card identity and legal original sixty-card decks', () => {
    const state = createSt10004PreviewState()
    const printed = rawSt10004()
    expect(printed).toMatchObject({ cardNumber: 'ST10-004', name: 'Wizard Cookie', color: 'PURPLE', level: 1, hp: 3 })
    expect(printed.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(state.pendingBattle).toMatchObject({ stage: 'trap', declaredDamage: 1 })

    const allIds = new Set<string>()
    for (const playerId of [defender, attackerPlayer]) {
      const cards = st10004Zones(state, playerId)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        expect(allIds.has(card.instanceId)).toBe(false)
        allIds.add(card.instanceId)
      }
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(allIds).toHaveLength(120)
  })

  it('pays one purple support and redirects a real ST1-011 attack to Wizard Cookie', () => {
    const initial = createSt10004PreviewState('blocker')
    const blocker = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST10-004')!
    const originalTarget = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST6-003')!
    const attackSource = initial.players[attackerPlayer].battleArea.find(cookie => cookie.card.id === 'ST1-011')!
    const payment = initial.players[defender].supportArea[0]!.card

    expect(initial.pendingBattle).toMatchObject({
      stage: 'trap',
      attackerInstanceId: attackSource.card.instanceId,
      targetInstanceId: originalTarget.card.instanceId,
      declaredDamage: 1,
    })
    expect(payment.energyColor).toBe('purple')
    expect(candidateIds(initial)).toEqual(['ST10-004'])

    const redirected = applyGameCommand(initial, {
      kind: 'play-blocker',
      playerId: defender,
      sourceInstanceId: blocker.card.instanceId,
      paymentIds: [payment.instanceId],
    })
    expect(redirected.pendingBattle).toMatchObject({ stage: 'damage', targetInstanceId: blocker.card.instanceId })
    expect(redirected.players[defender].supportArea[0]?.rested).toBe(true)

    const settled = settleAttack(redirected, defender)
    expect(settled.players[defender].battleArea.find(cookie => cookie.card.instanceId === originalTarget.card.instanceId)?.hpCards)
      .toHaveLength(originalTarget.card.hp)
    expect(settled.players[defender].battleArea.find(cookie => cookie.card.instanceId === blocker.card.instanceId)?.hpCards)
      .toHaveLength(blocker.card.hp - 1)
    expect(settled.pendingBattle).toBeNull()
  })

  it('does not offer or accept Blocker without purple energy, while the declared attack still resolves', () => {
    const initial = createSt10004PreviewState('no-purple-payment')
    const before = structuredClone(initial)
    const blocker = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST10-004')!
    const originalTarget = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST6-003')!
    const payment = initial.players[defender].supportArea[0]!.card

    expect(payment.energyColor).not.toBe('purple')
    expect(candidateIds(initial)).toEqual([])
    expect(() => applyGameCommand(initial, {
      kind: 'play-blocker', playerId: defender,
      sourceInstanceId: blocker.card.instanceId,
      paymentIds: [payment.instanceId],
    })).toThrow()
    expect(initial).toEqual(before)

    const settled = settleAttack(initial, defender)
    expect(settled.players[defender].battleArea.find(cookie => cookie.card.instanceId === originalTarget.card.instanceId)?.hpCards)
      .toHaveLength(originalTarget.card.hp - 1)
    expect(settled.players[defender].battleArea.find(cookie => cookie.card.instanceId === blocker.card.instanceId)?.hpCards)
      .toHaveLength(blocker.card.hp)
    expect(settled.players[defender].supportArea[0]?.rested).toBe(false)
    expect(settled.pendingBattle).toBeNull()
  })

  it('does not let Wizard Cookie redirect an attack already targeting itself', () => {
    const initial = createSt10004PreviewState('direct-target')
    const blocker = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST10-004')!
    const payment = initial.players[defender].supportArea[0]!.card
    expect(initial.pendingBattle?.targetInstanceId).toBe(blocker.card.instanceId)
    expect(candidateIds(initial)).toEqual([])
    expect(() => applyGameCommand(initial, {
      kind: 'play-blocker', playerId: defender,
      sourceInstanceId: blocker.card.instanceId,
      paymentIds: [payment.instanceId],
    })).toThrow()
    const settled = settleAttack(initial, defender)
    expect(settled.players[defender].battleArea.find(cookie => cookie.card.instanceId === blocker.card.instanceId)?.hpCards)
      .toHaveLength(blocker.card.hp - 1)
    expect(settled.players[defender].supportArea[0]?.rested).toBe(false)
    expect(settled.pendingBattle).toBeNull()
  })

  it('pays the printed purple-plus-neutral attack and deals one normal damage', () => {
    const initial = createSt10004PreviewState('normal-attack')
    const attacker = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST10-004')!
    const target = initial.players[attackerPlayer].battleArea.find(cookie => cookie.card.id === 'ST6-003')!
    const purple = initial.players[defender].supportArea.find(support => support.card.id === 'BS9-096')!.card
    const neutral = initial.players[defender].supportArea.find(support => support.card.id === 'ST1-011')!.card

    expect(initial.activePlayerId).toBe(defender)
    expect(attacker.card.attackEnergyCost).toEqual({ purple: 1, neutral: 1 })
    expect(purple.energyColor).toBe('purple')
    expect(initial.players[defender].supportArea.map(support => support.card.instanceId)).toEqual([
      purple.instanceId,
      neutral.instanceId,
    ])

    const declared = applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: defender,
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: [purple.instanceId, neutral.instanceId],
    })
    expect(declared.pendingBattle?.attackerInstanceId).toBe(attacker.card.instanceId)
    expect(declared.players[defender].battleArea.find(cookie => cookie.card.instanceId === attacker.card.instanceId)?.rested)
      .toBe(true)
    expect(declared.players[defender].supportArea.every(support => support.rested)).toBe(true)

    const settled = settleAttack(declared, attackerPlayer)
    expect(settled.players[attackerPlayer].battleArea.find(cookie => cookie.card.instanceId === target.card.instanceId)?.hpCards)
      .toHaveLength(target.card.hp - 1)
    expect(settled.players[defender].battleArea.find(cookie => cookie.card.instanceId === attacker.card.instanceId)?.hpCards)
      .toHaveLength(attacker.card.hp)
    expect(settled.pendingBattle).toBeNull()
  })

  it('blocks the printed attack when only its purple symbol can be paid', () => {
    const initial = createSt10004PreviewState('normal-attack-insufficient-energy')
    const before = structuredClone(initial)
    const attacker = initial.players[defender].battleArea.find(cookie => cookie.card.id === 'ST10-004')!
    const target = initial.players[attackerPlayer].battleArea.find(cookie => cookie.card.id === 'ST6-003')!
    const purple = initial.players[defender].supportArea[0]!.card

    expect(initial.activePlayerId).toBe(defender)
    expect(initial.players[defender].supportArea).toHaveLength(1)
    expect(purple.energyColor).toBe('purple')
    expect(() => applyGameCommand(initial, {
      kind: 'declare-attack',
      playerId: defender,
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: [purple.instanceId],
    })).toThrow()
    expect(initial).toEqual(before)
    expect(initial.pendingBattle).toBeNull()
    expect(attacker.rested).toBe(false)
  })

  it.each(['blocker', 'no-purple-payment', 'direct-target'] as const)(
    'builds the physical attack before the local decision for %s', (scenario: St10004Scenario) => {
      const state = createSt10004PreviewState(scenario)
      expect(state.pendingBattle?.stage).toBe('trap')
      expect(state.pendingBattle?.attackerPlayerId).toBe(attackerPlayer)
      expect(state.pendingBattle?.defenderPlayerId).toBe(defender)
    },
  )

  it.each(['normal-attack', 'normal-attack-insufficient-energy'] as const)(
    'builds the printed Wizard Cookie attack route with physical resources for %s', (scenario: St10004Scenario) => {
      const state = createSt10004PreviewState(scenario)
      expect(state.pendingBattle).toBeNull()
      expect(state.activePlayerId).toBe(defender)
      expect(state.players[defender].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-004'])
      expect(state.players[attackerPlayer].battleArea.map(cookie => cookie.card.id)).toEqual(['ST6-003'])
    },
  )
})
