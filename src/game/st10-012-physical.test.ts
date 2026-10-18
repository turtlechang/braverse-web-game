import { describe, expect, it } from 'vitest'
import { convertOfficialFlipAbility } from '../cards/official-effect-adapter'
import { applyGameCommand } from './commands'
import { parseTestStateConfig } from './demo'
import { createSt10012FlipPreviewState, rawSt10012 } from './st10-012-demo'
import { st10006Zones } from './st10-006-demo'
import type { GameCard, GameState, PlayerId } from './types'

const physicalCards = (state: GameState, playerId: PlayerId): GameCard[] => [
  ...st10006Zones(state, playerId),
  ...(state.pendingBattle?.defenderPlayerId === playerId && state.pendingBattle.revealedHpCard
    ? [state.pendingBattle.revealedHpCard]
    : []),
]

const assertPhysicalDecks = (state: GameState) => {
  const allIds = new Set<string>()
  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = physicalCards(state, playerId)
    expect(cards).toHaveLength(60)
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
    const copyCounts = new Map<string, number>()
    for (const card of cards) {
      expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
      expect(allIds.has(card.instanceId)).toBe(false)
      allIds.add(card.instanceId)
      copyCounts.set(card.id, (copyCounts.get(card.id) ?? 0) + 1)
    }
    expect([...copyCounts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(allIds.size).toBe(120)
}

describe('ST10-012 Taurus Cookie physical FLIP', () => {
  it.each(['positive', 'negative'] as const)('accepts the %s preview only on localhost', scenario => {
    expect(parseTestStateConfig(`?test-state=st10-012-flip:${scenario}`, 'localhost')).toEqual({
      kind: 'st10-012-flip',
      scenario,
    })
    expect(parseTestStateConfig(`?test-state=st10-012-flip:${scenario}`, 'example.com')).toBeNull()
  })

  it('converts the original LV.3 / 4 HP print into the one-card attached +1 HP effect', () => {
    const original = rawSt10012()
    expect(original).toMatchObject({
      cardNumber: 'ST10-012',
      name: 'Taurus Cookie',
      type: 'flip',
      color: 'PURPLE',
      level: 3,
      hp: 4,
      attackText: '<{P}{P}{P}{P}> Bull Rush {da} 4',
      flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/_KHzeIXwGFJqRr-nvgD66Q.webp',
    })
    expect(convertOfficialFlipAbility(original)).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
  })

  it('reveals ST10-012 through an original attack, pays one real hand card, and adds one HP to that bearer', () => {
    const state = createSt10012FlipPreviewState('positive')
    const revealed = state.pendingBattle?.revealedHpCard
    const bearer = state.players['player-one'].battleArea.find(entry => entry.card.id === 'ST10-006')
    const payment = state.players['player-one'].hand[0]
    const gainedHp = state.players['player-one'].deck[0]
    if (!revealed || !bearer || !payment || !gainedHp) throw new Error('ST10-012 positive fixture is incomplete')
    expect(revealed.id).toBe('ST10-012')
    expect(bearer.hpCards).toHaveLength(1)
    expect(state.commandLog?.map(entry => entry.commandKind)).toEqual([
      'declare-attack', 'skip-trap', 'resolve-next-damage',
    ])
    assertPhysicalDecks(state)

    const resolved = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [payment.instanceId],
    })
    const healed = resolved.players['player-one'].battleArea.find(entry => entry.card.instanceId === bearer.card.instanceId)
    expect(healed?.hpCards.map(card => card.instanceId)).toEqual([bearer.hpCards[0]!.instanceId, gainedHp.instanceId])
    expect(resolved.players['player-one'].hand).toEqual([])
    expect(resolved.players['player-one'].deck).toHaveLength(state.players['player-one'].deck.length - 1)
    expect(resolved.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(
      expect.arrayContaining([revealed.instanceId, payment.instanceId]),
    )
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.cookiesGainedHpThisTurn?.['player-one']).toBe(true)
    assertPhysicalDecks(resolved)
  })

  it('requires a real discard payment and permits skipping without changing HP or deck', () => {
    const state = createSt10012FlipPreviewState('negative')
    const revealed = state.pendingBattle?.revealedHpCard
    const bearer = state.players['player-one'].battleArea.find(entry => entry.card.id === 'ST10-006')
    if (!revealed || !bearer) throw new Error('ST10-012 negative fixture is incomplete')
    const snapshot = structuredClone(state)
    expect(state.players['player-one'].hand).toEqual([])
    expect(() => applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [],
    })).toThrow()
    expect(state).toEqual(snapshot)

    const declined = applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-one', activate: false, discardHandIds: [],
    })
    expect(declined.players['player-one'].battleArea.find(entry => entry.card.instanceId === bearer.card.instanceId)?.hpCards)
      .toEqual(bearer.hpCards)
    expect(declined.players['player-one'].deck.map(card => card.instanceId))
      .toEqual(state.players['player-one'].deck.map(card => card.instanceId))
    expect(declined.players['player-one'].discardPile.map(card => card.instanceId)).toContain(revealed.instanceId)
    expect(declined.cookiesGainedHpThisTurn?.['player-one']).not.toBe(true)
    expect(declined.pendingBattle).toBeNull()
    assertPhysicalDecks(declined)
  })
})
