import { describe, expect, it } from 'vitest'
import { getBlockerCandidates } from './battle'
import { applyGameCommand } from './commands'
import {
  createSt9004To006PreviewState,
  rawSt9004To006,
  st9004To006Zones,
  type St9004To006CardNumber,
} from './st9-004-006-demo'
import type { GameState, PlayerId } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const settleFlipAttack = (state: GameState, drawCount: number): GameState => {
  let current = applyGameCommand(state, { kind: 'skip-trap', playerId: opponent })
  for (let guard = 0; guard < 12 && (current.pendingBattle || current.pendingDrawUpTo); guard += 1) {
    if (current.pendingBattle?.revealedHpCard?.id === 'ST9-004') {
      current = applyGameCommand(current, { kind: 'resolve-flip', playerId: opponent, activate: true })
    } else if (current.pendingDrawUpTo) {
      current = applyGameCommand(current, { kind: 'resolve-draw-up-to', playerId: opponent, drawCount })
    } else {
      current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: opponent })
    }
  }
  if (current.pendingBattle || current.pendingDrawUpTo) throw Error('ST9-004 attack did not settle')
  return current
}

const beginCookieAttack = (
  state: GameState,
  cardNumber: St9004To006CardNumber,
  targetIndex = 0,
): GameState => {
  const attacker = state.players[owner].battleArea.find(cookie => cookie.card.id === cardNumber)
  const target = state.players[opponent].battleArea[targetIndex]
  if (!attacker || !target) throw Error('Original attacker and defender are required')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: owner,
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: state.players[owner].supportArea.map(support => support.card.instanceId),
  })
}

const settleNormalAttack = (state: GameState, defenderId: PlayerId): GameState => {
  let current = state.pendingBattle?.stage === 'trap'
    ? applyGameCommand(state, { kind: 'skip-trap', playerId: defenderId })
    : state
  for (let guard = 0; guard < 12 && current.pendingBattle?.stage === 'damage'; guard += 1) {
    current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: defenderId })
  }
  return current
}

