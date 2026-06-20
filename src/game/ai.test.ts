import { describe, expect, it } from 'vitest'
import { takeAiStep, simulateAiMatch } from './ai'
import { advancePhase } from './turn'
import { deployCookie } from './actions'
import type {
  CardSkill,
  CookieCard,
  EnergyColor,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
} from './types'

const testCookieCard = (
  instanceId: string,
  options: {
    level?: number
    hp?: number
    attack?: number
    skill?: CardSkill
  } = {},
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: options.level ?? 1,
  hp: options.hp ?? 1,
  attack: options.attack ?? 1,
  attackCost: 0,
  attackEnergyCost: {},
  skill: options.skill,
})

const testSupportCard = (
  instanceId: string,
  color: EnergyColor | 'wild' = 'red',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor: color,
})

const buildTestState = (
  activePlayerId: PlayerId,
  overrides: Partial<PlayerState> & { id: PlayerId } = { id: 'player-two' },
): GameState => {
  const emptyPlayer = (id: PlayerId): PlayerState => ({
    id,
    name: id === 'player-one' ? '玩家' : 'AI 對手',
    deck: [],
    hand: [],
    battleArea: [],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
    hasMulliganed: true,
    startingCookieSelected: true,
    freeMulliganDecided: true,
    forcedMulliganCount: 0,
  })

  return {
    players: {
      'player-one': activePlayerId === 'player-one'
        ? { ...emptyPlayer('player-one'), ...overrides, id: 'player-one' }
        : emptyPlayer('player-one'),
      'player-two': activePlayerId === 'player-two'
        ? { ...emptyPlayer('player-two'), ...overrides, id: 'player-two' }
        : emptyPlayer('player-two'),
    },
    firstPlayerId: activePlayerId,
    activePlayerId,
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
    pendingFaintEffects: undefined,
    pendingOpponentHandDiscard: null,
    pendingInspectDeck: null,
    pendingOptionalCostAttack: undefined,
  }
}

describe('resolveAiSkill discardHand', () => {
  it('discards first N hand cards deterministically for discardHand cost', () => {
    const handCard0: GameCard = {
      id: 'hc0', instanceId: 'hc0-inst', name: 'HandCard0', type: 'item',
    }
    const handCard1: GameCard = {
      id: 'hc1', instanceId: 'hc1-inst', name: 'HandCard1', type: 'item',
    }
    const handCard2: GameCard = {
      id: 'hc2', instanceId: 'hc2-inst', name: 'HandCard2', type: 'item',
    }
    const cookie = testCookieCard('skill-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 2 },
        text: 'Test discardHand 2',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [handCard0, handCard1, handCard2],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'skill-cookie:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')
    expect(result.description).toContain('skill-cookie')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand.map((c) => c.instanceId)).toEqual(['hc2-inst'])
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc0-inst')
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc1-inst')

    const modifiers = result.state.attackModifiers.filter(
      (m) => m.sourceInstanceId === 'skill-cookie',
    )
    expect(modifiers).toHaveLength(1)
    expect(modifiers[0].amount).toBe(1)
  })

  it('discards first 1 hand card for ST4-012-style discardHand cost', () => {
    const handCard0: GameCard = {
      id: 'hc0', instanceId: 'hc0-inst', name: 'HandCard0', type: 'item',
    }
    const handCard1: GameCard = {
      id: 'hc1', instanceId: 'hc1-inst', name: 'HandCard1', type: 'item',
    }
    const cookie = testCookieCard('werewolf', {
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'Werewolf Cookie skill',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [handCard0, handCard1],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'werewolf:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand).toHaveLength(1)
    expect(updatedPlayer.hand[0].instanceId).toBe('hc1-inst')
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc0-inst')
  })

  it('does not attempt discardHand skill when hand is insufficient', () => {
    const cookie = testCookieCard('skill-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 3 },
        text: 'Test discardHand 3',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [{ id: 'only', instanceId: 'only-inst', name: 'Only', type: 'item' }],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'skill-cookie:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).not.toBe('activate-skill')
    expect(result.action).not.toBe('error')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand).toHaveLength(1)
  })

  it('does not throw and does not get stuck when discardHand skill hand is insufficient', () => {
    const cookie = testCookieCard('skill-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 5 },
        text: 'Test discardHand 5',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [{ id: 'only', instanceId: 'only-inst', name: 'Only', type: 'item' }],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'skill-cookie:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).not.toBe('error')
  })
})

describe('resolveAiSkill discardHand with supportToTrash combined', () => {
  it('pays both discardHand and supportToTrash costs simultaneously', () => {
    const handCard0: GameCard = {
      id: 'hc0', instanceId: 'hc0-inst', name: 'HandCard0', type: 'item',
    }
    const handCard1: GameCard = {
      id: 'hc1', instanceId: 'hc1-inst', name: 'HandCard1', type: 'item',
    }
    const cookie = testCookieCard('combo-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 1, supportToTrash: 1 },
        text: 'Test combo',
        effects: [
          {
            kind: 'modify-attack',
            amount: 2,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const paymentSupport = testSupportCard('pay-sup', 'red')
    const trashSupport: GameCard = {
      id: 'trash-sup', instanceId: 'trash-sup-inst', name: 'TrashSup', type: 'item', energyColor: 'yellow',
    }

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [handCard0, handCard1],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'combo-cookie:battle:1' },
      ],
      supportArea: [
        { card: paymentSupport, rested: false },
        { card: trashSupport, rested: false },
      ],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand.map((c) => c.instanceId)).toEqual(['hc1-inst'])
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc0-inst')
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('trash-sup-inst')
    expect(updatedPlayer.supportArea).toHaveLength(1)
    expect(updatedPlayer.supportArea[0].card.instanceId).toBe('pay-sup')
    expect(updatedPlayer.supportArea[0].rested).toBe(true)
  })
})

describe('simulateAiMatch with discardHand skill', () => {
  it('completes a match without getting stuck on discardHand skills', () => {
    const handCards: GameCard[] = Array.from({ length: 5 }, (_, i) => ({
      id: `hc${i}`, instanceId: `hc${i}-inst`, name: `HandCard${i}`, type: 'item',
    }))
    const cookie = testCookieCard('ai-cookie', {
      hp: 2,
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'AI discardHand skill',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const opponentCookie = testCookieCard('opp-cookie', { hp: 1 })

    const state: GameState = buildTestState('player-two', {
      id: 'player-two',
      hand: [cookie, ...handCards],
      battleArea: [],
      supportArea: [],
      deck: [],
    })
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]
    state.players['player-one'].hand = [{ id: 'p1h', instanceId: 'p1h-inst', name: 'P1Hand', type: 'item' }]

    let deployed = deployCookie(state, cookie.instanceId)
    while (deployed.phase !== 'main') {
      deployed = advancePhase(deployed)
    }

    const result = simulateAiMatch(deployed, 50)
    expect(result.stuck).toBe(false)
    expect(result.error).toBeNull()
  })
})
