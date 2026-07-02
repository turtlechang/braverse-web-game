import { describe, expect, it } from 'vitest'
import {
  refreshDeck,
  resolveDrawUpTo,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
  type GameCard,
} from '.'
import { cookie, createBattleState, declareAttack, item } from './test-helpers/battle-helpers'

describe('pending battle and FLIP', () => {
  it('rests attack payment immediately and waits for a trap response', () => {
    const state = declareAttack(createBattleState())

    expect(state.players['player-two'].battleArea[0].rested).toBe(true)
    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
    expect(state.pendingBattle).toMatchObject({
      stage: 'trap',
      declaredDamage: 3,
      remainingDamage: 3,
    })
  })

  it('reveals HP cards one at a time and pauses for FLIP', () => {
    const flipCard: GameCard = {
      ...cookie('draw-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [
      item('hp-bottom'),
      flipCard,
    ]
    state = declareAttack(state)
    state = skipTrap(state, 'player-one')
    state = resolveNextDamage(state)

    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard).toBe(flipCard)
    expect(state.players['player-one'].discardPile).not.toContain(flipCard)

    state = resolveFlip(state, 'player-one', { activate: true })

    expect(state.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 1,
    })
    expect(state.players['player-one'].hand).not.toContainEqual(
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    )
    expect(state.players['player-one'].discardPile).toContain(flipCard)

    state = resolveDrawUpTo(state, 'player-one', 1)

    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    )
    expect(state.pendingDrawUpTo ?? null).toBeNull()
  })

  it('can skip a FLIP effect without creating its draw decision', () => {
    const flipCard: GameCard = {
      ...cookie('optional-draw-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [
      item('hp-bottom'),
      flipCard,
    ]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))
    state = resolveFlip(state, 'player-one', { activate: false })

    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-one'].hand).not.toContainEqual(
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    )
    expect(state.players['player-one'].discardPile).toContain(flipCard)
    expect(state.pendingBattle?.stage).toBe('damage')
  })

  it('pays the discard cost and adds HP from the deck top', () => {
    const flipCard: GameCard = {
      ...cookie('gain-hp-flip'),
      officialType: 'flip',
      flip: {
        text:
          '《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP.',
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'gain-hp', amount: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state = declareAttack(state)
    state = skipTrap(state, 'player-one')
    state = resolveNextDamage(state)
    state = resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: ['p1-hand-a'],
    })

    expect(state.players['player-one'].battleArea[0].hpCards).toEqual([
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    ])
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId))
      .toEqual(expect.arrayContaining(['p1-hand-a', 'gain-hp-flip']))
  })

  it('rejects FLIP activation when its discard cost is not paid', () => {
    const flipCard: GameCard = {
      ...cookie('costly-flip'),
      officialType: 'flip',
      flip: {
        text: 'Discard 1 card.',
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'gain-hp', amount: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))

    expect(() =>
      resolveFlip(state, 'player-one', { activate: true }),
    ).toThrow('Must discard exactly 1 cards for FLIP activation.')
  })

  it('pauses FLIP damage continuation until pending Refresh is completed', () => {
    const flipCard: GameCard = {
      ...cookie('refresh-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].deck = [item('last-draw')]
    state.players['player-one'].discardPile = [
      cookie('refresh-cookie'),
      item('refresh-item'),
    ]
    state.players['player-one'].battleArea[0].hpCards = [
      item('hp-bottom'),
      flipCard,
    ]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))
    state = resolveFlip(state, 'player-one', { activate: true })
    expect(state.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 1,
    })

    state = resolveDrawUpTo(state, 'player-one', 1)

    expect(state.pendingRefresh).toEqual({
      playerId: 'player-one',
      remainingDraws: 0,
    })
    expect(() => resolveNextDamage(state)).toThrow('Invalid battle action.')

    state = refreshDeck(
      state,
      'player-one',
      'refresh-cookie',
      (cards) => [...cards],
    )
    expect(state.pendingBattle?.stage).toBe('damage')
  })
})
