import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createSt8016PreviewState, st8016Scenarios } from './st8-016-demo'
import type { GameState, PlayerId } from './types'

const owner: PlayerId = 'player-one'
const foe: PlayerId = 'player-two'

const physicalCards = (state: GameState, playerId: PlayerId) => {
  const player = state.players[playerId]
  return [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

const pay = (state: GameState) => {
  const player = state.players[owner]
  const item = player.hand.find(card => card.id === 'ST8-016')
  const support = player.supportArea.find(entry =>
    entry.card.id === 'ST3-019' && entry.card.energyColor === 'green' && !entry.rested,
  )
  if (!item || item.type !== 'item' || !support) throw Error('Original Item and active green payment required')
  return applyGameCommand(state, {
    kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId,
    paymentIds: [support.card.instanceId],
  })
}

const resolveItemEffect = (state: GameState) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })

const finishEffectDamage = (initial: GameState, activateFirstFlip = false): GameState => {
  let state = initial
  let activatedFlip = false
  for (let step = 0; step < 20; step += 1) {
    const battle = state.pendingBattle
    if (!battle) return state
    const playerId = battle.damagePlayerId ?? battle.defenderPlayerId
    if (battle.stage === 'flip') {
      const activate: boolean = activateFirstFlip && !activatedFlip
      const handCard = activate ? state.players[playerId].hand[0] : undefined
      if (activate && !handCard) throw Error('Original hand card required for the printed FLIP cost')
      state = applyGameCommand(state, {
        kind: 'resolve-flip', playerId, activate,
        ...(handCard ? { discardHandIds: [handCard.instanceId] } : {}),
      })
      activatedFlip ||= activate
      continue
    }
    if (battle.effectDamageSequence) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
      continue
    }
    return state
  }
  throw Error('Effect damage did not finish within the expected target/FLIP steps')
}

