import { describe, expect, it } from 'vitest'
import { canActivateCookieSkill } from './skills'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import {
  createSt9007To009PreviewState,
  rawSt9007To009,
  st9007To009Zones,
} from './st9-007-009-demo'

const owner = 'player-one' as const
const opponent = 'player-two' as const

describe('ST9-007–009 original physical-card fixture', () => {
  it.each([
    ['ST9-007', 'positive'],
    ['ST9-007', 'high-hand'],
    ['ST9-008', 'positive'],
    ['ST9-008', 'no-eligible-return'],
    ['ST9-009', 'sea-fairy-trigger'],
    ['ST9-009', 'sea-fairy-keeps-wave-drop'],
    ['ST9-009', 'other-source-trigger'],
  ] as const)('uses two original 60-card decks for %s / %s', (cardNumber, scenario) => {
    const state = createSt9007To009PreviewState(cardNumber, scenario)
    const allInstances = new Set<string>()
    for (const playerId of [owner, opponent]) {
      const cards = st9007To009Zones(state, playerId)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        expect(allInstances.has(card.instanceId)).toBe(false)
        allInstances.add(card.instanceId)
      }
      const copyCounts = new Map<string, number>()
      for (const card of cards) copyCounts.set(card.name, (copyCounts.get(card.name) ?? 0) + 1)
      expect([...copyCounts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(allInstances).toHaveLength(120)

    const printed = rawSt9007To009(cardNumber)
    expect(st9007To009Zones(state, owner).some(card =>
      card.id === cardNumber && card.name === printed.name && card.imageUrl === printed.imageUrl,
    )).toBe(true)
  })

  it.each([0, 1] as const)('activates ST9-007 at exactly three cards and draws %s', drawCount => {
    let state = createSt9007To009PreviewState('ST9-007')
    const source = state.players[owner].battleArea[0]!.card
    const before = structuredClone(state)
    expect(state.players[owner].hand).toHaveLength(3)
    expect(canActivateCookieSkill(state, owner, source.instanceId, 'activate')).toBe(true)

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'activate', paymentIds: [],
    })
    expect(state.pendingAbilityEffect?.sourceInstanceId).toBe(source.instanceId)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(state.pendingDrawUpTo).toMatchObject({ max: 1, playerId: owner })
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount })

    expect(state.players[owner].hand).toHaveLength(3 + drawCount)
    expect(state.players[owner].battleArea[0]?.rested).toBe(false)
    expect(canActivateCookieSkill(state, owner, source.instanceId, 'activate')).toBe(false)
    expect(state.players[owner].deck).toHaveLength(before.players[owner].deck.length - drawCount)
    expect(before.players[owner].hand).toHaveLength(3)
  })

  it('does not expose ST9-007 Activate above three cards and does not mutate an illegal attempt', () => {
    const state = createSt9007To009PreviewState('ST9-007', 'high-hand')
    const source = state.players[owner].battleArea[0]!.card
    const before = structuredClone(state)
    expect(state.players[owner].hand).toHaveLength(4)
    expect(canActivateCookieSkill(state, owner, source.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow()
    expect(state).toEqual(before)
  })

  it('returns only an actual LV.2-or-lower Cookie before ST9-008 gains HP', () => {
    const initial = createSt9007To009PreviewState('ST9-008')
    const returned = initial.players[owner].battleArea[0]!.card
    expect(returned.level).toBeLessThanOrEqual(2)
    const sourceInHand = initial.players[owner].hand.find(card => card.id === 'ST9-008')!
    const placed = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: owner, instanceId: sourceInHand.instanceId,
    })
    const source = placed.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-008')!.card
    expect(placed.pendingOnPlay).toMatchObject({ sourceInstanceId: source.instanceId, origin: 'hand' })
    expect(canActivateCookieSkill(placed, owner, source.instanceId, 'on-play')).toBe(true)

    const paid = applyGameCommand(placed, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [], battleToHandIds: [returned.instanceId],
    })
    expect(paid.players[owner].battleArea.some(cookie => cookie.card.instanceId === returned.instanceId)).toBe(false)
    expect(paid.players[owner].hand.map(card => card.instanceId)).toContain(returned.instanceId)
    expect(paid.players[owner].battleArea.find(cookie => cookie.card.instanceId === source.instanceId)?.hpCards)
      .toHaveLength(5)
    expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe(source.instanceId)

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [source.instanceId],
    })
    expect(resolved.players[owner].battleArea.find(cookie => cookie.card.instanceId === source.instanceId)?.hpCards)
      .toHaveLength(6)
    expect(resolved.pendingAbilityEffect ?? null).toBeNull()
    expect(initial.players[owner].battleArea[0]?.card.instanceId).toBe(returned.instanceId)
  })

  it('skips ST9-008 On Play when no other LV.2-or-lower Cookie can pay the printed return cost', () => {
    const initial = createSt9007To009PreviewState('ST9-008', 'no-eligible-return')
    const highLevelCookie = initial.players[owner].battleArea[0]!.card
    expect(highLevelCookie.level).toBeGreaterThan(2)
    const inHand = initial.players[owner].hand.find(card => card.id === 'ST9-008')!
    const placed = applyGameCommand(initial, {
      kind: 'deploy-cookie', playerId: owner, instanceId: inHand.instanceId,
    })
    const source = placed.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-008')!.card
    const beforeActivation = structuredClone(placed)
    expect(canActivateCookieSkill(placed, owner, source.instanceId, 'on-play')).toBe(false)
    expect(() => applyGameCommand(placed, {
      kind: 'begin-activate-skill', playerId: owner, sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [],
    })).toThrow()
    expect(placed).toEqual(beforeActivation)
    expect(placed.players[owner].battleArea.map(cookie => cookie.card.id)).toEqual(['ST9-006', 'ST9-008'])
    expect(placed.players[owner].battleArea.find(cookie => cookie.card.id === 'ST9-008')?.hpCards)
      .toHaveLength(5)
  })
})

describe('ST9-007–009 physical demo routes', () => {
  it('routes the printed Activate and On Play positive/negative physical situations', () => {
    const st9_007 = createCardCheckDemoState('ST9-007')
    expect(st9_007.players[owner].battleArea[0]?.card.id).toBe('ST9-007')
    expect(st9_007.players[owner].hand).toHaveLength(3)
    expect(createCardNegativeDemoState('ST9-007').players[owner].hand).toHaveLength(4)

    const st9_008 = createCardCheckDemoState('ST9-008')
    expect(st9_008.players[owner].hand[0]?.id).toBe('ST9-008')
    expect(st9_008.players[owner].battleArea[0]?.card.level).toBeLessThanOrEqual(2)
    const st9_008Negative = createCardNegativeDemoState('ST9-008')
    expect(st9_008Negative.players[owner].hand[0]?.id).toBe('ST9-008')
    expect(st9_008Negative.players[owner].battleArea.every(cookie => cookie.card.level > 2)).toBe(true)

    const st9_009 = createCardCheckDemoState('ST9-009')
    expect(st9_009.players[owner].battleArea[0]?.card.name).toBe('Sea Fairy Cookie')
    expect(st9_009.players[owner].hand[0]?.id).toBe('ST9-009')
    const st9_009Negative = createCardNegativeDemoState('ST9-009')
    expect(st9_009Negative.players[owner].battleArea[0]?.card.id).toBe('ST9-006')
    expect(st9_009Negative.players[owner].hand[0]?.id).toBe('ST9-009')
  })
})
