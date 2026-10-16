import { describe, expect, it } from 'vitest'
import { executeCardEffect } from './effects/execute'
import { applyGameCommand } from './commands'
import {
  createSt10006CostDepartureState,
  createSt10006ItemDepartureCostState,
  createSt10006PreviewState,
  rawSt10006,
  st10006Zones,
} from './st10-006-demo'
import type { GameState, PlayerId } from './types'

const one = 'player-one' as const
const two = 'player-two' as const

const battleCookie = (state: GameState, playerId: PlayerId, cardNumber: string) =>
  state.players[playerId].battleArea.find(entry => entry.card.id === cardNumber)!

const beginRealRemoval = (state: GameState): GameState => {
  const playerId = state.activePlayerId
  const source = state.players[playerId].hand.find(card => card.id === 'BS2-055')!
  const payment = state.players[playerId].supportArea[0]!.card
  let current = applyGameCommand(state, {
    kind: 'deploy-cookie', playerId, instanceId: source.instanceId,
  })
  current = applyGameCommand(current, {
    kind: 'begin-activate-skill',
    playerId,
    sourceInstanceId: source.instanceId,
    trigger: 'on-play',
    paymentIds: [payment.instanceId],
  })
  return current
}

const resolveRealRemoval = (state: GameState): GameState =>
  applyGameCommand(state, {
    kind: 'resolve-ability-effect', playerId: state.activePlayerId, targetIds: [],
  })

const activateRealRemoval = (state: GameState): GameState => {
  const pending = beginRealRemoval(state)
  return pending.pendingAbilityEffect ? resolveRealRemoval(pending) : pending
}

const resolveEffectDamage = (state: GameState): GameState => {
  let current = state
  for (let count = 0; count < 8 && current.pendingBattle?.stage === 'damage'; count += 1) {
    current = applyGameCommand(current, {
      kind: 'resolve-next-damage',
      playerId: current.pendingBattle.damagePlayerId ?? current.pendingBattle.defenderPlayerId,
    })
  }
  return current
}

