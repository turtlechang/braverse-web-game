import { describe, expect, it } from 'vitest'
import {
  resolveAttackEffect,
  resolveOptionalCostAttack,
  resolveBattleAutomatically,
  skipTrap,
  resolveNextDamage,
  beginAttack,
} from './battle'
import { applyGameCommand } from './commands'
import { deployCookie } from './actions'
import type { CookieCard, GameState } from './types'
import { createBattleState, declareAttack } from './test-helpers/battle-helpers'
import type { GameCard } from './types'
import officialBs6Formal from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import officialBs4Formal from '../../data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json'
import {
  convertOfficialCardToGameCard,
  type OfficialCardRecord,
} from '../cards'
import {
  createOfficialBlueStarterDeck,
} from './starter-deck'

const officialBs6Cards = officialBs6Formal.cards as OfficialCardRecord[]
const officialBs4Cards = officialBs4Formal.cards as OfficialCardRecord[]

const cookie = (id: string, level: number, hp: number): CookieCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'cookie',
  level,
  hp,
  attack: 0,
  attackCost: 0,
})

const item = (id: string, energyColor: 'blue' | 'green' | 'red' | 'purple'): GameCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'item',
  energyColor,
})

const handCookie = (id: string): GameCard => ({
  id,
  instanceId: `${id}-instance`,
  name: id,
  type: 'cookie',
  level: 1,
  hp: 1,
  attack: 0,
  attackCost: 0,
})

const advanceToAttackEffect = (state: GameState): GameState => {
  let s = skipTrap(state, 'player-one')
  while (s.pendingBattle?.stage === 'damage') {
    s = resolveNextDamage(s)
  }
  return s
}

const createBs6SupportReturnAttackState = (cardId: 'BS6-044' | 'BS6-061'): GameState => {
  const sourceCard = officialBs6Cards.find((candidate) => candidate.cardNumber === cardId)
  const conversion = sourceCard ? convertOfficialCardToGameCard(sourceCard, 'attack-test') : null
  if (!conversion || conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') {
    throw new Error(`${cardId} should be a runtime Cookie card.`)
  }
  const card = conversion.gameCard
  const state = createBattleState()
  const defender = state.players['player-one'].battleArea[0]
  state.players['player-one'].battleArea = [
    {
      ...defender,
      card: { ...defender.card, hp: 10 },
      hpCards: Array.from({ length: 10 }, (_, index) =>
        item(`${cardId}-defender-hp-${index + 1}`, 'red'),
      ),
    },
  ]
  const supportCookie = cookie(`${cardId}-support-cookie`, 0, 1)
  supportCookie.energyColor = 'green'
  state.players['player-two'].battleArea = [
    { ...state.players['player-two'].battleArea[0], card, hpCards: [] },
  ]
  state.players['player-two'].supportArea = [
    { card: supportCookie, rested: false },
    { card: item(`${cardId}-attack-energy-1`, 'green'), rested: false },
    { card: item(`${cardId}-attack-energy-2`, 'green'), rested: false },
  ]
  state.players['player-two'].hand = []
  return beginAttack(
    state,
    card.instanceId,
    'defender',
    [`${cardId}-attack-energy-1`, `${cardId}-attack-energy-2`],
  )
}

const createBs4StardustAttackState = (): GameState => {
  const sourceCard = officialBs4Cards.find((candidate) => candidate.cardNumber === 'BS4-098')
  const conversion = sourceCard ? convertOfficialCardToGameCard(sourceCard, 'attack-test') : null
  if (!conversion || conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') {
    throw new Error('BS4-098 should be a runtime Cookie card.')
  }

  const card = conversion.gameCard
  const state = createBattleState()
  const defender = state.players['player-one'].battleArea[0]
  state.players['player-one'].battleArea = [
    {
      ...defender,
      card: { ...defender.card, hp: 10 },
      hpCards: Array.from({ length: 10 }, (_, index) =>
        item(`BS4-098-defender-hp-${index + 1}`, 'red'),
      ),
    },
  ]
  state.players['player-two'].battleArea = [
    { ...state.players['player-two'].battleArea[0], card, hpCards: [] },
  ]
  state.players['player-two'].supportArea = Array.from({ length: 4 }, (_, index) => ({
    card: item(`BS4-098-energy-${index + 1}`, 'purple'),
    rested: false,
  }))
  state.players['player-two'].discardPile = Array.from({ length: 15 }, (_, index) =>
    item(`BS4-098-purple-trash-${index + 1}`, 'purple'),
  )
  return beginAttack(
    state,
    card.instanceId,
    'defender',
    ['BS4-098-energy-1', 'BS4-098-energy-2', 'BS4-098-energy-3'],
  )
}

