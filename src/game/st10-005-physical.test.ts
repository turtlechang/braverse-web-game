import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createSt10005PreviewState,
  rawSt10005,
  st10005Zones,
} from './st10-005-demo'
import type { GameState, PlayerId } from './types'

const one = 'player-one' as const
const two = 'player-two' as const

const cookie = (state: GameState, playerId: PlayerId, cardNumber: string) =>
  state.players[playerId].battleArea.find(entry => entry.card.id === cardNumber)!

const settleEffectDamage = (state: GameState): GameState => {
  let current = state
  if (current.pendingBattle?.stage === 'trap') {
    current = applyGameCommand(current, {
      kind: 'skip-trap',
      playerId: current.pendingBattle.defenderPlayerId,
    })
  }
  for (let attempt = 0; attempt < 8 && current.pendingBattle?.stage === 'damage'; attempt += 1) {
    current = applyGameCommand(current, {
      kind: 'resolve-next-damage',
      playerId: current.pendingBattle.damagePlayerId ?? current.pendingBattle.defenderPlayerId,
    })
  }
  return current
}

describe('ST10-005 Dreamcatcher physical On Play', () => {
  it('uses original sixty-card decks, exact printed attributes, Moonlight, and legal opponent target', () => {
    const state = createSt10005PreviewState('on-play-moonlight')
    const printed = rawSt10005()
    expect(printed).toMatchObject({
      cardNumber: 'ST10-005', name: 'Dreamcatcher', type: 'cookie', color: 'PURPLE', level: 1, hp: 2,
    })
    expect(printed.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(state.activePlayerId).toBe(one)
    expect(state.phase).toBe('main')
    expect(state.players[one].hand.map(card => card.id)).toEqual(['ST10-005', 'ST1-011'])
    expect(cookie(state, one, 'ST10-002').card.name).toBe('Moonlight Cookie')
    expect(cookie(state, two, 'ST6-003').card.name).toBe('Devil Cookie')

    const allIds = new Set<string>()
    for (const playerId of [one, two]) {
      const cards = st10005Zones(state, playerId)
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
      for (const entry of state.players[playerId].battleArea) {
        expect(entry.hpCards).toHaveLength(entry.card.hp)
      }
    }
    expect(allIds).toHaveLength(120)
  })

  it('pays exactly one physical hand card, then deals the printed effect damage to the opponent Cookie', () => {
    const initial = createSt10005PreviewState('on-play-moonlight')
    const source = initial.players[one].hand.find(card => card.id === 'ST10-005')!
    const discardCost = initial.players[one].hand.find(card => card.id === 'ST1-011')!
    const target = cookie(initial, two, 'ST6-003')
    const targetHp = target.hpCards.length

    let current = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: one, instanceId: source.instanceId,
    })
    expect(current.pendingOnPlay).toMatchObject({ playerId: one, sourceInstanceId: source.instanceId })
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill', playerId: one, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [], discardHandIds: [discardCost.instanceId],
    })
    expect(current.players[one].discardPile.map(card => card.instanceId)).toEqual([discardCost.instanceId])
    expect(current.players[one].hand).toEqual([])
    expect(current.pendingOnPlay).toBeNull()
    expect(current.pendingAbilityEffect?.effects).toMatchObject([{
      kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 },
      condition: { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Moonlight Cookie' },
    }])

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [target.card.instanceId],
    })
    current = settleEffectDamage(current)
    expect(cookie(current, two, 'ST6-003').hpCards).toHaveLength(targetHp - 1)
    expect(cookie(current, one, 'ST10-005').hpCards).toHaveLength(2)
    expect(current.pendingBattle).toBeNull()
    expect(current.pendingAbilityEffect ?? null).toBeNull()
  })

  it('still pays the printed discard before Moonlight is checked; the condition-failed effect does no damage', () => {
    const initial = createSt10005PreviewState('on-play-no-moonlight')
    const source = initial.players[one].hand.find(card => card.id === 'ST10-005')!
    const discardCost = initial.players[one].hand.find(card => card.id === 'ST1-011')!
    const target = cookie(initial, two, 'ST6-003')
    const targetHp = target.hpCards.length

    let current = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: one, instanceId: source.instanceId,
    })
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill', playerId: one, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [], discardHandIds: [discardCost.instanceId],
    })
    expect(current.players[one].discardPile.map(card => card.instanceId)).toEqual([discardCost.instanceId])
    expect(current.players[one].battleArea.map(entry => entry.card.name)).not.toContain('Moonlight Cookie')
    expect(cookie(current, two, 'ST6-003').hpCards).toHaveLength(targetHp)
    expect(current.pendingBattle).toBeNull()
    expect(current.pendingAbilityEffect ?? null).toBeNull()
  })

  it('allows choosing zero opponents while Moonlight is present', () => {
    const initial = createSt10005PreviewState('on-play-moonlight')
    const source = initial.players[one].hand.find(card => card.id === 'ST10-005')!
    const discardCost = initial.players[one].hand.find(card => card.id === 'ST1-011')!
    const target = cookie(initial, two, 'ST6-003')
    const targetHp = target.hpCards.length

    let current = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: one, instanceId: source.instanceId,
    })
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill', playerId: one, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [], discardHandIds: [discardCost.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [],
    })
    current = settleEffectDamage(current)

    expect(cookie(current, two, 'ST6-003').hpCards).toHaveLength(targetHp)
    expect(current.pendingBattle).toBeNull()
    expect(current.pendingAbilityEffect ?? null).toBeNull()
  })

  it('rejects On Play when no physical hand card can pay the discard cost without changing state', () => {
    const initial = createSt10005PreviewState('on-play-no-discard-card')
    const source = initial.players[one].hand[0]!
    const deployed = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: one, instanceId: source.instanceId,
    })
    const beforePayment = structuredClone(deployed)
    expect(() => applyGameCommand(deployed, {
      kind: 'begin-activate-skill', playerId: one, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [], discardHandIds: [],
    })).toThrow()
    expect(deployed).toEqual(beforePayment)
  })
})

