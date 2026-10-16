import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createSt10009BothPlayersDepartureState,
  createSt10009FaintState,
  createSt10009ItemCostState,
  createSt10009MultipleDepartureState,
  createSt10009PreviewState,
  rawSt10009,
} from './st10-009-demo'
import type { GameState, PlayerId } from './types'

const one = 'player-one' as const
const two = 'player-two' as const

const cookie = (state: GameState, playerId: PlayerId, cardNumber: string) =>
  state.players[playerId].battleArea.find(entry => entry.card.id === cardNumber)!

const resolvePoisonMushroom = (state: GameState): GameState => {
  const playerId = state.activePlayerId
  const poison = state.players[playerId].hand.find(card => card.id === 'BS2-055')!
  const payment = state.players[playerId].supportArea[0]!.card
  let current = applyGameCommand(state, {
    kind: 'deploy-cookie', playerId, instanceId: poison.instanceId,
  })
  expect(current.pendingOnPlay).toMatchObject({ playerId, sourceInstanceId: poison.instanceId })
  current = applyGameCommand(current, {
    kind: 'begin-activate-skill', playerId, sourceInstanceId: poison.instanceId,
    trigger: 'on-play', paymentIds: [payment.instanceId],
  })
  expect(current.pendingAbilityEffect).toMatchObject({
    playerId, sourceInstanceId: poison.instanceId, trigger: 'on-play',
  })
  return applyGameCommand(current, {
    kind: 'resolve-ability-effect', playerId, targetIds: [],
  })
}

const resolveDraw = (state: GameState, drawCount: 0 | 1): GameState =>
  applyGameCommand(state, {
    kind: 'resolve-draw-up-to', playerId: one, drawCount,
  })

const resolveDrawFor = (state: GameState, playerId: PlayerId, drawCount: 0 | 1): GameState =>
  applyGameCommand(state, {
    kind: 'resolve-draw-up-to', playerId, drawCount,
  })

