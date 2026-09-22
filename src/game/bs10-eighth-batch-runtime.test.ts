import { describe, expect, it } from 'vitest'
import bs10 from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { isCookieAttackRestricted, resolveAttackEffect, resolveOptionalCostAttack } from './battle'
import { executeCardEffect } from './effects/execute'
import { isEffectConditionMet, isOpponentBattleMovementPrevented } from './effects/targeting'
import { refreshDeck } from './refresh'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs10.cards as unknown as OfficialCardRecord[]

const official = (id: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === id)
  if (!record) throw new Error(`Missing candidate ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-eighth-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const baseState = (): GameState => {
  const state = createBattleState()
  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [],
        hand: [],
        deck: [],
        supportArea: [],
        discardPile: [],
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [],
        hand: [],
        deck: [],
        supportArea: [],
        discardPile: [],
      },
    },
  }
}

describe('BS10 eighth runtime batch', () => {
  it('fires Licorice departure only for a direct battle-to-trash movement', () => {
    const licorice = official('BS10-109', 'departure')
    const state = baseState()
    state.players['player-two'] = {
      ...state.players['player-two'],
      battleArea: [entry(licorice, [item('licorice-hp', 'purple')])],
      deck: [
        item('mill-1', 'purple'),
        item('mill-2', 'purple'),
        item('mill-3', 'purple'),
        item('deck-remains', 'purple'),
      ],
    }

    const movedToTrash = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'removal', sourceCardName: 'removal' },
      { kind: 'field-to-trash', target: { side: 'opponent', min: 1, max: 1 } },
      [licorice.instanceId],
    )
    expect(movedToTrash.players['player-two'].battleArea).toHaveLength(0)
    expect(movedToTrash.players['player-two'].deck.map((card) => card.instanceId)).toEqual(['deck-remains'])
    expect(movedToTrash.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual([
      licorice.instanceId,
      'licorice-hp',
      'mill-1',
      'mill-2',
      'mill-3',
    ])

    const movedToBreak = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'removal-break', sourceCardName: 'removal' },
      {
        kind: 'opponent-battle-to-trash',
        min: 1,
        maxLevel: 5,
        destination: 'break',
      },
      [licorice.instanceId],
    )
    expect(movedToBreak.players['player-two'].breakArea.map((card) => card.instanceId)).toContain(licorice.instanceId)
    expect(movedToBreak.players['player-two'].deck).toHaveLength(4)
  })

  it('keeps Hollyberry attack restriction and Silverbell movement lock state-dependent', () => {
    const hollyberry = official('BS10-021', 'hollyberry')
    const hollyState = baseState()
    const hollyThreeHp = entry(hollyberry, [item('holly-hp-1', 'yellow'), item('holly-hp-2', 'yellow'), item('holly-hp-3', 'yellow')])
    const hollyFourHp = { ...hollyThreeHp, hpCards: [...hollyThreeHp.hpCards, item('holly-hp-4', 'yellow')] }
    expect(isCookieAttackRestricted({ ...hollyState, players: { ...hollyState.players, 'player-one': { ...hollyState.players['player-one'], battleArea: [hollyThreeHp] } } }, 'player-one', hollyThreeHp)).toBe(true)
    expect(isCookieAttackRestricted({ ...hollyState, players: { ...hollyState.players, 'player-one': { ...hollyState.players['player-one'], battleArea: [hollyFourHp] } } }, 'player-one', hollyFourHp)).toBe(false)

    const silverbell = official('BS10-070', 'silverbell')
    let movementState = {
      ...baseState(),
      players: {
        ...baseState().players,
        'player-two': {
          ...baseState().players['player-two'],
          battleArea: [entry(silverbell, [item('bell-hp', 'blue')])],
          supportArea: Array.from({ length: 4 }, (_, index) => ({ card: item(`bell-support-${index}`, 'blue'), rested: false })),
        },
      },
    }
    expect(isOpponentBattleMovementPrevented(movementState, 'player-one')).toBe(false)
    expect(isOpponentBattleMovementPrevented(movementState, 'player-one', silverbell.instanceId)).toBe(true)
    movementState = {
      ...movementState,
      players: {
        ...movementState.players,
        'player-two': {
          ...movementState.players['player-two'],
          supportArea: [...movementState.players['player-two'].supportArea, { card: item('bell-support-4', 'blue'), rested: false }],
        },
      },
    }
    expect(isOpponentBattleMovementPrevented(movementState, 'player-one', silverbell.instanceId)).toBe(false)
  })

  it('records a player Refresh for later BS10 condition checks', () => {
    const state = baseState()
    const refreshCookie = official('BS10-109', 'refresh-cookie')
    const refreshed = refreshDeck(
      {
        ...state,
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            deck: [],
            discardPile: [
              refreshCookie,
              item('refresh-1', 'blue'),
              item('refresh-2', 'blue'),
            ],
          },
        },
      },
      'player-one',
      refreshCookie.instanceId,
      (cards) => cards,
    )
    expect(refreshed.refreshedDuringGame?.['player-one']).toBe(true)
    expect(refreshed.players['player-one'].deck.map((card) => card.instanceId)).toEqual(['refresh-1', 'refresh-2'])
    expect(refreshed.players['player-one'].breakArea.map((card) => card.instanceId)).toContain(refreshCookie.instanceId)
  })

  it('treats an empty or fully rested opponent support area as all-rested', () => {
    const state = baseState()
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'elder-fae-source',
    }
    const condition = { kind: 'all-support-rested' as const, side: 'opponent' as const }
    const gatedEffect = { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 0, max: 1 }, condition }
    expect(isEffectConditionMet(state, context, gatedEffect)).toBe(true)

    const activeSupport = { card: item('elder-active-support', 'green'), rested: false }
    const activeState = {
      ...state,
      players: {
        ...state.players,
        'player-two': { ...state.players['player-two'], supportArea: [activeSupport] },
      },
    }
    expect(isEffectConditionMet(activeState, context, gatedEffect)).toBe(false)
    const restedState = {
      ...activeState,
      players: {
        ...activeState.players,
        'player-two': { ...activeState.players['player-two'], supportArea: [{ ...activeSupport, rested: true }] },
      },
    }
    expect(isEffectConditionMet(restedState, context, gatedEffect)).toBe(true)
  })

  it('counts only rested support cards for BS10-067 thresholds', () => {
    const state = baseState()
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'mossy-bridge-source',
    }
    const condition = { kind: 'support-count-at-least' as const, count: 2, restedOnly: true }
    const effect = {
      kind: 'set-active' as const,
      supportCount: 1,
      selectable: true,
      optional: true,
      condition,
    }
    const mixedSupport = [
      { card: item('bridge-rested', 'green'), rested: true },
      { card: item('bridge-active', 'green'), rested: false },
    ]
    expect(isEffectConditionMet({
      ...state,
      players: {
        ...state.players,
        'player-one': { ...state.players['player-one'], supportArea: mixedSupport },
      },
    }, context, effect)).toBe(false)
    expect(isEffectConditionMet({
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: mixedSupport.map((support) => ({ ...support, rested: true })),
        },
      },
    }, context, effect)).toBe(true)
  })

  it('pays BS10-121 by milling the deck before its optional damage', () => {
    const charcoal = official('BS10-121', 'charcoal-attack')
    const defender = official('BS10-072', 'charcoal-target')
    const state = baseState()
    const attacker = entry(charcoal, [item('charcoal-hp', 'purple')])
    const target = entry(defender, [item('charcoal-target-hp', 'green')])
    const attack = charcoal.type === 'cookie' ? charcoal.attackEffects ?? [] : []
    const pending = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [attacker],
          deck: Array.from({ length: 5 }, (_, index) => item(`charcoal-mill-${index}`, 'purple')),
        },
        'player-one': {
          ...state.players['player-one'],
          battleArea: [target],
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two' as const,
        defenderPlayerId: 'player-one' as const,
        attackerInstanceId: attacker.card.instanceId,
        targetInstanceId: target.card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: attack,
        attackEffectIndex: 0,
      },
    }

    const awaitingPayment = resolveAttackEffect(pending, 'player-two', [])
    expect(awaitingPayment.pendingOptionalCostAttack?.cost.deckToTrash).toEqual({ amount: 5 })

    const paid = resolveOptionalCostAttack(
      awaitingPayment,
      'player-two',
      'pay',
      [],
      [target.card.instanceId],
    )
    expect(paid.players['player-two'].deck).toHaveLength(0)
    expect(paid.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining(['charcoal-mill-0', 'charcoal-mill-4']),
    )
    expect(paid.pendingOptionalCostAttack).toBeFalsy()
  })

  it('keeps BS10-121 pending across a Refresh when the deck cost exhausts the deck', () => {
    const charcoal = official('BS10-121', 'charcoal-refresh-attack')
    const defender = official('BS10-072', 'charcoal-refresh-target')
    const refreshCookie = official('BS10-109', 'charcoal-refresh-cookie')
    const secondCookie = official('BS10-070', 'charcoal-refresh-second-cookie')
    const state = baseState()
    const attacker = entry(charcoal, [item('charcoal-refresh-hp', 'purple')])
    const target = entry(defender, [item('charcoal-refresh-target-hp', 'green')])
    const attack = charcoal.type === 'cookie' ? charcoal.attackEffects ?? [] : []
    const pending = resolveAttackEffect(
      {
        ...state,
        players: {
          ...state.players,
          'player-two': {
            ...state.players['player-two'],
            battleArea: [attacker],
            deck: [item('charcoal-refresh-first-mill', 'purple')],
            discardPile: [refreshCookie, secondCookie, item('charcoal-refresh-1', 'purple'), item('charcoal-refresh-2', 'purple'), item('charcoal-refresh-3', 'purple'), item('charcoal-refresh-4', 'purple')],
          },
          'player-one': {
            ...state.players['player-one'],
            battleArea: [target],
          },
        },
        pendingBattle: {
          attackerPlayerId: 'player-two' as const,
          defenderPlayerId: 'player-one' as const,
          attackerInstanceId: attacker.card.instanceId,
          targetInstanceId: target.card.instanceId,
          declaredDamage: 0,
          remainingDamage: 0,
          stage: 'attack-effect' as const,
          trapUsed: false,
          revealedHpCard: null,
          preventKnockoutTargetIds: [],
          faintedColors: [],
          attackEffects: attack,
          attackEffectIndex: 0,
        },
      },
      'player-two',
      [],
    )
    const millPending = resolveOptionalCostAttack(pending, 'player-two', 'pay', [], [target.card.instanceId])
    expect(millPending.pendingRefresh?.remainingDeckToTrash?.effect.amount).toBe(4)
    expect(millPending.pendingOptionalCostAttack?.cost.deckToTrash).toEqual({ amount: 0 })

    const refreshed = refreshDeck(
      millPending,
      'player-two',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.pendingOptionalCostAttack).toBeTruthy()
    expect(refreshed.pendingOptionalCostAttack?.cost.deckToTrash).toEqual({ amount: 0 })
    expect(refreshed.players['player-two'].deck.map((card) => card.instanceId)).toEqual([
      'charcoal-refresh-4',
      'charcoal-refresh-first-mill',
    ])

    const finished = resolveOptionalCostAttack(
      refreshed,
      'player-two',
      'pay',
      [],
      [target.card.instanceId],
    )
    expect(finished.pendingOptionalCostAttack).toBeFalsy()
  })
})