const createBs4BlackPearlAttackState = (): GameState => {
  const sourceCard = officialBs4Cards.find((candidate) => candidate.cardNumber === 'BS4-075')
  const conversion = sourceCard ? convertOfficialCardToGameCard(sourceCard, 'attack-test') : null
  if (!conversion || conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') {
    throw new Error('BS4-075 should be a runtime Cookie card.')
  }

  const card = conversion.gameCard
  const state = createBattleState()
  const defender = state.players['player-one'].battleArea[0]
  state.players['player-one'].battleArea = [
    {
      ...defender,
      card: { ...defender.card, hp: 10 },
      hpCards: Array.from({ length: 10 }, (_, index) =>
        item(`BS4-075-defender-hp-${index + 1}`, 'red'),
      ),
    },
  ]
  state.players['player-two'].battleArea = [
    { ...state.players['player-two'].battleArea[0], card, hpCards: [] },
  ]
  state.players['player-two'].supportArea = Array.from({ length: 3 }, (_, index) => ({
    card: item(`BS4-075-energy-${index + 1}`, 'blue'),
    rested: false,
  }))
  state.players['player-two'].hand = [
    handCookie('BS4-075-cost-1'),
    handCookie('BS4-075-cost-2'),
  ]
  return beginAttack(
    state,
    card.instanceId,
    'defender',
    ['BS4-075-energy-1', 'BS4-075-energy-2', 'BS4-075-energy-3'],
  )
}