const settleAttack = (state: GameState): GameState => {
  let current = state
  if (current.pendingBattle?.stage === 'trap') {
    current = applyGameCommand(current, {
      kind: 'skip-trap', playerId: current.pendingBattle.defenderPlayerId,
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

describe('ST10-009 original Space Doughnut direct battle-to-trash trigger', () => {
  it('uses the printed card, one-HP Cookie, original sixty-card decks, and unique physical identities', () => {
    const printed = rawSt10009()
    expect(printed).toMatchObject({
      cardNumber: 'ST10-009', name: 'Space Doughnut', type: 'cookie', color: 'PURPLE', level: 1, hp: 1,
    })
    expect(printed.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(printed.skill.text).toBe(
      'When this Cookie is placed from your battle area into your trash, draw up to 1 card from your deck.',
    )

    const state = createSt10009PreviewState('owner-turn')
    expect(state.activePlayerId).toBe(one)
    expect(cookie(state, one, 'ST10-009').hpCards).toHaveLength(1)
    const allIds = new Set<string>()
    for (const playerId of [one, two]) {
      const cards = [
        ...state.players[playerId].deck,
        ...state.players[playerId].hand,
        ...state.players[playerId].discardPile,
        ...state.players[playerId].breakArea,
        ...state.players[playerId].supportArea.map(support => support.card),
        ...state.players[playerId].battleArea.flatMap(entry => [entry.card, ...entry.hpCards]),
      ]
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

  it('offers the owner a real draw-up-to choice after a Little Star battle Cookie cost', () => {
    const initial = createSt10009ItemCostState()
    const item = initial.players[one].hand[0]!
    const payment = initial.players[one].supportArea[0]!.card
    const departed = cookie(initial, one, 'ST10-009')
    const departedIds = [departed.card.instanceId, ...departed.hpCards.map(card => card.instanceId)]
    const initialHandSize = initial.players[one].hand.length
    const initialDeckSize = initial.players[one].deck.length

    const current = applyGameCommand(initial, {
      kind: 'begin-play-item', playerId: one, instanceId: item.instanceId,
      paymentIds: [payment.instanceId], trashBattleCookieIds: [departed.card.instanceId],
      targetIds: [],
    })

    expect(current.players[one].supportArea[0]?.rested).toBe(true)
    expect(current.players[one].battleArea.some(entry => entry.card.instanceId === departed.card.instanceId)).toBe(false)
    expect(current.players[one].discardPile.map(card => card.instanceId)).toEqual(expect.arrayContaining(departedIds))
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: one, max: 1, sourceInstanceId: departed.card.instanceId,
    })
    expect(current.pendingDrawUpTo?.effectText).toBe(rawSt10009().skill.text)

    const skipped = resolveDraw(current, 0)
    expect(skipped.players[one].hand).toHaveLength(initialHandSize - 1)
    expect(skipped.players[one].deck).toHaveLength(initialDeckSize)
    expect(skipped.pendingDrawUpTo).toBeNull()
  })

  it.each([
    ['owner turn', 'owner-turn'],
    ['opponent turn', 'opponent-turn'],
  ] as const)('triggers from a real multi-area trash effect during the %s', (_label, turn) => {
    const initial = createSt10009PreviewState(turn)
    const sourcePlayerId = turn === 'owner-turn' ? one : two
    const departed = cookie(initial, one, 'ST10-009')
    const sourceBefore = initial.players[sourcePlayerId].hand.find(card => card.id === 'BS2-055')!
    const payment = initial.players[sourcePlayerId].supportArea[0]!.card
    const initialOwnerHandSize = initial.players[one].hand.length
    const initialOwnerDeckSize = initial.players[one].deck.length

    let current = resolvePoisonMushroom(initial)
    expect(current.players[sourcePlayerId].supportArea[0]?.rested).toBe(true)
    expect(current.players[one].battleArea.some(entry => entry.card.instanceId === departed.card.instanceId)).toBe(false)
    expect(current.players[one].discardPile.map(card => card.id)).toContain('ST10-009')
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: one, max: 1, sourceInstanceId: departed.card.instanceId,
    })

    current = resolveDraw(current, 1)
    expect(current.players[one].hand).toHaveLength(initialOwnerHandSize + (sourcePlayerId === one ? 0 : 1))
    expect(current.players[one].deck).toHaveLength(initialOwnerDeckSize - (sourcePlayerId === one ? 6 : 1))
    expect(current.players[sourcePlayerId].battleArea.map(entry => entry.card.instanceId)).toContain(sourceBefore.instanceId)
    expect(current.pendingDrawUpTo ?? null).toBeNull()
    expect(current.pendingAbilityEffect).toBeUndefined()
    expect(payment.instanceId).toBeTruthy()
  })

  it('resolves a separate draw choice for each original Cookie trashed at once', () => {
    const initial = createSt10009MultipleDepartureState()
    const departedIds = initial.players[one].battleArea
      .filter(entry => entry.card.id === 'ST10-009')
      .map(entry => entry.card.instanceId)
    expect(departedIds).toHaveLength(2)

    let current = resolvePoisonMushroom(initial)
    expect(current.players[one].discardPile.filter(card => card.id === 'ST10-009').map(card => card.instanceId))
      .toEqual(expect.arrayContaining(departedIds))
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: one, max: 1, sourceInstanceId: departedIds[0],
    })
    expect(current.pendingDepartureSkillTriggers).toHaveLength(1)

    current = resolveDraw(current, 1)
    expect(current.pendingAbilityEffect).toMatchObject({
      playerId: one,
      trigger: 'departure',
      sourceInstanceId: departedIds[1],
    })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: one, targetIds: [],
    })
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: one, max: 1, sourceInstanceId: departedIds[1],
    })
    current = resolveDraw(current, 1)
    expect(current.pendingDrawUpTo).toBeNull()
    expect(current.pendingDepartureSkillTriggers).toBeUndefined()
    expect(current.players[one].hand).toHaveLength(2)
  })

  it.each([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const)(
    'preserves independent owner choices when both players lose a Cookie at once (%i, %i)',
    (ownerDraw, opponentDraw) => {
      const initial = createSt10009BothPlayersDepartureState()
      const ownerSource = cookie(initial, one, 'ST10-009').card
      const opponentSource = cookie(initial, two, 'ST10-009').card
      const ownerHandSize = initial.players[one].hand.length
      const opponentHandSize = initial.players[two].hand.length
      const ownerDeckSize = initial.players[one].deck.length
      const opponentDeckSize = initial.players[two].deck.length

      let current = resolvePoisonMushroom(initial)
      expect(current.players[one].discardPile.map(card => card.instanceId)).toContain(ownerSource.instanceId)
      expect(current.players[two].discardPile.map(card => card.instanceId)).toContain(opponentSource.instanceId)
      expect(current.pendingDrawUpTo).toMatchObject({
        playerId: one, max: 1, sourceInstanceId: ownerSource.instanceId,
      })
      expect(current.pendingDepartureSkillTriggers).toHaveLength(1)
      expect(current.pendingDepartureSkillTriggers?.[0]).toMatchObject({
        playerId: two, sourceInstanceId: opponentSource.instanceId,
      })

      current = resolveDraw(current, ownerDraw)
      expect(current.pendingAbilityEffect).toMatchObject({
        playerId: two, trigger: 'departure', sourceInstanceId: opponentSource.instanceId,
      })
      current = applyGameCommand(current, {
        kind: 'resolve-ability-effect', playerId: two, targetIds: [],
      })
      expect(current.pendingDrawUpTo).toMatchObject({
        playerId: two, max: 1, sourceInstanceId: opponentSource.instanceId,
      })
      current = resolveDrawFor(current, two, opponentDraw)

      expect(current.pendingDrawUpTo).toBeNull()
      expect(current.pendingDepartureSkillTriggers).toBeUndefined()
      expect(current.pendingAbilityEffect).toBeUndefined()
      expect(current.players[one].hand).toHaveLength(ownerHandSize - 1 + ownerDraw)
      expect(current.players[two].hand).toHaveLength(opponentHandSize + opponentDraw)
      expect(current.players[one].deck).toHaveLength(ownerDeckSize - 5 - ownerDraw)
      expect(current.players[two].deck).toHaveLength(opponentDeckSize - opponentDraw)
    },
  )

  it('does not trigger when a real ordinary attack makes Space Doughnut faint into the Break Area', () => {
    const initial = createSt10009FaintState()
    const attacker = cookie(initial, two, 'ST10-005')
    const target = cookie(initial, one, 'ST10-009')
    const payment = initial.players[two].supportArea[0]!.card

    const attacked = applyGameCommand(initial, {
      kind: 'declare-attack', playerId: two,
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: [payment.instanceId],
    })
    const current = settleAttack(attacked)

    expect(current.players[one].battleArea.some(entry => entry.card.instanceId === target.card.instanceId)).toBe(false)
    expect(current.players[one].breakArea.map(card => card.instanceId)).toContain(target.card.instanceId)
    expect(current.pendingDrawUpTo ?? null).toBeNull()
    expect(current.pendingDepartureSkillTriggers).toBeUndefined()
  })
})
