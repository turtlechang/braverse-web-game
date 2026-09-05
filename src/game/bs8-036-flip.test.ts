import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getCookieEffectiveHp } from './helpers'
import { createBattleState } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const physicalCardIds = (state: GameState) => [
  ...Object.values(state.players).flatMap((player) => [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map((entry) => entry.card),
    ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? []), ...(entry.awakenedUnderlay ?? [])]),
    ...(player.stage ? [player.stage.card] : []),
    ...(player.extraDeck ?? []),
  ]),
  ...(state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : []),
].map((card) => card.instanceId).sort()

const setup = (withHand = true) => {
  const base = createBattleState()
  const flip = official('BS8-036', 'flip')
  const attacker = official('BS8-036', 'attacker')
  const defender = official('BS8-030', 'defender')
  if (attacker.type !== 'cookie' || defender.type !== 'cookie') throw new Error('Expected real Cookies')
  const bottomHp = official('BS8-046', 'bottom-hp')
  const handCost = official('BS8-046', 'hand-cost')
  const otherHand = official('BS8-040', 'other-hand')
  const topDeck = official('BS8-046', 'deck-top')
  const support = official('BS8-037', 'yellow-support')
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{ card: defender, hpCards: [bottomHp, flip], rested: false }],
        hand: withHand ? [handCost, otherHand] : [],
        deck: [topDeck, official('BS8-046', 'deck-bottom')],
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [{ card: attacker, hpCards: [official('BS8-046', 'attacker-hp')], rested: false }],
        supportArea: [{ card: support, rested: false }],
      },
    },
  }
  const declared = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: [support.instanceId] })
  const unblocked = applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' })
  const revealed = applyGameCommand(unblocked, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(revealed.pendingBattle?.stage).toBe('flip')
  expect(revealed.pendingBattle?.revealedHpCard).toEqual(flip)
  expect(revealed.players['player-one'].battleArea[0].hpCards).toEqual([bottomHp])
  expect(physicalCardIds(revealed)).toEqual(physicalCardIds(state))
  return { state, revealed, flip, defender, bottomHp, handCost, otherHand, topDeck }
}

describe('BS8-036 Young Kulfi FLIP through declared attack damage', () => {
  it('pays one hand card before gaining one real HP card from a revealed FLIP', () => {
    const { state, revealed, flip, bottomHp, handCost, otherHand, topDeck } = setup()
    expect(flip.name).toBe('Young Kulfi')
    expect(flip.flip).toMatchObject({ cost: { energy: {}, discardHand: 1 }, effects: [], attachedHpBonus: 1 })
    // A face-down FLIP cannot change HP before it is revealed and paid for.
    expect(getCookieEffectiveHp(state.players['player-one'].battleArea[0])).toBe(2)
    expect(getCookieEffectiveHp(revealed.players['player-one'].battleArea[0])).toBe(1)
    const resolved = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [handCost.instanceId] })
    const player = resolved.players['player-one']
    expect(player.battleArea[0].hpCards).toEqual([bottomHp, topDeck])
    expect(getCookieEffectiveHp(player.battleArea[0])).toBe(2)
    expect(player.deck).toEqual(revealed.players['player-one'].deck.slice(1))
    expect(player.hand).toEqual([otherHand])
    expect(player.discardPile).toEqual([handCost, flip])
    expect(resolved.pendingBattle).toBeNull()
    expect(physicalCardIds(resolved)).toEqual(physicalCardIds(state))
    expect(revealed.players['player-one'].hand).toEqual([handCost, otherHand])
  })

  it.each([true, false])('can decline with hand available: %s; pays nothing and gains no HP', (withHand) => {
    const { state, revealed, flip, bottomHp } = setup(withHand)
    const resolved = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-one', activate: false })
    expect(resolved.players['player-one'].battleArea[0].hpCards).toEqual([bottomHp])
    expect(resolved.players['player-one'].hand).toEqual(revealed.players['player-one'].hand)
    expect(resolved.players['player-one'].deck).toEqual(revealed.players['player-one'].deck)
    expect(resolved.players['player-one'].discardPile).toEqual([flip])
    expect(physicalCardIds(resolved)).toEqual(physicalCardIds(state))
  })

  it('cannot activate without a hand card to pay', () => {
    const { revealed } = setup(false)
    const snapshot = structuredClone(revealed)
    expect(() => applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [] })).toThrow()
    expect(revealed).toEqual(snapshot)
  })

  it.each(['missing', 'unknown', 'wrong-zone', 'duplicate', 'excess'] as const)('rejects %s discard payment without changing cards', (caseName) => {
    const { revealed, flip, handCost, otherHand } = setup()
    const ids = {
      missing: [], unknown: ['not-a-card'], 'wrong-zone': [flip.instanceId],
      duplicate: [handCost.instanceId, handCost.instanceId],
      excess: [handCost.instanceId, otherHand.instanceId],
    }[caseName]
    const snapshot = structuredClone(revealed)
    expect(() => applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: ids })).toThrow()
    expect(revealed).toEqual(snapshot)
  })
})