describe('optional-cost-attack', () => {
  it.each(['BS6-044', 'BS6-061'] as const)(
    '%s creates a skippable support-return cost and skip resolves the attack',
    (cardId) => {
      let state = advanceToAttackEffect(createBs6SupportReturnAttackState(cardId))
      state = resolveAttackEffect(state, 'player-two', [])

      expect(state.pendingOptionalCostAttack).toMatchObject({
        cost: { supportToHand: 1, supportToHandType: 'cookie' },
      })

      state = resolveOptionalCostAttack(state, 'player-two', 'skip')

      expect(state.pendingOptionalCostAttack).toBeNull()
      expect(state.pendingBattle).toBeNull()
      expect(
        state.players['player-two'].supportArea.some(
          (support) => support.card.instanceId === `${cardId}-support-cookie`,
        ),
      ).toBe(true)
    },
  )

  it('BS6-044 returns a selected Cookie to hand before resolving its damage', () => {
    let state = advanceToAttackEffect(createBs6SupportReturnAttackState('BS6-044'))
    state = resolveAttackEffect(state, 'player-two', [])
    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      ['defender'],
      [],
      ['BS6-044-support-cookie'],
    )

    expect(state.players['player-two'].hand.map((card) => card.instanceId)).toContain(
      'BS6-044-support-cookie',
    )
    expect(state.players['player-one'].battleArea[0].hpCards.length).toBeLessThan(10)
    expect(state.pendingBattle).toBeNull()
  })

  it('BS4-098 locks its follow-up damage to the original attack target', () => {
    let state = createBs4StardustAttackState()
    state.players['player-one'].battleArea.push({
      card: cookie('BS4-098-bystander', 1, 5),
      hpCards: Array.from({ length: 5 }, (_, index) =>
        item(`BS4-098-bystander-hp-${index + 1}`, 'red'),
      ),
      rested: false,
      battleEntryId: 'BS4-098-bystander:battle:2',
    })
    state = advanceToAttackEffect(state)
    state = resolveAttackEffect(state, 'player-two', [])

    expect(() =>
      resolveOptionalCostAttack(
        state,
        'player-two',
        'pay',
        [],
        ['BS4-098-bystander'],
        ['BS4-098-energy-4'],
      ),
    ).toThrow()

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      ['defender'],
      ['BS4-098-energy-4'],
    )

    expect(state.players['player-one'].battleArea[0].hpCards.length).toBeLessThan(8)
    expect(
      state.players['player-one'].battleArea.find(
        (cookieInBattle) => cookieInBattle.card.instanceId === 'BS4-098-bystander',
      )?.hpCards.length,
    ).toBe(5)
  })

  it('BS4-098 skips the follow-up when the original attack target faints', () => {
    let state = createBs4StardustAttackState()
    state.players['player-one'].battleArea[0].hpCards = [
      item('BS4-098-defender-last-hp', 'red'),
    ]
    state.players['player-one'].battleArea.push({
      card: cookie('BS4-098-bystander', 1, 5),
      hpCards: Array.from({ length: 5 }, (_, index) =>
        item(`BS4-098-bystander-hp-${index + 1}`, 'red'),
      ),
      rested: false,
      battleEntryId: 'BS4-098-bystander:battle:2',
    })
    state = advanceToAttackEffect(state)

    expect(
      state.players['player-one'].battleArea.some(
        (cookieInBattle) => cookieInBattle.card.instanceId === 'defender',
      ),
    ).toBe(false)

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
    expect(
      state.players['player-one'].battleArea.some(
        (cookieInBattle) => cookieInBattle.card.instanceId === 'BS4-098-bystander',
      ),
    ).toBe(true)
  })

  it('BS6-044 locks its follow-up damage to the original attack target', () => {
    let state = createBs6SupportReturnAttackState('BS6-044')
    state.players['player-one'].battleArea.push({
      card: cookie('BS6-044-bystander', 1, 5),
      hpCards: Array.from({ length: 5 }, (_, index) =>
        item(`BS6-044-bystander-hp-${index + 1}`, 'red'),
      ),
      rested: false,
      battleEntryId: 'BS6-044-bystander:battle:2',
    })
    state = advanceToAttackEffect(state)
    state = resolveAttackEffect(state, 'player-two', [])

    expect(() =>
      resolveOptionalCostAttack(
        state,
        'player-two',
        'pay',
        [],
        ['BS6-044-bystander'],
        [],
        ['BS6-044-support-cookie'],
      ),
    ).toThrow()

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      ['defender'],
      [],
      ['BS6-044-support-cookie'],
    )

    expect(state.players['player-one'].battleArea[0].card.instanceId).toBe('defender')
    expect(state.players['player-one'].battleArea[0].hpCards.length).toBeLessThan(10)
    expect(
      state.players['player-one'].battleArea.find(
        (cookieInBattle) => cookieInBattle.card.instanceId === 'BS6-044-bystander',
      )?.hpCards.length,
    ).toBe(5)
  })

  it('BS6-044 skips the follow-up when the original attack target faints', () => {
    let state = createBs6SupportReturnAttackState('BS6-044')
    state.players['player-one'].battleArea[0].hpCards = [
      item('BS6-044-defender-last-hp', 'red'),
    ]
    state.players['player-one'].battleArea.push({
      card: cookie('BS6-044-bystander', 1, 5),
      hpCards: Array.from({ length: 5 }, (_, index) =>
        item(`BS6-044-bystander-hp-${index + 1}`, 'red'),
      ),
      rested: false,
      battleEntryId: 'BS6-044-bystander:battle:2',
    })
    state = advanceToAttackEffect(state)

    expect(
      state.players['player-one'].battleArea.some(
        (cookieInBattle) => cookieInBattle.card.instanceId === 'defender',
      ),
    ).toBe(false)

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
    expect(
      state.players['player-one'].battleArea.some(
        (cookieInBattle) => cookieInBattle.card.instanceId === 'BS6-044-bystander',
      ),
    ).toBe(true)
  })

  it('BS6-061 support-return cost marks the support area as decreased this turn', () => {
    let state = advanceToAttackEffect(createBs6SupportReturnAttackState('BS6-061'))
    state = resolveAttackEffect(state, 'player-two', [])
    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      [],
      [],
      ['BS6-061-support-cookie'],
    )

    expect(state.supportAreaDecreasedThisTurn?.['player-two']).toBe(true)
  })

  it('reaches the pending decision through a real ST4-013 attack', () => {
    let state = createBattleState()
    const caviar = createOfficialBlueStarterDeck('player-two').find(
      (card) => card.id === 'ST4-013',
    )
    if (!caviar || caviar.type !== 'cookie') {
      throw new Error('ST4-013 should be a runtime cookie card.')
    }
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: caviar,
    }
    state.players['player-two'].supportArea[0].card.energyColor = 'blue'
    const costCardOne = handCookie('hc1')
    const costCardTwo = handCookie('hc2')
    const deployableCookie = handCookie('deployable-cookie')
    state.players['player-two'].hand = [
      costCardOne,
      costCardTwo,
      deployableCookie,
    ]

    state = beginAttack(
      state,
      caviar.instanceId,
      'defender',
      ['p2-support'],
    )
    state = advanceToAttackEffect(state)
    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toMatchObject({
      playerId: 'player-two',
      sourceInstanceId: caviar.instanceId,
      cost: { discardHand: 2 },
    })

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [costCardOne.instanceId, costCardTwo.instanceId],
      ['defender'],
    )
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeNull()

    state = deployCookie(state, deployableCookie.instanceId)
    expect(
      state.players['player-two'].battleArea.map(
        (cookie) => cookie.card.instanceId,
      ),
    ).toContain(deployableCookie.instanceId)
  })

  it('BS4-075 exposes the discard-2 attack cost as a skippable pending choice', () => {
    let state = advanceToAttackEffect(createBs4BlackPearlAttackState())
    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toMatchObject({
      sourceCardName: 'Black Pearl Cookie',
      cost: { discardHand: 2 },
      effects: [
        {
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    })

    state = resolveOptionalCostAttack(state, 'player-two', 'skip')

    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].hand.map((card) => card.instanceId)).toEqual([
      'BS4-075-cost-1-instance',
      'BS4-075-cost-2-instance',
    ])
    expect(state.players['player-two'].discardPile).toHaveLength(0)
  })

  it('BS4-075 pays the selected discard-2 cards before resolving its damage target', () => {
    let state = advanceToAttackEffect(createBs4BlackPearlAttackState())
    state = resolveAttackEffect(state, 'player-two', [])
    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      ['BS4-075-cost-1-instance', 'BS4-075-cost-2-instance'],
      ['defender'],
    )

    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].hand).toHaveLength(0)
    expect(state.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual([
      'BS4-075-cost-1-instance',
      'BS4-075-cost-2-instance',
    ])
    // Base attack deals 2, then BS4-075's paid follow-up deals 2 more.
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(6)
  })

  it('resolves source-only battle-to-break before a chained break-to-battle target', () => {
    let state = createBattleState()
    const revivedCookie: CookieCard = {
      id: 'revived-yellow-lv3',
      instanceId: 'revived-yellow-lv3-instance',
      name: 'revived-yellow-lv3',
      type: 'cookie',
      level: 3,
      hp: 3,
      attack: 0,
      attackCost: 0,
      energyColor: 'yellow' as const,
    }
    const attacker = state.players['player-two'].battleArea[0].card
    state.players['player-two'].breakArea = [revivedCookie]
    state.pendingBattle = {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: 'defender',
      declaredDamage: 0,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    }
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: attacker.instanceId,
      sourceCardName: attacker.name,
      cost: { energy: { red: 1 } },
      effects: [
        {
          kind: 'battle-to-break',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
        {
          kind: 'break-to-battle',
          amount: 1,
          exactLevel: 3,
          energyColor: 'yellow',
        },
      ],
      effectText: 'Test chained source-only effect.',
    }

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      [revivedCookie.instanceId],
      ['p2-support'],
    )

    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].battleArea.map((entry) => entry.card.id)).toEqual([
      revivedCookie.id,
    ])
    expect(state.players['player-two'].breakArea.map((card) => card.id)).toContain(
      attacker.id,
    )
    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
  })

  it('trashes the optional attack source before selecting it from trash to battle', () => {
    let state = createBattleState()
    const attacker = {
      ...state.players['player-two'].battleArea[0].card,
      energyColor: 'purple' as const,
      level: 1,
    }
    const levelThreeAlly: CookieCard = {
      ...attacker,
      id: 'purple-level-three-ally',
      instanceId: 'purple-level-three-ally',
      level: 3,
    }
    state.players['player-two'].battleArea = [
      {
        ...state.players['player-two'].battleArea[0],
        card: attacker,
      },
      {
        card: levelThreeAlly,
        hpCards: [handCookie('level-three-ally-hp')],
        rested: false,
        battleEntryId: 'purple-level-three-ally:battle:3',
      },
    ]
    state.players['player-two'].supportArea[0].card.energyColor = 'purple'
    state.pendingBattle = {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: 'defender',
      declaredDamage: 0,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    }
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: attacker.instanceId,
      sourceCardName: attacker.name,
      cost: { energy: { purple: 1 }, selfToTrash: true },
      effects: [
        {
          kind: 'trash-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'purple',
          condition: {
            kind: 'battle-area-has-cookie-with-level',
            side: 'self',
            level: 3,
          },
        },
      ],
      effectText: 'Trash this Cookie, then play it from the trash.',
    }

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      [attacker.instanceId],
      ['p2-support'],
    )

    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
    expect(
      state.players['player-two'].battleArea.map((entry) => entry.card.instanceId),
    ).toEqual([levelThreeAlly.instanceId, attacker.instanceId])
    expect(
      state.players['player-two'].discardPile.map((card) => card.instanceId),
    ).toContain('attacker-hp')
    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
  })

  it('skips optional attack effects with no applicable child effect', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    ]
    state = declareAttack(state)
    state = advanceToAttackEffect(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('creates pendingOptionalCostAttack when hand has enough cards', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 1
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    ]
    state = declareAttack(state)
    state = advanceToAttackEffect(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
  })

  it('skip action clears pending and finishes battle', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [handCookie('hc1'), handCookie('hc2')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    state = resolveOptionalCostAttack(state, 'player-two', 'skip')
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.pendingBattle).toBeNull()
  })

  it('pay action discards hand and deals damage', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [defenderId])
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.players['player-two'].hand).toHaveLength(0)
    expect(state.players['player-two'].discardPile.map((c) => c.instanceId)).toEqual(
      expect.arrayContaining([hc1.instanceId, hc2.instanceId]),
    )
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.pendingBattle).toBeNull()
  })

  it('rejects pay with wrong discard count', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [handCookie('hc1'), handCookie('hc2')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [handCookie('hc1').instanceId], []),
    ).toThrow('Must discard exactly 2 cards for this effect.')
  })

  it('rejects pay with duplicate discardCardIds', () => {
    let state = createBattleState()
    const hc = handCookie('hc1')
    state.players['player-two'].hand = [hc, handCookie('hc2')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc.instanceId, hc.instanceId], []),
    ).toThrow('Must discard exactly 2 cards for this effect.')
  })

  it('rejects pay when discardCardIds contain cards not in own hand', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [handCookie('hc1'), handCookie('hc2')]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', ['hc1-instance', 'not-in-hand'], []),
    ).toThrow('Invalid battle action.')
  })

  it('rejects pay with empty targetIds when effects require targeting', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], []),
    ).toThrow('Invalid battle action.')
  })

  it('rejects pay with multiple targetIds when effects require exactly one', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [defenderId, 'extra-id']),
    ).toThrow('Invalid battle action.')
  })

  it('rejects pay when target is not in opponent battleArea', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], ['attacker']),
    ).toThrow('Invalid battle action.')
  })

  it('rejects pay with duplicate targetIds', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [defenderId, defenderId]),
    ).toThrow('Invalid battle action.')
  })

  it('state is unchanged after failed pay validation', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    const frozen = JSON.parse(JSON.stringify(state)) as GameState
    try {
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], ['not-in-battle'])
    } catch { /* expected */ }
    expect(state).toEqual(frozen)
  })

  it('skip is available even with insufficient hand', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    const result = resolveOptionalCostAttack(state, 'player-two', 'skip')
    expect(result.pendingOptionalCostAttack).toBeNull()
    expect(result.pendingBattle).toBeNull()
  })

  it('BS6-079 can skip its bracketed discard cost or pay it before resting opponent support', () => {
    const buildState = (): GameState => {
      const state = createBattleState()
      const discardCard = handCookie('bs6-079-discard')
      state.players['player-two'].hand = [discardCard]
      state.players['player-one'].supportArea = [
        { card: { ...state.players['player-one'].supportArea[0].card, instanceId: 'bs6-079-support-1' }, rested: false },
        { card: { ...state.players['player-one'].supportArea[1].card, instanceId: 'bs6-079-support-2' }, rested: false },
      ]
      const effect = {
        kind: 'optional-cost-attack' as const,
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'rest-support' as const,
            side: 'opponent' as const,
            amount: 3,
            activeOnly: true,
            optional: true,
          },
        ],
        effectText:
          "Discard 1 card. Select up to 3 cards in your opponent's support area. Rest those cards.",
      }
      state.pendingBattle = {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [effect],
        attackEffectIndex: 0,
      }
      state.pendingOptionalCostAttack = {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Croissant Cookie',
        cost: effect.cost,
        effects: effect.effects,
        effectText: effect.effectText,
      }
      return state
    }

    const skipped = resolveOptionalCostAttack(buildState(), 'player-two', 'skip')
    expect(skipped.players['player-two'].hand).toHaveLength(1)
    expect(skipped.players['player-two'].discardPile).toHaveLength(0)
    expect(skipped.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
    expect(skipped.pendingOptionalCostAttack).toBeNull()
    expect(skipped.pendingBattle).toBeNull()

    const paid = resolveOptionalCostAttack(
      buildState(),
      'player-two',
      'pay',
      ['bs6-079-discard-instance'],
      ['bs6-079-support-1'],
    )
    expect(paid.players['player-two'].hand).toHaveLength(0)
    expect(paid.players['player-two'].discardPile.map((card) => card.instanceId)).toContain(
      'bs6-079-discard-instance',
    )
    expect(paid.players['player-one'].supportArea).toMatchObject([
      { card: { instanceId: 'bs6-079-support-1' }, rested: true },
      { card: { instanceId: 'bs6-079-support-2' }, rested: false },
    ])
    expect(paid.pendingOptionalCostAttack).toBeNull()
    expect(paid.pendingBattle).toBeNull()
  })
})