describe('ST10-006 original Blueberry Pie Cookie direct-departure trigger', () => {
  it('uses the original sixty-card decks, printed HP, and real On Play removal source', () => {
    const state = createSt10006PreviewState('owner-turn')
    const printed = rawSt10006()
    expect(printed).toMatchObject({
      cardNumber: 'ST10-006', name: 'Blueberry Pie Cookie', type: 'cookie', color: 'PURPLE', level: 1, hp: 2,
    })
    expect(printed.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(state.activePlayerId).toBe(one)
    expect(state.phase).toBe('main')
    expect(state.players[one].hand[0]).toMatchObject({ id: 'BS2-055', name: 'Poison Mushroom Cookie' })
    expect(state.players[one].supportArea[0]?.card).toMatchObject({ id: 'BS9-096', energyColor: 'purple' })
    expect(battleCookie(state, one, 'ST10-006').hpCards).toHaveLength(2)
    expect(battleCookie(state, two, 'ST10-002').hpCards).toHaveLength(6)

    const allIds = new Set<string>()
    for (const playerId of [one, two]) {
      const cards = st10006Zones(state, playerId)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        expect(allIds.has(card.instanceId)).toBe(false)
        allIds.add(card.instanceId)
      }
      const copies = new Map<string, number>()
      for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
      expect([...copies.values()].every(count => count <= 4)).toBe(true)
    }
    expect(allIds).toHaveLength(120)
  })

  it('lets the owner choose one opponent Cookie for 1 damage after a real direct move into trash', () => {
    const initial = createSt10006PreviewState('owner-turn')
    const source = initial.players[one].hand[0]!
    const energy = initial.players[one].supportArea[0]!.card
    const departed = battleCookie(initial, one, 'ST10-006')
    const target = battleCookie(initial, two, 'ST10-002')
    const departedIds = [departed.card.instanceId, ...departed.hpCards.map(card => card.instanceId)]

    let current = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: one, instanceId: source.instanceId,
    })
    expect(current.pendingOnPlay).toMatchObject({ playerId: one, sourceInstanceId: source.instanceId })
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill', playerId: one, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [energy.instanceId],
    })
    expect(current.pendingAbilityEffect).toMatchObject({ sourceInstanceId: source.instanceId, trigger: 'on-play' })
    current = resolveRealRemoval(current)

    expect(current.players[one].supportArea[0]?.rested).toBe(true)
    expect(current.players[one].battleArea.some(entry => entry.card.instanceId === departed.card.instanceId)).toBe(false)
    expect(current.players[one].discardPile.map(card => card.instanceId)).toEqual(expect.arrayContaining(departedIds))
    expect(current.pendingAbilityEffect).toMatchObject({
      playerId: one,
      sourcePlayerId: one,
      sourceInstanceId: departed.card.instanceId,
      sourceCardName: 'Blueberry Pie Cookie',
      sourceKind: 'skill',
      trigger: 'departure',
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
      effectIndex: 0,
    })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [target.card.instanceId],
    })
    current = resolveEffectDamage(current)
    expect(battleCookie(current, two, 'ST10-002').hpCards).toHaveLength(5)
    expect(current.pendingAbilityEffect).toBeUndefined()
    expect(current.pendingBattle).toBeNull()
  })

  it('resolves the departure trigger when another Cookie trashes it as an On Play cost', () => {
    const initial = createSt10006CostDepartureState()
    const milkyWay = initial.players[one].hand[0]!

    const energy = initial.players[one].supportArea[0]!.card
    const departed = battleCookie(initial, one, 'ST10-006')
    const target = battleCookie(initial, two, 'ST10-002')
    let current = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: one, instanceId: milkyWay.instanceId,
    })
    expect(current.pendingOnPlay).toMatchObject({ playerId: one, sourceInstanceId: milkyWay.instanceId })

    current = applyGameCommand(current, {
      kind: 'begin-activate-skill', playerId: one, sourceInstanceId: milkyWay.instanceId,
      trigger: 'on-play', paymentIds: [energy.instanceId],
      trashBattleCookieIds: [departed.card.instanceId],
    })
    expect(current.players[one].supportArea[0]?.rested).toBe(true)
    expect(current.players[one].battleArea.some(entry => entry.card.instanceId === departed.card.instanceId)).toBe(false)
    expect(current.players[one].discardPile.map(card => card.instanceId)).toEqual(
      expect.arrayContaining([departed.card.instanceId, ...departed.hpCards.map(card => card.instanceId)]),
    )
    expect(current.pendingAbilityEffect).toMatchObject({
      sourceInstanceId: milkyWay.instanceId, sourceCardName: 'Milky Way Cookie', trigger: 'on-play',
    })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [],
    })
    expect(current.pendingAbilityEffect).toMatchObject({
      playerId: one,
      sourceInstanceId: departed.card.instanceId,
      sourceCardName: 'Blueberry Pie Cookie',
      trigger: 'departure',
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [target.card.instanceId],
    })
    current = resolveEffectDamage(current)
    expect(battleCookie(current, two, 'ST10-002').hpCards).toHaveLength(5)
  })

  it('resolves the departure trigger when Little Star pays its real Cookie trash cost', () => {
    const initial = createSt10006ItemDepartureCostState()
    const item = initial.players[one].hand[0]!
    const energy = initial.players[one].supportArea[0]!.card
    const departed = battleCookie(initial, one, 'ST10-006')
    const target = battleCookie(initial, two, 'ST10-002')

    expect(item).toMatchObject({ id: 'ST10-013', name: 'Little Star', type: 'item' })
    let current = applyGameCommand(initial, {
      kind: 'begin-play-item',
      playerId: one,
      instanceId: item.instanceId,
      paymentIds: [energy.instanceId],
      trashBattleCookieIds: [departed.card.instanceId],
      targetIds: [],
    })

    expect(current.players[one].supportArea[0]?.rested).toBe(true)
    expect(current.players[one].battleArea.some(entry => entry.card.instanceId === departed.card.instanceId)).toBe(false)
    expect(current.players[one].discardPile.map(card => card.instanceId)).toEqual(
      expect.arrayContaining([departed.card.instanceId, ...departed.hpCards.map(card => card.instanceId)]),
    )
    expect(current.pendingAbilityEffect).toMatchObject({
      playerId: one,
      sourceInstanceId: departed.card.instanceId,
      sourceCardName: 'Blueberry Pie Cookie',
      sourceKind: 'skill',
      trigger: 'departure',
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
      effectIndex: 0,
    })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [target.card.instanceId],
    })
    current = resolveEffectDamage(current)
    expect(battleCookie(current, two, 'ST10-002').hpCards).toHaveLength(5)
  })

  it('allows choosing zero, and does not trigger on the opponent turn', () => {
    const ownerTurn = createSt10006PreviewState('owner-turn')
    const ownerTarget = battleCookie(ownerTurn, two, 'ST10-002')
    let zero = activateRealRemoval(ownerTurn)
    zero = applyGameCommand(zero, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [],
    })
    expect(battleCookie(zero, two, 'ST10-002').hpCards).toHaveLength(ownerTarget.hpCards.length)
    expect(zero.pendingAbilityEffect).toBeUndefined()

    const offTurn = createSt10006PreviewState('opponent-turn')
    const offTurnTarget = battleCookie(offTurn, two, 'ST10-002')
    const notTriggered = activateRealRemoval(offTurn)
    expect(notTriggered.players[one].discardPile.map(card => card.id)).toContain('ST10-006')
    expect(notTriggered.pendingAbilityEffect).toBeUndefined()
    expect(battleCookie(notTriggered, two, 'ST10-002').hpCards).toHaveLength(offTurnTarget.hpCards.length)
  })

  it('does not treat movement into the Break Area as the printed trash event', () => {
    const initial = createSt10006PreviewState('owner-turn')
    const departed = battleCookie(initial, one, 'ST10-006')
    const moved = executeCardEffect(
      initial,
      { sourcePlayerId: two, sourceInstanceId: 'physical-break-effect', sourceCardName: 'physical effect' },
      { kind: 'battle-to-break', target: { side: 'opponent', min: 1, max: 1 } },
      [departed.card.instanceId],
    )
    expect(moved.players[one].breakArea.map(card => card.instanceId)).toContain(departed.card.instanceId)
    expect(moved.pendingAbilityEffect).toBeUndefined()
    expect(moved.pendingBattle).toBeNull()
  })
})
