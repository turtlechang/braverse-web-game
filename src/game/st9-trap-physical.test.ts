import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { getActingPlayerId } from './controller'
import { commandFromLogEntry } from './replay'
import {
  createSt9TrapAttackStartState,
  createSt9TrapPreviewState,
  rawSt9017,
  rawSt9018,
  rawSt9019,
} from './st9-trap-demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

const allCards = (state: GameState, playerId: typeof owner | typeof opponent) => {
  const player = state.players[playerId]
  return [
    ...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

const attacker = (state: GameState) => required(
  state.players[opponent].battleArea.find(cookie => cookie.card.id === 'BS1-072'),
  'original Pudding Cookie attacker',
)

const trap = (state: GameState, cardNumber: 'ST9-017' | 'ST9-018' | 'ST9-019') => required(
  state.players[owner].hand.find(card => card.id === cardNumber),
  `original ${cardNumber} Trap`,
)

const playTrap = (
  state: GameState,
  cardNumber: 'ST9-017' | 'ST9-018' | 'ST9-019',
  targetIds: string[] = [attacker(state).card.instanceId],
) => {
  const cost = cardNumber === 'ST9-017' ? 3 : 1
  const paymentIds = state.players[owner].supportArea
    .filter(support => !support.rested && support.card.energyColor === 'blue')
    .slice(0, cost)
    .map(support => support.card.instanceId)
  if (paymentIds.length !== cost) throw Error(`${cardNumber} needs ${cost} active blue Supports`)
  return applyGameCommand(state, {
    kind: 'play-trap', playerId: owner, trapInstanceId: trap(state, cardNumber).instanceId,
    paymentIds, targetIds,
  })
}

const openOptionalThen = (state: GameState) => {
  if (!state.pendingAbilityEffect) throw Error('The physical Trap Then must remain in the authoritative queue')
  return applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
}

const payDiscardThen = (state: GameState, count: number) => {
  const pending = required(state.pendingOptionalCostAttack, 'optional printed discard Then')
  const discardCardIds = state.players[owner].hand
    .filter(card => card.instanceId !== pending.sourceInstanceId)
    .slice(0, count)
    .map(card => card.instanceId)
  expect(discardCardIds).toHaveLength(count)
  return applyGameCommand(state, {
    kind: 'resolve-optional-cost-attack', playerId: owner, action: 'pay',
    discardCardIds, paymentIds: [], targetIds: [],
  })
}

const settleBattle = (initial: GameState) => {
  let state = initial
  for (let step = 0; step < 40; step += 1) {
    const battle = state.pendingBattle
    if (!battle) return state
    const playerId = getActingPlayerId(state)
    state = battle.stage === 'damage'
      ? applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
      : battle.stage === 'flip'
        ? applyGameCommand(state, { kind: 'resolve-flip', playerId, activate: false })
        : battle.stage === 'trap'
          ? applyGameCommand(state, { kind: 'skip-trap', playerId })
          : applyGameCommand(state, { kind: 'resolve-battle', playerId })
  }
  throw Error('The original Trap response and attack did not settle')
}

const replay = (initial: GameState, final: GameState) => {
  let replayed = structuredClone(initial)
  for (const entry of final.commandLog ?? []) replayed = applyGameCommand(replayed, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(final)))
}

describe('ST9-017–019 original Trap physical flows', () => {
  it.each([
    ['ST9-017', 'positive'], ['ST9-017', 'high-hand'], ['ST9-018', 'positive'],
    ['ST9-019', 'positive'], ['ST9-019', 'one-hp-target'], ['ST9-019', 'no-blue-payment'],
  ] as const)('%s %s uses two original sixty-card decks, printed HP and copy limits', (cardNumber, scenario) => {
    const state = createSt9TrapPreviewState(cardNumber, scenario)
    const instanceIds: string[] = []
    for (const playerId of [owner, opponent]) {
      const cards = allCards(state, playerId)
      expect(cards).toHaveLength(60)
      instanceIds.push(...cards.map(card => card.instanceId))
      const copies = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
      }
      expect([...copies.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of state.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(new Set(instanceIds).size).toBe(120)
    expect(state.pendingBattle).toMatchObject({ attackerPlayerId: opponent, defenderPlayerId: owner, stage: 'trap', declaredDamage: 4 })
  })

  it('ST9-017 pays BBB, reduces only the chosen attacker, then draws two at hand size three', () => {
    const start = createSt9TrapAttackStartState('ST9-017')
    const initial = createSt9TrapPreviewState('ST9-017')
    const defender = initial.players[owner].battleArea[0]!
    const selectedAttacker = attacker(initial)
    const paid = playTrap(initial, 'ST9-017')
    expect(paid.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
    expect(paid.attackModifiers.filter(modifier => modifier.sourceInstanceId === trap(initial, 'ST9-017').instanceId))
      .toEqual([expect.objectContaining({ targetInstanceId: selectedAttacker.card.instanceId, amount: -3 })])
    expect(paid.pendingBattle?.declaredDamage).toBe(1)
    expect(paid.pendingDrawUpTo).toMatchObject({ playerId: owner, max: 2 })
    const drawn = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 2 })
    expect(drawn.players[owner].hand).toHaveLength(4)
    expect(drawn.players[owner].deck).toHaveLength(paid.players[owner].deck.length - 2)
    const settled = settleBattle(drawn)
    expect(settled.players[owner].battleArea[0]?.hpCards).toHaveLength(defender.hpCards.length - 1)
    expect(settled.pendingBattle).toBeNull()
    replay(start, settled)
  })

  it('ST9-017 still applies -3 above the hand threshold but does not offer its conditional draw', () => {
    const initial = createSt9TrapPreviewState('ST9-017', 'high-hand')
    expect(initial.players[owner].hand).toHaveLength(5)
    const paid = playTrap(initial, 'ST9-017')
    expect(paid.pendingDrawUpTo ?? null).toBeNull()
    expect(paid.attackModifiers.some(modifier => modifier.amount === -3 && modifier.sourceInstanceId === trap(initial, 'ST9-017').instanceId)).toBe(true)
    expect(settleBattle(paid).players[owner].battleArea[0]?.hpCards).toHaveLength(4)
    replay(createSt9TrapAttackStartState('ST9-017', 'high-hand'), paid)
  })

  it('ST9-017 permits zero Cookies for the first effect while its independent Then draw remains available', () => {
    const initial = createSt9TrapPreviewState('ST9-017')
    const paid = playTrap(initial, 'ST9-017', [])
    expect(paid.attackModifiers.some(modifier => modifier.sourceInstanceId === trap(initial, 'ST9-017').instanceId)).toBe(false)
    expect(paid.pendingBattle?.declaredDamage).toBe(4)
    expect(paid.pendingDrawUpTo?.max).toBe(2)
  })

  it('ST9-018 pays B, then the optional discard applies the second -1 to the same selected Cookie', () => {
    const start = createSt9TrapAttackStartState('ST9-018')
    const initial = createSt9TrapPreviewState('ST9-018')
    const targetId = attacker(initial).card.instanceId
    const first = playTrap(initial, 'ST9-018')
    expect(first.pendingAbilityEffect?.previousEffectTargetIds).toEqual([targetId])
    const then = openOptionalThen(first)
    expect(then.pendingOptionalCostAttack?.cost.discardHand).toBe(1)
    const paidThen = payDiscardThen(then, 1)
    const resolved = applyGameCommand(paidThen, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [targetId] })
    expect(resolved.attackModifiers.filter(modifier => modifier.sourceInstanceId === trap(initial, 'ST9-018').instanceId)
      .map(modifier => [modifier.targetInstanceId, modifier.amount])).toEqual([[targetId, -1], [targetId, -1]])
    expect(resolved.pendingBattle?.declaredDamage).toBe(2)
    expect(resolved.players[owner].discardPile.some(card => card.instanceId === then.players[owner].hand[0]?.instanceId)).toBe(true)
    const settled = settleBattle(resolved)
    expect(settled.players[owner].battleArea[0]?.hpCards).toHaveLength(3)
    replay(start, settled)
  })

  it('ST9-018 can skip the discard Then without losing the first reduction', () => {
    const initial = createSt9TrapPreviewState('ST9-018')
    const targetId = attacker(initial).card.instanceId
    const then = openOptionalThen(playTrap(initial, 'ST9-018'))
    const skipped = applyGameCommand(then, { kind: 'resolve-optional-cost-attack', playerId: owner, action: 'skip' })
    expect(skipped.players[owner].hand).toHaveLength(1)
    expect(skipped.attackModifiers.filter(modifier => modifier.sourceInstanceId === trap(initial, 'ST9-018').instanceId)
      .map(modifier => [modifier.targetInstanceId, modifier.amount])).toEqual([[targetId, -1]])
    expect(skipped.pendingBattle?.declaredDamage).toBe(3)
    replay(createSt9TrapAttackStartState('ST9-018'), skipped)
  })

  it('ST9-018 does not accept the independent Cookie as a substitute for the first selected target', () => {
    const initial = createSt9TrapPreviewState('ST9-018')
    const otherId = initial.players[opponent].battleArea[1]!.card.instanceId
    const then = openOptionalThen(playTrap(initial, 'ST9-018'))
    const paid = payDiscardThen(then, 1)
    const before = structuredClone(paid)
    expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [otherId] })).toThrow()
    expect(paid).toEqual(before)
  })

  it('ST9-019 pays discard two, reduces the attacker, and damages a separately selected 2+ HP Cookie', () => {
    const start = createSt9TrapAttackStartState('ST9-019')
    const initial = createSt9TrapPreviewState('ST9-019')
    const attackerId = attacker(initial).card.instanceId
    const other = initial.players[opponent].battleArea[1]!
    const first = playTrap(initial, 'ST9-019', [attackerId])
    expect(first.pendingAbilityEffect?.previousEffectTargetIds).toEqual([attackerId])
    const then = openOptionalThen(first)
    expect(then.pendingOptionalCostAttack?.cost.discardHand).toBe(2)
    const paid = payDiscardThen(then, 2)
    const pendingDamage = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [other.card.instanceId] })
    const damaged = settleBattle(pendingDamage)
    expect(damaged.attackModifiers.some(modifier => modifier.targetInstanceId === attackerId && modifier.amount === -1)).toBe(true)
    expect(damaged.players[opponent].battleArea[1]?.hpCards).toHaveLength(other.hpCards.length - 1)
    expect(damaged.pendingBattle).toBeNull()
    replay(start, damaged)
  })

  it('ST9-019 excludes a 1-HP Cookie from the independent damage Then', () => {
    const initial = createSt9TrapPreviewState('ST9-019', 'one-hp-target')
    const lowHp = initial.players[opponent].battleArea.find(cookie => cookie.card.id === 'ST4-010')!
    expect(lowHp.hpCards).toHaveLength(1)
    const then = openOptionalThen(playTrap(initial, 'ST9-019'))
    const paid = payDiscardThen(then, 2)
    const before = structuredClone(paid)
    expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [lowHp.card.instanceId] })).toThrow()
    expect(paid).toEqual(before)
  })

  it('ST9-019 can skip its optional discard and keep the first -1 reduction', () => {
    const initial = createSt9TrapPreviewState('ST9-019')
    const targetId = attacker(initial).card.instanceId
    const then = openOptionalThen(playTrap(initial, 'ST9-019'))
    const skipped = applyGameCommand(then, { kind: 'resolve-optional-cost-attack', playerId: owner, action: 'skip' })
    expect(skipped.players[owner].hand).toHaveLength(2)
    expect(skipped.attackModifiers.filter(modifier => modifier.sourceInstanceId === trap(initial, 'ST9-019').instanceId)
      .map(modifier => [modifier.targetInstanceId, modifier.amount])).toEqual([[targetId, -1]])
    expect(skipped.pendingBattle?.declaredDamage).toBe(3)
    replay(createSt9TrapAttackStartState('ST9-019'), skipped)
  })

  it.each([
    ['ST9-017', rawSt9017, 3], ['ST9-018', rawSt9018, 1], ['ST9-019', rawSt9019, 1],
  ] as const)('%s keeps its printed original identity, image, and blue Trap cost', (cardNumber, raw, blueCost) => {
    const state = createSt9TrapPreviewState(cardNumber)
    const source = trap(state, cardNumber)
    expect([source.name, source.type, source.energyColor, source.imageUrl]).toEqual([
      raw.name, 'trap', 'blue', raw.imageUrl,
    ])
    expect(source.trap?.cost.energy?.blue).toBe(blueCost)
    expect(getTrapCandidates(state, owner).some(card => card.id === cardNumber)).toBe(true)
    expect(source.imageUrl).toBe(raw.imageUrl)
  })
})