describe('optional-cost-attack integration', () => {
  it('full battle flow with sufficient hand creates pending', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 1
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'Pay 2 hand to deal 1 damage.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    expect(state.pendingBattle!.stage).toBe('trap')
    state = skipTrap(state, 'player-one')
    expect(state.pendingBattle!.stage).toBe('damage')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
    expect(state.pendingOptionalCostAttack!.effectText).toBe('Pay 2 hand to deal 1 damage.')
    expect(state.pendingBattle).toBeDefined()
  })

  it('full battle flow with insufficient hand skips without pending', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'Pay 2 hand.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = skipTrap(state, 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('resolveBattleAutomatically auto-skips optional-cost-attack without looping', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'Pay 2 hand.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('skips optional attack effects when opponent has no battle area cookies', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    // Remove all opponent battle area cookies
    state.players['player-one'].battleArea = []
    const attackerInst = state.players['player-two'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attackerInst,
        targetInstanceId: 'no-target',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'optional-cost-attack',
            cost: { energy: {}, discardHand: 2 },
            effects: [
              { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
            ],
            effectText: 'Pay 2 hand to deal 1 damage.',
          },
        ],
        attackEffectIndex: 0,
      },
    }
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('skips BS1-037-style optional effect when only higher-level cookies remain', () => {
    let state = createBattleState()
    state.players['player-one'].battleArea[0].card.level = 2
    state.players['player-two'].hand = [handCookie('hc1')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'optional-cost-attack' as const,
            cost: { energy: {}, discardHand: 0 },
            effects: [
              {
                kind: 'opponent-battle-to-trash' as const,
                maxLevel: 1,
                destination: 'break' as const,
              },
            ],
            effectText: 'Select up to 1 opposing LV.1 Cookie.',
          },
        ],
        attackEffectIndex: 0,
      },
    }

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('allows an up-to-one opponent-battle target effect to resolve with no target', () => {
    let state = createBattleState()
    state.players['player-one'].battleArea[0].card.level = 2
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'optional-cost-attack' as const,
            cost: { energy: {}, discardHand: 0 },
            effects: [
              {
                kind: 'opponent-battle-to-trash' as const,
                min: 0,
                maxLevel: 1,
                destination: 'break' as const,
              },
            ],
            effectText: 'Select up to 1 opposing LV.1 Cookie.',
          },
        ],
        attackEffectIndex: 0,
      },
    }

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()

    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [], [])

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-one'].breakArea).toHaveLength(0)
  })

  it('resolveBattleAutomatically completes battle with optional-cost-attack and damage effect', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'Pay 2 hand to deal 1 damage.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('resolveBattleAutomatically uses source energy before support payments', () => {
    let state = createBattleState()
    state.players['player-two'].supportArea.forEach((support) => {
      support.rested = true
    })
    state.players['player-two'].battleArea[0].card.attackEnergyCost = {}
    state.players['player-two'].battleArea[0].card.attackCost = 0
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          { kind: 'damage', amount: 3, target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 } },
        ],
        effectText: 'Pay {B} to deal 3 damage.',
        sourceEnergy: { blue: 1 },
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', [])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('resolveBattleAutomatically skips when neither source nor support can pay', () => {
    let state = createBattleState()
    state.players['player-two'].supportArea.forEach((s) => { s.rested = true })
    state.players['player-two'].battleArea[0].card.attackEnergyCost = {}
    state.players['player-two'].battleArea[0].card.attackCost = 0
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          { kind: 'damage', amount: 3, target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 } },
        ],
        effectText: 'Pay {B} to deal 3 damage.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', [])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('reveal-top-deck match with attackTargetOnly preserves pendingBattle until ability effect resolves', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        // 〈can be used as {B}〉是「你可以支付 {B}」，代價要從支援區實際付出來
        // （見 47bed64）——這裡跟著真實卡片的付費方式，別再用 sourceEnergy 抵掉。
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [
              {
                kind: 'damage',
                amount: 2,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ],
        effectText: 'Reveal top card. If blue LV2, deal 2 damage to attacked cookie.',
      },
    ]
    state.players['player-two'].battleArea[0].card.attackCost = 0
    state.players['player-two'].battleArea[0].card.attackEnergyCost = {}
    state.players['player-two'].battleArea[0].card.attack = 1

    const blueLv2: GameCard = {
      id: 'blue-lv2', instanceId: 'blue-lv2', name: 'Blue LV2',
      type: 'cookie', level: 2, energyColor: 'blue', hp: 1, attack: 0, attackCost: 0,
    }
    state.players['player-two'].deck = [blueLv2]
    state.players['player-two'].supportArea = [
      { card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'blue' }, rested: false },
    ]

    state = beginAttack(state, 'attacker', 'defender', [])
    state = advanceToAttackEffect(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()

    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [], [], ['sup'])
    // 代價確實付了：支援卡被橫置。
    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
    expect(state.pendingRevealTopDeck).toBeDefined()
    expect(state.pendingRevealTopDeck!.matched).toBe(true)
    expect(state.pendingBattle).toBeDefined()

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-two',
    })
    expect(state.pendingRevealTopDeck).toBeNull()
    expect(state.pendingAbilityEffect).toBeDefined()
    expect(state.pendingBattle).toBeDefined()
    expect(state.pendingBattle!.targetInstanceId).toBe('defender')

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['defender'],
    })
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.pendingBattle).toBeNull()
    expect(state.status).toBe('playing')
  })

  it('BS3-076: skips the optional reveal-top-deck prompt when the base attack already fainted the attacked cookie', () => {
    let state = createBattleState()
    // 預設 attacker 攻擊力 3 恰好等於 defender 的 3 張 HP 卡，普通攻擊本身
    // 就會讓 defender 昏厥離場；巢狀 damage 效果鎖定 attackTargetOnly，
    // 目標消失後不可能再有合法目標，不該再詢問是否要付費翻牌。
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [
              {
                kind: 'damage',
                amount: 2,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ],
        effectText: 'Reveal top card. If blue LV2, deal 2 damage to attacked cookie.',
      },
    ]
    state.players['player-two'].supportArea = [
      ...state.players['player-two'].supportArea,
      { card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'blue' }, rested: false },
    ]

    state = declareAttack(state)
    state = advanceToAttackEffect(state)

    expect(
      state.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === 'defender',
      ),
    ).toBe(false)
    expect(state.pendingBattle!.stage).toBe('attack-effect')

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
  })
})
