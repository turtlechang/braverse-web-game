import { describe, expect, it } from 'vitest'
import { getTrapCandidates } from './battle'
import { applyGameCommand } from './commands'
import { createSt1017To018TrapPreviewState, createSt1020StagePreviewState } from './st10-017-018-020-demo'
import type { GameCard, GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const allCards = (state: GameState, playerId: typeof owner | typeof opponent): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.discardPile,
    ...player.breakArea,
    ...player.supportArea.map(entry => entry.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
  ]
}

const assertOriginalDecks = (state: GameState): void => {
  const ids = new Set<string>()
  for (const playerId of [owner, opponent]) {
    const cards = allCards(state, playerId)
    expect(cards).toHaveLength(60)
    const counts = new Map<string, number>()
    for (const card of cards) {
      expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
      expect(ids.has(card.instanceId)).toBe(false)
      ids.add(card.instanceId)
      counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    }
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
    for (const cookie of state.players[playerId].battleArea) {
      expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    }
  }
  expect(ids.size).toBe(120)
}

const playTrap = (
  state: GameState,
  cardNumber: 'ST10-017' | 'ST10-018',
  targetIds: string[],
  effectTargets?: string[][],
): GameState => {
  const source = state.players[owner].hand.find(card => card.id === cardNumber)
  if (!source) throw new Error(`Missing original ${cardNumber} Trap`)
  const cost = cardNumber === 'ST10-017' ? 2 : 3
  const paymentIds = state.players[owner].supportArea
    .filter(support => !support.rested && support.card.energyColor === 'purple')
    .slice(0, cost)
    .map(support => support.card.instanceId)
  expect(paymentIds).toHaveLength(cost)
  const attacker = state.players[opponent].battleArea.find(cookie => cookie.card.id === 'BS1-072')
  if (!attacker) throw new Error('Missing original Pudding Cookie attacker')
  return applyGameCommand(state, {
    kind: 'play-trap',
    playerId: owner,
    trapInstanceId: source.instanceId,
    paymentIds,
    targetIds,
    ...(effectTargets ? { effectTargets } : {}),
  })
}

const resolveTrapMill = (state: GameState, amount = 3): GameState => {
  if (!state.pendingAbilityEffect || state.pendingAbilityEffect.effects[state.pendingAbilityEffect.effectIndex]?.kind !== 'deck-to-trash') {
    throw new Error('ST10-017 must wait for its printed up-to deck-to-trash choice')
  }
  return applyGameCommand(state, {
    kind: 'resolve-ability-effect',
    playerId: owner,
    targetIds: [],
    deckToTrashAmount: amount,
  })
}

const placeStage = (state: GameState): GameState => {
  const stage = state.players[owner].hand.find(card => card.id === 'ST10-020')
  const payment = state.players[owner].supportArea.find(support => !support.rested && support.card.energyColor === 'purple')
  if (!stage || !payment) throw new Error('Original Wizard Archives and active purple Support are required')
  return applyGameCommand(state, {
    kind: 'play-stage', playerId: owner, instanceId: stage.instanceId,
    paymentIds: [payment.card.instanceId],
  })
}

const beginStageActivation = (state: GameState): GameState => applyGameCommand(state, {
  kind: 'begin-activate-stage', playerId: owner, paymentIds: [],
})