describe('ST10-005 printed purple attack', () => {
  it('pays one purple support and settles exactly one ordinary damage', () => {
    const initial = createSt10005PreviewState('normal-attack')
    const attacker = cookie(initial, one, 'ST10-005')
    const target = cookie(initial, two, 'ST6-003')
    const payment = initial.players[one].supportArea[0]!.card
    const targetHp = target.hpCards.length
    expect(attacker.card.attackEnergyCost).toEqual({ purple: 1 })
    expect(payment.energyColor).toBe('purple')

    let current = applyGameCommand(initial, {
      kind: 'declare-attack', playerId: one, attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId, supportPaymentIds: [payment.instanceId],
    })
    expect(current.players[one].battleArea.find(entry => entry.card.instanceId === attacker.card.instanceId)?.rested)
      .toBe(true)
    expect(current.players[one].supportArea[0]?.rested).toBe(true)
    current = settleEffectDamage(current)

    expect(cookie(current, two, 'ST6-003').hpCards).toHaveLength(targetHp - 1)
    expect(current.pendingBattle).toBeNull()
  })

  it('rejects a real non-purple support payment without changing state', () => {
    const initial = createSt10005PreviewState('normal-attack-no-purple')
    const before = structuredClone(initial)
    const attacker = cookie(initial, one, 'ST10-005')
    const target = cookie(initial, two, 'ST6-003')
    const payment = initial.players[one].supportArea[0]!.card
    expect(payment.energyColor).not.toBe('purple')
    expect(() => applyGameCommand(initial, {
      kind: 'declare-attack', playerId: one, attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId, supportPaymentIds: [payment.instanceId],
    })).toThrow()
    expect(initial).toEqual(before)
  })
})