describe("ST8-016 Wind's Grace Earrings physical item flow", () => {
  it.each(st8016Scenarios)('%s uses 60 original cards, unique IDs and at most four copies', scenario => {
    const state = createSt8016PreviewState(scenario)
    const instanceIds: string[] = []
    for (const playerId of [owner, foe]) {
      const cards = physicalCards(state, playerId)
      expect(cards).toHaveLength(60)
      instanceIds.push(...cards.map(card => card.instanceId))
      const copies = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
      }
      expect([...copies.values()].every(count => count <= 4)).toBe(true)
      expect(state.players[playerId].battleArea.length).toBeLessThanOrEqual(2)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards.length).toBeLessThanOrEqual(cookie.card.hp)
      }
    }
    expect(new Set(instanceIds).size).toBe(120)
  })

  it.each(['positive', 'wind-rested'] as const)(
    'pays G and damages all opponent Cookies once when Wind Archer is %s and five cards remain in support', scenario => {
      const initial = createSt8016PreviewState(scenario)
      const before = structuredClone(initial)
      const own = initial.players[owner]
      const opponent = initial.players[foe]
      const wind = own.battleArea.find(cookie => cookie.card.id === 'ST8-005')
      const regular = opponent.battleArea[0]
      const flipTarget = opponent.battleArea[1]
      const flipHp = flipTarget?.hpCards[0]
      const item = own.hand[0]
      const payment = own.supportArea.find(support => support.card.id === 'ST3-019')
      if (!wind || !regular || !flipTarget || !flipHp || !item || !payment) throw Error('Printed fixture cards missing')

      expect(wind.rested).toBe(scenario === 'wind-rested')
      expect(own.supportArea).toHaveLength(5)
      expect(own.supportArea.some(support => support.card.type === 'trap')).toBe(true)
      expect(own.supportArea.filter(support => !support.rested)).toEqual([payment])

      const paid = pay(initial)
      expect(paid.players[owner].supportArea).toHaveLength(5)
      expect(paid.players[owner].supportArea.find(support => support.card.instanceId === payment.card.instanceId)?.rested).toBe(true)
      expect(paid.pendingAbilityEffect?.sourceKind).toBe('item')
      expect(paid.players[owner].discardPile.map(card => card.instanceId)).toContain(item.instanceId)

      const started = resolveItemEffect(paid)
      expect(started.pendingBattle?.effectDamageSequence).toBeDefined()
      const resolved = finishEffectDamage(started)
      const remainingRegular = resolved.players[foe].battleArea.find(cookie => cookie.card.instanceId === regular.card.instanceId)
      expect(remainingRegular?.hpCards).toEqual(regular.hpCards.slice(0, -1))
      expect(resolved.players[foe].battleArea.some(cookie => cookie.card.instanceId === flipTarget.card.instanceId)).toBe(false)
      expect(resolved.players[foe].breakArea.map(card => card.instanceId)).toContain(flipTarget.card.instanceId)
      expect(resolved.players[foe].discardPile.map(card => card.instanceId)).toContain(flipHp.instanceId)
      expect(resolved.players[owner].battleArea.map(cookie => [
        cookie.card.instanceId, cookie.hpCards.map(card => card.instanceId), cookie.rested,
      ])).toEqual(own.battleArea.map(cookie => [
        cookie.card.instanceId, cookie.hpCards.map(card => card.instanceId), cookie.rested,
      ]))
      expect(resolved.pendingBattle).toBeNull()
      expect(resolved.pendingAbilityEffect).toBeUndefined()
      expect(initial).toEqual(before)
    },
  )

  it('activates the original one-HP FLIP, preserves its Cookie, then continues damage to every other target', () => {
    const initial = createSt8016PreviewState('positive')
    const opponent = initial.players[foe]
    const flipTarget = opponent.battleArea[1]
    const regular = opponent.battleArea[0]
    const handCost = opponent.hand[0]
    const paid = pay(initial)
    const started = resolveItemEffect(paid)
    const resolved = finishEffectDamage(started, true)

    const saved = resolved.players[foe].battleArea.find(cookie => cookie.card.instanceId === flipTarget.card.instanceId)
    expect(saved).toBeDefined()
    expect(saved?.hpCards).toHaveLength(1)
    expect(resolved.players[foe].discardPile.map(card => card.instanceId)).toContain(handCost?.instanceId)
    expect(resolved.players[foe].discardPile.map(card => card.instanceId)).toContain(flipTarget.hpCards[0]?.instanceId)
    expect(resolved.players[foe].battleArea.find(cookie => cookie.card.instanceId === regular.card.instanceId)?.hpCards)
      .toEqual(regular.hpCards.slice(0, -1))
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('faints a one-HP opponent Cookie without FLIP and continues the all-Cookie effect', () => {
    const initial = createSt8016PreviewState('one-hp-faint')
    const before = structuredClone(initial)
    const opponent = initial.players[foe]
    const regular = opponent.battleArea[0]
    const fainted = opponent.battleArea[1]
    const started = resolveItemEffect(pay(initial))
    const resolved = finishEffectDamage(started)

    expect(resolved.players[foe].breakArea.map(card => card.instanceId)).toContain(fainted.card.instanceId)
    expect(resolved.players[foe].battleArea.some(cookie => cookie.card.instanceId === fainted.card.instanceId)).toBe(false)
    expect(resolved.players[foe].battleArea.find(cookie => cookie.card.instanceId === regular.card.instanceId)?.hpCards)
      .toEqual(regular.hpCards.slice(0, -1))
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(initial).toEqual(before)
  })

  it.each(['support-below-threshold', 'wind-in-support', 'wind-in-hand'] as const)(
    'still pays G but records a no-op when only the printed condition fails (%s)', scenario => {
      const initial = createSt8016PreviewState(scenario)
      const before = structuredClone(initial)
      const own = initial.players[owner]
      const opponent = initial.players[foe]
      const item = own.hand.find(card => card.id === 'ST8-016')
      const payment = own.supportArea.find(support => support.card.id === 'ST3-019')
      if (!item || !payment) throw Error('Original Item and green payment required')
      if (scenario === 'support-below-threshold') expect(own.supportArea).toHaveLength(4)
      else expect(own.supportArea).toHaveLength(5)
      if (scenario === 'wind-in-support') {
        expect(own.supportArea.some(support => support.card.id === 'ST8-005')).toBe(true)
        expect(own.battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(false)
      }
      if (scenario === 'wind-in-hand') {
        expect(own.hand.some(card => card.id === 'ST8-005')).toBe(true)
        expect(own.battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(false)
      }

      const paid = pay(initial)
      expect(paid.players[owner].supportArea).toHaveLength(own.supportArea.length)
      expect(paid.players[owner].supportArea.find(support => support.card.instanceId === payment.card.instanceId)?.rested).toBe(true)
      expect(paid.pendingAbilityEffect).toBeUndefined()
      expect(paid.players[owner].discardPile.map(card => card.instanceId)).toContain(item.instanceId)
      expect(paid.players[owner].battleArea).toEqual(own.battleArea)
      expect(paid.players[foe].battleArea).toEqual(opponent.battleArea)
      expect(paid.commandLog?.at(-1)?.steps?.some(step => step.text.includes('道具效果結果：條件不成立，效果未執行')))
        .toBe(true)
      expect(initial).toEqual(before)
    },
  )

  it('rejects activation when no active green Support card can pay G', () => {
    const state = createSt8016PreviewState('no-green-payment')
    const before = structuredClone(state)
    const item = state.players[owner].hand.find(card => card.id === 'ST8-016')
    if (!item) throw Error('Original Item required')
    expect(state.players[owner].supportArea.every(support => support.rested || support.card.energyColor !== 'green')).toBe(true)
    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: owner, instanceId: item.instanceId, paymentIds: [],
    })).toThrow()
    expect(state).toEqual(before)
  })
})
