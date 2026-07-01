import { describe, expect, it } from 'vitest'
import {
  activateStage,
  createDemoGame,
  executeCardEffect,
  getTrapCandidates,
  playItem,
  playTrap,
  type CardEffect,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'
import { GameRuleError } from './errors'

const makeItem = (id: string, effects: CardEffect[]): GameCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'item',
  item: {
    cost: { energy: {}, discardHand: 0 },
    text: id,
    effects,
  },
})

const asMainPhase = (state: GameState): GameState => ({
  ...state,
  phase: 'main',
  activePlayerId: 'player-one',
})

describe('BS1 non-cookie effect execution', () => {
  it('pays support-to-hand item costs and marks support area as decreased', () => {
    const base = asMainPhase(createDemoGame())
    const supportCard = base.players['player-one'].deck[0]
    const item = makeItem('bs1-074', [{ kind: 'draw', amount: 1 }])
    item.item!.cost = { energy: {}, discardHand: 0, supportToHand: 1 }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [item],
          supportArea: [{ card: supportCard, rested: false }],
        },
      },
    }

    const paid = playItem(
      state,
      'player-one',
      item.instanceId,
      [],
      [],
      [supportCard.instanceId],
    )

    expect(paid.players['player-one'].supportArea).toHaveLength(0)
    expect(paid.players['player-one'].hand).toContainEqual(supportCard)
    expect(paid.supportAreaDecreasedThisTurn?.['player-one']).toBe(true)
  })

  it('places the source item into support as rested', () => {
    const base = asMainPhase(createDemoGame())
    const item = makeItem('bs1-075', [
      { kind: 'place-source-to-support', rested: true },
    ])
    const paid = playItem(
      {
        ...base,
        players: {
          ...base.players,
          'player-one': {
            ...base.players['player-one'],
            hand: [item],
          },
        },
      },
      'player-one',
      item.instanceId,
      [],
    )

    const resolved = executeCardEffect(
      paid,
      { sourcePlayerId: 'player-one', sourceInstanceId: item.instanceId },
      item.item!.effects[0],
      [],
    )

    expect(resolved.players['player-one'].discardPile).not.toContainEqual(item)
    expect(resolved.players['player-one'].supportArea).toContainEqual({
      card: item,
      rested: true,
    })
  })

  it('requires support area decrease before BS1-078 stage activation resolves', () => {
    const base = asMainPhase(createDemoGame())
    const supportCard = base.players['player-one'].deck[0]
    const stage: GameCard = {
      id: 'BS1-078',
      instanceId: 'bs1-078',
      name: 'Awakening Ancient Forest',
      type: 'stage',
      stageAbility: {
        placementCost: {},
        cost: { energy: {}, discardHand: 0 },
        text: 'BS1-078',
        restSource: true,
        effects: [
          {
            kind: 'set-active',
            supportCount: 1,
            condition: { kind: 'support-area-decreased-this-turn' },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          stage: { card: stage, rested: false },
          supportArea: [{ card: supportCard, rested: true }],
        },
      },
    }

    expect(() => activateStage(state, 'player-one', [])).toThrow(GameRuleError)

    const activated = activateStage(
      {
        ...state,
        supportAreaDecreasedThisTurn: { 'player-one': true },
      },
      'player-one',
      [],
    )
    const resolved = executeCardEffect(
      activated,
      { sourcePlayerId: 'player-one', sourceInstanceId: stage.instanceId },
      stage.stageAbility!.effects[0],
      [],
    )

    expect(resolved.players['player-one'].supportArea[0].rested).toBe(false)
  })

  it('redirects an attack trap to another friendly cookie', () => {
    const base = createDemoGame()
    const defenderCookie = base.players['player-two'].battleArea[0]
    const redirectTarget: CookieCard = {
      ...defenderCookie.card,
      instanceId: 'redirect-target',
    }
    const trap: GameCard = {
      id: 'BS1-050',
      instanceId: 'bs1-050',
      name: 'Broken Signpost',
      type: 'trap',
      trap: {
        text: 'Redirect',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'redirect-attack',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId:
          base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [trap],
          battleArea: [
            defenderCookie,
            {
              card: redirectTarget,
              hpCards: base.players['player-two'].deck.slice(0, 2),
              rested: false,
              battleEntryId: 'redirect-target:battle',
            },
          ],
        },
      },
    }

    const redirected = playTrap(state, 'player-two', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: [redirectTarget.instanceId],
    })

    expect(redirected.pendingBattle?.targetInstanceId).toBe(
      redirectTarget.instanceId,
    )
    expect(redirected.pendingBattle?.stage).toBe('damage')
  })

  it('BS2-006 hp-to-trash removes HP cards without FLIP trigger', () => {
    const base = asMainPhase(createDemoGame())
    const selfCookie: CookieCard = {
      id: 'self-cookie',
      instanceId: 'self-cookie',
      name: 'Self Cookie',
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 1,
      attackCost: 0,
    }
    const hpCards: GameCard[] = [
      {
        id: 'hp-1',
        instanceId: 'hp-1',
        name: 'HP Card 1',
        type: 'cookie',
        level: 1,
        hp: 1,
        attack: 0,
        attackCost: 0,
      },
      {
        id: 'hp-2',
        instanceId: 'hp-2',
        name: 'HP Card 2',
        type: 'cookie',
        level: 1,
        hp: 1,
        attack: 0,
        attackCost: 0,
      },
      {
        id: 'hp-3',
        instanceId: 'hp-3',
        name: 'HP Card 3',
        type: 'cookie',
        level: 1,
        hp: 1,
        attack: 0,
        attackCost: 0,
      },
    ]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              card: selfCookie,
              hpCards,
              rested: false,
            },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'item-id' },
      {
        kind: 'hp-to-trash',
        amount: 2,
        target: { side: 'self', min: 1, max: 1 },
      },
      ['self-cookie'],
    )

    const cookie = resolved.players['player-one'].battleArea[0]
    expect(cookie.hpCards).toHaveLength(1)
    expect(cookie.hpCards[0].instanceId).toBe('hp-1')
    expect(resolved.players['player-one'].discardPile).toHaveLength(2)
  })

  it('BS2-006 hp-to-trash at 0 HP sends cookie to break area', () => {
    const base = asMainPhase(createDemoGame())
    const selfCookie: CookieCard = {
      id: 'self-cookie',
      instanceId: 'self-cookie',
      name: 'Self Cookie',
      type: 'cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 0,
    }
    const hpCards: GameCard[] = [
      {
        id: 'hp-1',
        instanceId: 'hp-1',
        name: 'HP Card 1',
        type: 'cookie',
        level: 1,
        hp: 1,
        attack: 0,
        attackCost: 0,
      },
      {
        id: 'hp-2',
        instanceId: 'hp-2',
        name: 'HP Card 2',
        type: 'cookie',
        level: 1,
        hp: 1,
        attack: 0,
        attackCost: 0,
      },
    ]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              card: selfCookie,
              hpCards,
              rested: false,
            },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'item-id' },
      {
        kind: 'hp-to-trash',
        amount: 2,
        target: { side: 'self', min: 1, max: 1 },
      },
      ['self-cookie'],
    )

    expect(resolved.players['player-one'].battleArea).toHaveLength(0)
    expect(resolved.players['player-one'].breakArea).toHaveLength(1)
    expect(resolved.players['player-one'].breakArea[0].instanceId).toBe(
      'self-cookie',
    )
    expect(resolved.players['player-one'].discardPile).toHaveLength(2)
  })

  it('BS2-007 trap with discardHandColor rejects non-red hand card', () => {
    const base = createDemoGame()
    const lv1Cookie: CookieCard = {
      ...base.players['player-two'].battleArea[0].card,
      level: 1,
    }
    const defenderCookie = {
      ...base.players['player-two'].battleArea[0],
      card: lv1Cookie,
    }
    const trap: GameCard = {
      id: 'BS2-007',
      instanceId: 'bs2-007',
      name: 'Prickly Cactus Bat',
      type: 'trap',
      trap: {
        text: 'BS2-007',
        cost: { energy: { red: 1 }, discardHand: 1, discardHandColor: 'red' },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          },
        ],
      },
    }
    const blueCard: GameCard = {
      id: 'blue-card',
      instanceId: 'blue-card',
      name: 'Blue Card',
      type: 'item',
      energyColor: 'blue',
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId:
          base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [trap, blueCard],
          battleArea: [defenderCookie],
        },
      },
    }

    expect(() =>
      playTrap(state, 'player-two', {
        trapInstanceId: trap.instanceId,
        paymentIds: [],
        targetIds: [defenderCookie.card.instanceId],
        discardHandIds: [blueCard.instanceId],
      }),
    ).toThrow(GameRuleError)
  })

  it('BS2-007 trap with discardHandColor accepts red hand card', () => {
    const base = createDemoGame()
    const lv1Cookie: CookieCard = {
      ...base.players['player-two'].battleArea[0].card,
      level: 1,
    }
    const defenderCookie = {
      ...base.players['player-two'].battleArea[0],
      card: lv1Cookie,
    }
    const targetCookie: CookieCard = {
      id: 'target-cookie',
      instanceId: 'target-cookie',
      name: 'Target Cookie',
      type: 'cookie',
      level: 1,
      hp: 3,
      attack: 1,
      attackCost: 0,
    }
    const trap: GameCard = {
      id: 'BS2-007',
      instanceId: 'bs2-007',
      name: 'Prickly Cactus Bat',
      type: 'trap',
      trap: {
        text: 'BS2-007',
        cost: { energy: { red: 1 }, discardHand: 1, discardHandColor: 'red' },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          },
        ],
      },
    }
    const redCard: GameCard = {
      id: 'red-card',
      instanceId: 'red-card',
      name: 'Red Card',
      type: 'item',
      energyColor: 'red',
    }
    const redSupport: GameCard = {
      id: 'red-support',
      instanceId: 'red-support',
      name: 'Red Support',
      type: 'item',
      energyColor: 'red',
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId:
          base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              card: targetCookie,
              hpCards: base.players['player-one'].deck.slice(0, 3),
              rested: false,
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [trap, redCard],
          supportArea: [{ card: redSupport, rested: false }],
          battleArea: [defenderCookie],
        },
      },
    }

    const result = playTrap(state, 'player-two', {
      trapInstanceId: trap.instanceId,
      paymentIds: [redSupport.instanceId],
      targetIds: [targetCookie.instanceId],
      discardHandIds: [redCard.instanceId],
    })

    expect(result.pendingBattle?.trapUsed).toBe(true)
    expect(result.pendingBattle?.stage).toBe('damage')
    expect(result.pendingBattle?.remainingDamage).toBe(2)
  })

  it('BS2-007 getTrapCandidates filters by discardHandColor', () => {
    const base = createDemoGame()
    const lv1Cookie: CookieCard = {
      ...base.players['player-two'].battleArea[0].card,
      level: 1,
    }
    const defenderCookie = {
      ...base.players['player-two'].battleArea[0],
      card: lv1Cookie,
    }
    const trap: GameCard = {
      id: 'BS2-007',
      instanceId: 'bs2-007',
      name: 'Prickly Cactus Bat',
      type: 'trap',
      trap: {
        text: 'BS2-007',
        cost: { energy: { red: 1 }, discardHand: 1, discardHandColor: 'red' },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          },
        ],
      },
    }
    const blueCard: GameCard = {
      id: 'blue-card',
      instanceId: 'blue-card',
      name: 'Blue Card',
      type: 'item',
      energyColor: 'blue',
    }
    const redSupport: GameCard = {
      id: 'red-support',
      instanceId: 'red-support',
      name: 'Red Support',
      type: 'item',
      energyColor: 'red',
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId:
          base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [trap, blueCard],
          supportArea: [{ card: redSupport, rested: false }],
          battleArea: [defenderCookie],
        },
      },
    }

    const candidates = getTrapCandidates(state, 'player-two')
    expect(candidates).toHaveLength(0)
  })
})