describe('ST9-004–006 original physical card flows', () => {
  it.each(['ST9-004', 'ST9-005', 'ST9-006'] as const)(
    'uses original 60-card decks, HP stacks and card identity for %s', cardNumber => {
      const state = createSt9004To006PreviewState(cardNumber)
      const allInstanceIds = new Set<string>()
      for (const playerId of [owner, opponent]) {
        const cards = st9004To006Zones(state, playerId)
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
        for (const card of cards) {
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
          expect(allInstanceIds.has(card.instanceId)).toBe(false)
          allInstanceIds.add(card.instanceId)
        }
        const counts = new Map<string, number>()
        for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
        expect([...counts.values()].every(count => count <= 4)).toBe(true)
        for (const cookie of state.players[playerId].battleArea) {
          expect(cookie.hpCards).toHaveLength(cookie.card.hp)
        }
      }
      expect(allInstanceIds).toHaveLength(120)
      const printed = rawSt9004To006(cardNumber)
      const zone = st9004To006Zones(state, owner)
      expect(zone.some(card => card.id === cardNumber && card.name === printed.name && card.imageUrl === printed.imageUrl)).toBe(true)
    },
  )

  it.each([0, 1] as const)('reveals the real ST9-004 FLIP and draws %s cards after its BBB attack', drawCount => {
    const initial = createSt9004To006PreviewState('ST9-004')
    const revealed = initial.players[opponent].battleArea[0]?.hpCards[1]
    expect(revealed?.id).toBe('ST9-004')
    const before = structuredClone(initial)
    const attacked = beginCookieAttack(initial, 'ST9-004')
    expect(attacked.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
    const settled = settleFlipAttack(attacked, drawCount)
    expect(settled.players[opponent].discardPile.map(card => card.instanceId)).toContain(revealed?.instanceId)
    expect(settled.players[opponent].hand).toHaveLength(drawCount)
    expect(settled.players[opponent].deck).toHaveLength(initial.players[opponent].deck.length - drawCount)
    expect(settled.players[opponent].battleArea[0]?.hpCards).toHaveLength(1)
    expect(settled.pendingAbilityEffect ?? null).toBeNull()
    expect(initial).toEqual(before)
  })

  it('rejects ST9-004 without BBB and leaves the source, Supports and target unchanged', () => {
    const initial = createSt9004To006PreviewState('ST9-004', 'insufficient-energy')
    const before = structuredClone(initial)
    expect(() => beginCookieAttack(initial, 'ST9-004')).toThrow()
    expect(initial).toEqual(before)
    expect(initial.players[owner].battleArea[0]?.rested).toBe(false)
    expect(initial.players[owner].supportArea.every(support => !support.rested)).toBe(true)
  })

  it('pays the printed blue Blocker cost and redirects a real attack to ST9-005', () => {
    const initial = createSt9004To006PreviewState('ST9-005')
    const blocker = initial.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-005')
    const originalTarget = initial.players[owner].battleArea.find(cookie => cookie.card.id === 'ST4-004')
    expect(initial.pendingBattle?.stage).toBe('trap')
    expect(blocker).toBeDefined()
    expect(getBlockerCandidates(initial, owner).map(cookie => cookie.card.instanceId)).toEqual([blocker?.card.instanceId])
    const payment = initial.players[owner].supportArea[0]?.card
    expect(payment?.energyColor).toBe('blue')
    const blocked = applyGameCommand(initial, {
      kind: 'play-blocker', playerId: owner,
      sourceInstanceId: blocker!.card.instanceId,
      paymentIds: [payment!.instanceId],
    })
    expect(blocked.pendingBattle).toMatchObject({ stage: 'damage', targetInstanceId: blocker?.card.instanceId })
    expect(blocked.players[owner].supportArea[0]?.rested).toBe(true)
    const settled = settleNormalAttack(blocked, owner)
    expect(settled.players[owner].battleArea.some(cookie => cookie.card.instanceId === originalTarget?.card.instanceId)).toBe(true)
    expect(settled.players[owner].battleArea.some(cookie => cookie.card.instanceId === blocker?.card.instanceId)).toBe(false)
    expect(settled.players[owner].breakArea.some(card => card.instanceId === blocker?.card.instanceId)).toBe(true)
  })

  it('does not expose or accept ST9-005 Blocker with only non-blue energy', () => {
    const initial = createSt9004To006PreviewState('ST9-005', 'no-blue-payment')
    const before = structuredClone(initial)
    const blocker = initial.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-005')!
    expect(initial.players[owner].supportArea.every(support => support.card.energyColor !== 'blue')).toBe(true)
    expect(getBlockerCandidates(initial, owner)).toEqual([])
    expect(() => applyGameCommand(initial, {
      kind: 'play-blocker', playerId: owner,
      sourceInstanceId: blocker.card.instanceId,
      paymentIds: initial.players[owner].supportArea.map(support => support.card.instanceId),
    })).toThrow()
    expect(initial).toEqual(before)
  })

  it.each([0, 1] as const)('activates ST9-006 for free at five cards and draws %s before the printed attack Then', drawCount => {
    let state = createSt9004To006PreviewState('ST9-006')
    const source = state.players[owner].battleArea[0]!.card
    const original = state
    const before = structuredClone(state)
    expect(state.players[owner].hand).toHaveLength(5)
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'activate', paymentIds: [],
    })
    expect(state.pendingAbilityEffect?.sourceInstanceId).toBe(source.instanceId)
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(state.pendingDrawUpTo?.max).toBe(1)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })
    expect(state.players[owner].hand).toHaveLength(5 + drawCount)
    expect(state.players[owner].battleArea[0]?.rested).toBe(false)
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow()

    state = beginCookieAttack(state, 'ST9-006')
    state = settleNormalAttack(state, opponent)
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
    const discardIds = state.players[owner].hand.slice(0, 2).map(card => card.instanceId)
    const opponents = state.players[opponent].battleArea.map(cookie => cookie.card.instanceId)
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack', playerId: owner, action: 'pay',
      discardCardIds: discardIds, targetIds: opponents,
    })
    expect(state.players[owner].discardPile.filter(card => discardIds.includes(card.instanceId))).toHaveLength(2)
    for (let guard = 0; guard < 4 && state.pendingBattle; guard += 1) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: opponent })
    }
    expect(state.pendingBattle).toBeNull()
    const originalHp = before.players[opponent].battleArea.map(cookie => cookie.card.hp)
    expect(state.players[opponent].battleArea.map(cookie => cookie.hpCards.length)).toEqual([originalHp[0]! - 4, originalHp[1]! - 1])
    expect(original).toEqual(before)
  })

  it('does not expose or accept the ST9-006 Activate above five cards', () => {
    const state = createSt9004To006PreviewState('ST9-006', 'high-hand')
    const source = state.players[owner].battleArea[0]!.card
    const before = structuredClone(state)
    expect(state.players[owner].hand).toHaveLength(6)
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow()
    expect(state).toEqual(before)
  })

  it('rejects the ST9-006 BBB attack without enough blue Supports without mutating state', () => {
    const initial = createSt9004To006PreviewState('ST9-006', 'insufficient-energy')
    const before = structuredClone(initial)
    expect(() => beginCookieAttack(initial, 'ST9-006')).toThrow()
    expect(initial).toEqual(before)
  })
})
