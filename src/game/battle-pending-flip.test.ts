import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  executeCardEffect,
  getAttackDamageAgainst,
  refreshDeck,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
  type CardEffect,
  type GameCard,
} from '.'
import { cookie, createBattleState, declareAttack, item } from './test-helpers/battle-helpers'
import officialBs6 from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'

describe('pending battle and FLIP', () => {
  it('routes skill/item effect damage through the same FLIP flow as attack damage', () => {
    const flipCard: GameCard = {
      ...item('effect-damage-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw 1 card.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw', amount: 1, side: 'self' }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]

    state = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Effect damage source',
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      ['defender'],
    )

    expect(state.pendingBattle?.stage).toBe('damage')
    state = resolveNextDamage(state)
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard).toBe(flipCard)

    state = resolveFlip(state, 'player-one', { activate: false })

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-one'].breakArea.map((card) => card.instanceId)).toContain(
      'defender',
    )
    expect(state.players['player-one'].discardPile).toContainEqual(flipCard)
  })

  it('does not trigger FLIP when an effect moves an HP card without dealing damage', () => {
    const flipCard: GameCard = {
      ...item('non-damage-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw 1 card.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = {
      ...createBattleState(),
      players: {
        ...createBattleState().players,
        'player-one': {
          ...createBattleState().players['player-one'],
          battleArea: [
            {
              ...createBattleState().players['player-one'].battleArea[0],
              hpCards: [item('hp-bottom'), flipCard],
            },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'item-source',
      },
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1 },
      },
      ['defender'],
    )

    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.players['player-one'].battleArea[0].hpCards).toEqual([
      expect.objectContaining({ instanceId: 'hp-bottom' }),
    ])
    expect(resolved.players['player-one'].discardPile).toContainEqual(flipCard)
  })

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

    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    )
    expect(state.players['player-one'].discardPile).toContain(flipCard)
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

  it('BS6-069 opens FLIP and converts its attached +1 HP into a real HP card', () => {
    const source = (officialBs6.cards as OfficialCardRecord[]).find(
      (card) => card.cardNumber === 'BS6-069',
    )
    expect(source).toBeDefined()
    const conversion = convertOfficialCardToGameCard(source!)
    expect(conversion.status).toBe('converted')
    if (conversion.status !== 'converted') return
    const flipCard = conversion.gameCard
    expect(flipCard.flip).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })

    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))

    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS6-069')

    state = resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: ['p1-hand-a'],
    })

    expect(state.players['player-one'].battleArea[0].hpCards).toEqual([
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    ])
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId))
      .toEqual(expect.arrayContaining(['p1-hand-a', 'BS6-069:1']))
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

    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'last-draw' }),
    )
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

  it('FLIP draw-up-to draws immediately without a pending decision', () => {
    const flipCard: GameCard = {
      ...cookie('name-flip'),
      name: 'Test FLIP Card',
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].deck = [item('draw-card')]
    state.players['player-one'].discardPile = [cookie('refresh-cookie')]
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))
    state = resolveFlip(state, 'player-one', { activate: true })
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'draw-card' }),
    )
  })

  it('resolves a choose-one FLIP mode before executing its deck effect', () => {
    const flipCard: GameCard = {
      ...cookie('choose-deck-flip'),
      officialType: 'flip',
      flip: {
        text: 'Place up to 3 cards from the top of either player deck into the trash.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'choose-one',
          modes: [
            {
              label: 'your deck',
              effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
            },
            {
              label: "opponent's deck",
              effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
            },
          ],
        }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state.players['player-one'].deck = [item('self-mill-1'), item('self-mill-2'), item('self-mill-3')]
    state.players['player-two'].deck = [item('opponent-mill-1'), item('opponent-mill-2'), item('opponent-mill-3')]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))

    state = resolveFlip(state, 'player-one', {
      activate: true,
      chooseOneModeIndex: 1,
    })

    expect(state.players['player-one'].deck.map((card) => card.instanceId)).toEqual([
      'self-mill-1',
      'self-mill-2',
      'self-mill-3',
    ])
    expect(state.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual([
      'opponent-mill-1',
      'opponent-mill-2',
      'opponent-mill-3',
    ])
    expect(state.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ instanceId: 'choose-deck-flip' }),
    )
  })

  it('passes a selected target into a targeted FLIP effect', () => {
    const flipCard: GameCard = {
      ...cookie('targeted-flip'),
      officialType: 'flip',
      flip: {
        text: 'Select up to 1 opponent Cookie. That Cookie receives 1 damage.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state.players['player-two'].battleArea[0].hpCards = [
      item('attacker-hp-a'),
      item('attacker-hp-b'),
      item('attacker-hp-c'),
      item('attacker-hp-d'),
    ]
    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))

    state = resolveFlip(state, 'player-one', {
      activate: true,
      targetIds: [state.players['player-two'].battleArea[0].card.instanceId],
    })

    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(state.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ instanceId: 'targeted-flip' }),
    )
  })

  it('finishes safely when a targeted FLIP defeats the attacking Cookie', () => {
    const flipCard: GameCard = {
      ...cookie('defeat-attacker-flip'),
      officialType: 'flip',
      flip: {
        text: 'Select up to 1 opponent Cookie. That Cookie receives 1 damage.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [flipCard]
    state.players['player-two'].breakArea = [
      { ...cookie('break-level-nine'), level: 9 },
    ]

    state = resolveNextDamage(skipTrap(declareAttack(state), 'player-one'))

    expect(() => {
      state = resolveFlip(state, 'player-one', {
        activate: true,
        targetIds: [state.players['player-two'].battleArea[0].card.instanceId],
      })
    }).not.toThrow()

    expect(state.status).toBe('finished')
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].breakArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: 'break-level-nine' }),
        expect.objectContaining({ instanceId: 'attacker' }),
      ]),
    )
    expect(state.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ instanceId: 'defeat-attacker-flip' }),
    )
  })

  it('skips FLIP entirely when conditional FLIP effect condition is not met', () => {
    const conditionalFlip: GameCard = {
      ...cookie('conditional-flip'),
      name: 'Conditional FLIP',
      officialType: 'flip',
      flip: {
        text: '《Discard 1 card.》 If your break area is LV.6 or higher, gain +2 HP.',
        cost: { energy: {}, discardHand: 1 },
        effects: [{
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'break-level-at-least', level: 6 },
        }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [conditionalFlip]
    state.players['player-one'].breakArea = []
    state = declareAttack(state)
    state = skipTrap(state, 'player-one')
    state = resolveNextDamage(state)

    expect(state.pendingBattle?.stage).toBe('damage')
    expect(state.players['player-one'].discardPile).toContain(conditionalFlip)
    expect(state.pendingBattle?.revealedHpCard).toBeNull()
  })

  it('pays discard cost and applies effect when conditional FLIP condition is met', () => {
    const conditionalFlip: GameCard = {
      ...cookie('conditional-flip-met'),
      name: 'Conditional FLIP Met',
      officialType: 'flip',
      flip: {
        text: '《Discard 1 card.》 If your break area is LV.6 or higher, gain +2 HP.',
        cost: { energy: {}, discardHand: 1 },
        effects: [{
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'break-level-at-least', level: 6 },
        }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [conditionalFlip]
    state.players['player-one'].breakArea = [
      { ...cookie('break-1', 3, 3), level: 3 },
      { ...cookie('break-2', 3, 3), level: 3 },
    ]
    state = declareAttack(state)
    state = skipTrap(state, 'player-one')
    state = resolveNextDamage(state)

    expect(state.pendingBattle?.stage).toBe('flip')

    state = resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: ['p1-hand-a'],
    })

    expect(state.players['player-one'].hand.length).toBe(1)
    expect(state.players['player-one'].discardPile.map((c) => c.instanceId))
      .toEqual(expect.arrayContaining(['p1-hand-a', 'conditional-flip-met']))
    expect(state.players['player-one'].battleArea[0].hpCards.length).toBe(2)
    expect(state.pendingBattle?.stage).toBe('damage')
  })

  it('re-evaluates BS5-111 attack damage when a FLIP lowers the attacker to 3 HP', () => {
    const kumihoFlip: GameCard = {
      ...cookie('BS1-002'),
      name: 'Kumiho Cookie',
      officialType: 'flip',
      flip: {
        text: 'Discard 1 card. Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        cost: { energy: {}, discardHand: 1 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
      },
    }
    const equipEffect: CardEffect = {
      kind: 'equip-source',
      target: { side: 'self', min: 1, max: 1 },
      requiredKeyword: 'dragon',
      bonusMaxRemainingHp: 3,
      attackBonus: 1,
      damageReceivedReduction: 1,
    }
    let state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: {
        ...state.players['player-two'].battleArea[0].card,
        hp: 5,
        keywords: ['dragon'],
      },
      hpCards: [
        item('attacker-hp-1'),
        item('attacker-hp-2'),
        item('attacker-hp-3'),
        item('attacker-hp-4'),
      ],
    }
    state.players['player-one'].battleArea[0].hpCards = [
      item('defender-hp-bottom'),
      kumihoFlip,
    ]
    state.players['player-two'].discardPile = [item('wrath-of-the-dragons')]
    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'wrath-of-the-dragons' },
      equipEffect,
      ['attacker'],
    )

    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    expect(state.pendingBattle).toMatchObject({
      declaredDamage: 3,
      remainingDamage: 3,
    })
    state = resolveNextDamage(skipTrap(state, 'player-one'))
    expect(state.pendingBattle?.stage).toBe('flip')

    state = resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: ['p1-hand-a'],
      targetIds: ['attacker'],
    })

    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(state.pendingBattle).toMatchObject({
      declaredDamage: 4,
      remainingDamage: 3,
      stage: 'damage',
    })
  })

  it('does not apply BS5-111 received-damage reduction retroactively mid-attack', () => {
    const equipEffect: CardEffect = {
      kind: 'equip-source',
      target: { side: 'self', min: 1, max: 1 },
      requiredKeyword: 'dragon',
      bonusMaxRemainingHp: 3,
      attackBonus: 1,
      damageReceivedReduction: 1,
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      card: {
        ...state.players['player-one'].battleArea[0].card,
        hp: 5,
        keywords: ['dragon'],
      },
      hpCards: [
        item('target-hp-1'),
        item('target-hp-2'),
        item('target-hp-3'),
        item('target-hp-4'),
        item('target-hp-5'),
      ],
    }
    state.players['player-two'].battleArea[0].card = {
      ...state.players['player-two'].battleArea[0].card,
      attack: 4,
    }
    state.players['player-one'].discardPile = [item('wrath-of-the-dragons')]
    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'wrath-of-the-dragons' },
      equipEffect,
      ['defender'],
    )

    state = skipTrap(
      beginAttack(state, 'attacker', 'defender', ['p2-support']),
      'player-one',
    )
    expect(state.pendingBattle).toMatchObject({
      declaredDamage: 4,
      remainingDamage: 4,
    })
    for (let i = 0; i < 4; i += 1) {
      state = resolveNextDamage(state)
    }

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(getAttackDamageAgainst(state, 'attacker', 'defender')).toBe(3)
  })
})