describe('ST10-017, ST10-018, and ST10-020 original-card physical flows', () => {
  it.each([
    ['ST10-017', 'positive'], ['ST10-017', 'skip-target'], ['ST10-017', 'no-purple-payment'],
    ['ST10-018', 'positive'], ['ST10-018', 'skip-target'], ['ST10-018', 'no-lv3'], ['ST10-018', 'no-purple-payment'],
  ] as const)('%s %s starts from 120 unique original physical cards', (cardNumber, scenario) => {
    const state = createSt1017To018TrapPreviewState(cardNumber, scenario)
    assertOriginalDecks(state)
    expect(state.pendingBattle).toMatchObject({
      attackerPlayerId: opponent,
      defenderPlayerId: owner,
      stage: 'trap',
      declaredDamage: 4,
    })
    expect(state.players[owner].hand[0]).toMatchObject({ id: cardNumber, type: 'trap' })
  })

  it('ST10-017 pays PP, reduces the chosen attacker by two, then mills three original cards', () => {
    const initial = createSt1017To018TrapPreviewState('ST10-017', 'positive')
    const attacker = initial.players[opponent].battleArea[0]!.card
    const topCards = initial.players[owner].deck.slice(0, 3)
    const pending = playTrap(initial, 'ST10-017', [attacker.instanceId])
    expect(pending.pendingAbilityEffect).toMatchObject({ effectIndex: 1, battleContinuation: 'after-trap' })
    const paid = resolveTrapMill(pending)
    expect(paid.players[owner].supportArea.filter(entry => entry.rested)).toHaveLength(2)
    expect(paid.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: attacker.instanceId,
      amount: -2,
    }))
    expect(paid.pendingBattle?.declaredDamage).toBe(2)
    expect(paid.players[owner].deck).toHaveLength(initial.players[owner].deck.length - 3)
    expect(paid.players[owner].discardPile.map(card => card.instanceId)).toEqual([
      initial.players[owner].hand[0]!.instanceId, ...topCards.map(card => card.instanceId),
    ])
  })

  it('ST10-017 can skip the attack target and still resolve its independent mill Then', () => {
    const initial = createSt1017To018TrapPreviewState('ST10-017', 'skip-target')
    const pending = playTrap(initial, 'ST10-017', [])
    expect(pending.pendingAbilityEffect).toMatchObject({ effectIndex: 1 })
    const paid = resolveTrapMill(pending)
    expect(paid.attackModifiers.some(modifier => modifier.sourceInstanceId === initial.players[owner].hand[0]!.instanceId)).toBe(false)
    expect(paid.pendingBattle?.declaredDamage).toBe(4)
    expect(paid.players[owner].deck).toHaveLength(initial.players[owner].deck.length - 3)
    expect(paid.players[owner].discardPile).toHaveLength(4)
  })

  it.each([0, 1, 2] as const)('ST10-017 honors the chosen up-to amount %s', amount => {
    const initial = createSt1017To018TrapPreviewState('ST10-017', 'positive')
    const attacker = initial.players[opponent].battleArea[0]!.card
    const pending = playTrap(initial, 'ST10-017', [attacker.instanceId])
    const topCards = initial.players[owner].deck.slice(0, amount)
    const beforeInvalid = structuredClone(pending)
    expect(() => applyGameCommand(pending, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [], deckToTrashAmount: 4,
    })).toThrow(/張數不合法/)
    expect(pending).toEqual(beforeInvalid)

    const settled = resolveTrapMill(pending, amount)
    expect(settled.players[owner].deck).toHaveLength(initial.players[owner].deck.length - amount)
    expect(settled.players[owner].discardPile.map(card => card.instanceId)).toEqual([
      initial.players[owner].hand[0]!.instanceId,
      ...topCards.map(card => card.instanceId),
    ])
  })

  it('ST10-017 can select the one available top card without milling past it after Refresh', () => {
    const initial = createSt1017To018TrapPreviewState('ST10-017', 'positive')
    const own = initial.players[owner]
    const [available, ...remaining] = own.deck
    if (!available) throw new Error('ST10-017 short-deck fixture requires a top card')
    own.deck = [available]
    own.discardPile = remaining
    const attacker = initial.players[opponent].battleArea[0]!.card
    const pending = playTrap(initial, 'ST10-017', [attacker.instanceId])
    const milling = resolveTrapMill(pending, 1)
    expect(milling.pendingRefresh?.remainingDeckToTrash?.effect.amount).toBe(0)
    expect(milling.pendingRefresh?.remainingDeckToTrash?.movedCards.map(card => card.instanceId)).toContain(available.instanceId)
  })

  it('ST10-018 pays PPP, applies -2, and returns only the printed purple LV.3 Cookie', () => {
    const initial = createSt1017To018TrapPreviewState('ST10-018', 'positive')
    const attacker = initial.players[opponent].battleArea[0]!.card
    const recovered = initial.players[owner].discardPile.find(card => card.id === 'BS9-109')!
    const paid = playTrap(initial, 'ST10-018', [attacker.instanceId], [
      [attacker.instanceId], [recovered.instanceId],
    ])
    expect(paid.players[owner].supportArea.filter(entry => entry.rested)).toHaveLength(3)
    expect(paid.pendingBattle?.declaredDamage).toBe(2)
    expect(paid.players[owner].hand.map(card => card.instanceId)).toContain(recovered.instanceId)
    expect(paid.players[owner].discardPile.map(card => card.instanceId)).not.toContain(recovered.instanceId)
  })

  it('ST10-018 still recovers after choosing zero Cookies for its first effect', () => {
    const initial = createSt1017To018TrapPreviewState('ST10-018', 'skip-target')
    const recovered = initial.players[owner].discardPile.find(card => card.id === 'BS9-109')!
    const paid = playTrap(initial, 'ST10-018', [], [[], [recovered.instanceId]])
    expect(paid.attackModifiers).toHaveLength(0)
    expect(paid.pendingBattle?.declaredDamage).toBe(4)
    expect(paid.players[owner].hand.map(card => card.instanceId)).toContain(recovered.instanceId)
  })

  it('ST10-018 pays and applies the first effect when no purple LV.3 recovery target exists', () => {
    const initial = createSt1017To018TrapPreviewState('ST10-018', 'no-lv3')
    const attacker = initial.players[opponent].battleArea[0]!.card
    const invalidTargets = initial.players[owner].discardPile.map(card => card.instanceId)
    expect(() => playTrap(initial, 'ST10-018', [attacker.instanceId], [
      [attacker.instanceId], invalidTargets,
    ])).toThrow()
    const paid = playTrap(initial, 'ST10-018', [attacker.instanceId], [
      [attacker.instanceId], [],
    ])
    expect(paid.pendingBattle?.declaredDamage).toBe(2)
    expect(paid.players[owner].discardPile.map(card => card.id)).toEqual(['BS9-097', 'ST4-004', 'ST10-018'])
  })

  it.each(['positive', 'no-target'] as const)('ST10-020 places with P, rests, and moves up to one legal purple LV.1 Cookie (%s)', scenario => {
    const initial = createSt1020StagePreviewState(scenario)
    assertOriginalDecks(initial)
    const target = scenario === 'positive'
      ? initial.players[owner].battleArea.find(cookie => cookie.card.id === 'BS9-096')?.card
      : undefined
    const placed = placeStage(initial)
    expect(placed.players[owner].stage?.card.id).toBe('ST10-020')
    expect(placed.players[owner].supportArea.filter(entry => entry.rested)).toHaveLength(1)
    expect(placed.players[owner].stage?.rested).toBe(false)
    const pending = beginStageActivation(placed)
    expect(pending.players[owner].stage?.rested).toBe(true)
    expect(pending.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'field-to-trash',
      target: { side: 'self', min: 0, max: 1, energyColor: 'purple', minLevel: 1, maxLevel: 1 },
    })
    if (target) {
      const illegalBlueTarget = initial.players[owner].battleArea.find(cookie => cookie.card.id === 'ST4-002')!.card
      const beforeIllegalResolution = structuredClone(pending)
      expect(() => applyGameCommand(pending, {
        kind: 'resolve-ability-effect',
        playerId: owner,
        targetIds: [illegalBlueTarget.instanceId],
      })).toThrow(/合法目標/)
      expect(pending).toEqual(beforeIllegalResolution)
    }
    const settled = applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: owner,
      targetIds: target ? [target.instanceId] : [],
    })
    expect(settled.players[owner].stage?.rested).toBe(true)
    if (target) {
      expect(settled.players[owner].battleArea.some(cookie => cookie.card.instanceId === target.instanceId)).toBe(false)
      expect(settled.players[owner].discardPile.map(card => card.instanceId)).toContain(target.instanceId)
    } else {
      expect(settled.players[owner].battleArea.map(cookie => cookie.card.id)).toEqual(['ST4-002'])
      expect(settled.players[owner].discardPile).toHaveLength(0)
    }
  })

  it('blocks ST10-018 and ST10-020 when their printed purple energy cannot be paid', () => {
    const trapState = createSt1017To018TrapPreviewState('ST10-018', 'no-purple-payment')
    expect(getTrapCandidates(trapState, owner).some(card => card.id === 'ST10-018')).toBe(false)
    const stageState = createSt1020StagePreviewState('no-purple-payment')
    const stage = stageState.players[owner].hand[0]!
    const before = structuredClone(stageState)
    expect(() => applyGameCommand(stageState, {
      kind: 'play-stage', playerId: owner, instanceId: stage.instanceId,
      paymentIds: [stageState.players[owner].supportArea[0]!.card.instanceId],
    })).toThrow()
    expect(stageState).toEqual(before)
  })
})
