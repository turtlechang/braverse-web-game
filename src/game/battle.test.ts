import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  executeCardEffect,
  getFaintEffectCandidates,
  getTrapCandidates,
  playTrap,
  refreshDeck,
  resolveFaintEffect,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'

const item = (
  instanceId: string,
  energyColor: GameCard['energyColor'] = 'red',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor,
})

const cookie = (
  instanceId: string,
  attack = 1,
  hp = 2,
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  officialType: 'cookie',
  level: 1,
  hp,
  attack,
  attackCost: 1,
  attackEnergyCost: { red: 1 },
  energyColor: 'red',
})

const createBattleState = (): GameState => {
  const defender = cookie('defender', 1, 3)
  const attacker = cookie('attacker', 3, 1)

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '防守玩家',
        deck: [item('p1-deck-a'), item('p1-deck-b')],
        hand: [item('p1-hand-a'), cookie('p1-replacement')],
        battleArea: [
          {
            card: defender,
            hpCards: [
              item('defender-hp-a'),
              item('defender-hp-b'),
              item('defender-hp-c'),
            ],
            rested: false,
            battleEntryId: 'defender:battle:1',
          },
        ],
        supportArea: [
          { card: item('p1-support-a'), rested: false },
          { card: item('p1-support-b'), rested: false },
        ],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: false,
        startingCookieSelected: true,
      },
      'player-two': {
        id: 'player-two',
        name: '攻擊玩家',
        deck: [item('p2-deck-a')],
        hand: [cookie('p2-replacement')],
        battleArea: [
          {
            card: attacker,
            hpCards: [item('attacker-hp')],
            rested: false,
            battleEntryId: 'attacker:battle:2',
          },
        ],
        supportArea: [
          { card: item('p2-support'), rested: false },
        ],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: false,
        startingCookieSelected: true,
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-two',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

const declareAttack = (state: GameState) =>
  beginAttack(state, 'attacker', 'defender', ['p2-support'])

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
        effects: [{ kind: 'draw', amount: 1 }],
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

    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'p1-deck-a' }),
    )
    expect(state.players['player-one'].discardPile).toContain(flipCard)
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
    ).toThrow('必須棄置 1 張手牌')
  })

  it('pauses FLIP damage continuation until pending Refresh is completed', () => {
    const flipCard: GameCard = {
      ...cookie('refresh-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw', amount: 1 }],
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

    expect(state.pendingRefresh).toEqual({
      playerId: 'player-one',
      remainingDraws: 0,
    })
    expect(() => resolveNextDamage(state)).toThrow('必須先完成牌庫 Refresh')

    state = refreshDeck(
      state,
      'player-one',
      'refresh-cookie',
      (cards) => [...cards],
    )
    expect(state.pendingBattle?.stage).toBe('damage')
  })
})

describe('TRAP response window', () => {
  it('only offers traps whose energy color and quantity can be paid', () => {
    const trap: GameCard = {
      id: 'yellow-trap',
      instanceId: 'yellow-trap',
      name: '黃色陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: '{Y}{Y} The attacking Cookie deals -1 damage.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toEqual([])

    state.players['player-one'].supportArea = [
      { card: item('yellow-support-a', 'yellow'), rested: false },
      { card: item('yellow-support-b', 'yellow'), rested: false },
    ]

    expect(getTrapCandidates(state, 'player-one')).toEqual([trap])
  })

  it('pays for one trap and applies attack reduction before damage', () => {
    const trap: GameCard = {
      id: 'red-trap',
      instanceId: 'red-trap',
      name: '減攻陷阱',
      type: 'trap',
      officialType: 'trap',
      energyColor: 'red',
      trap: {
        text: '《{R}》 Opponent Cookie deals -2 attack damage.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -2,
            duration: 'this-turn',
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['attacker'],
    })

    expect(state.pendingBattle).toMatchObject({
      stage: 'damage',
      trapUsed: true,
      remainingDamage: 1,
    })
    expect(state.players['player-one'].discardPile).toContain(trap)
    expect(state.players['player-one'].supportArea[0].rested).toBe(true)
    expect(() =>
      playTrap(state, 'player-one', {
        trapInstanceId: trap.instanceId,
        paymentIds: [],
        targetIds: [],
      }),
    ).toThrow('目前不能發動陷阱')
  })

  it('skips attack damage when a trap knocks out the attacker', () => {
    const trap: GameCard = {
      id: 'damage-trap',
      instanceId: 'damage-trap',
      name: '反擊陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Deal 1 damage.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 1,
              max: 1,
              remainingHp: 1,
            },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['attacker'],
    })

    expect(state.pendingBattle).toMatchObject({
      damagePlayerId: 'player-two',
      damageTargetInstanceId: 'attacker',
      remainingDamage: 1,
      suspendedAttackDamage: 3,
    })

    state = resolveNextDamage(state)
    expect(state.players['player-two'].battleArea).toHaveLength(0)
    expect(state.pendingBattle).toBeNull()
  })

  it('skips attack damage after trap damage knocks out attacker with FLIP', () => {
    const attackerFlip: GameCard = {
      ...cookie('attacker-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const trap: GameCard = {
      id: 'flip-damage-trap',
      instanceId: 'flip-damage-trap',
      name: '翻牌反擊',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Deal 1 damage.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-two'].battleArea[0].hpCards = [attackerFlip]
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = playTrap(declareAttack(state), 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['attacker'],
    })
    state = resolveNextDamage(state)

    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.damagePlayerId).toBe('player-two')

    state = resolveFlip(state, 'player-two', { activate: false })
    expect(state.pendingBattle).toBeNull()
  })

  it('prevents the protected target from reaching zero HP this battle', () => {
    const trap: GameCard = {
      id: 'guard-trap',
      instanceId: 'guard-trap',
      name: '守護陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'HP cannot reach 0 during this battle.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'prevent-knockout',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [item('last-hp')]
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['defender'],
    })
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('resolves a faint-condition trap after battle damage', () => {
    const trap: GameCard = {
      id: 'faint-trap',
      instanceId: 'faint-trap',
      name: '昏厥後支援陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text:
          'If any of your {G} Cookies fainted during this battle, take the top card from your deck and place it in your support area as rested.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        condition: {
          kind: 'friendly-color-fainted-this-battle',
          color: 'green',
        },
        effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      card: {
        ...state.players['player-one'].battleArea[0].card,
        energyColor: 'green',
      },
      hpCards: [item('last-green-hp')],
    }
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = playTrap(declareAttack(state), 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: [],
    })
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(
      state.players['player-one'].supportArea.find(
        (support) => support.card.instanceId === 'p1-deck-a',
      ),
    ).toMatchObject({ rested: true })
  })

  describe('faint effect queue', () => {
    const createFaintState = (): GameState => {
      const faintCookie: CookieCard = {
        id: 'faint-cookie',
        instanceId: 'faint-cookie',
        name: 'Faint Cookie',
        type: 'cookie',
        officialType: 'cookie',
        level: 2,
        hp: 1,
        attack: 1,
        attackCost: 1,
        attackEnergyCost: { red: 1 },
        energyColor: 'yellow',
        skill: {
          trigger: 'passive',
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: {},
          text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
          faint: true,
        },
      }

      const attacker: CookieCard = {
        id: 'attacker',
        instanceId: 'attacker',
        name: 'attacker',
        type: 'cookie',
        officialType: 'cookie',
        level: 1,
        hp: 2,
        attack: 5,
        attackCost: 1,
        attackEnergyCost: { red: 1 },
        energyColor: 'red',
      }

      return {
        players: {
          'player-one': {
            id: 'player-one',
            name: 'P1',
            deck: [item('p1-d')],
            hand: [cookie('p1-replacement')],
            battleArea: [
              {
                card: faintCookie,
                hpCards: [item('faint-hp')],
                rested: false,
                battleEntryId: 'faint:battle:1',
              },
            ],
            supportArea: [{ card: item('p1-s'), rested: false }],
            breakArea: [],
            discardPile: [],
            stage: null,
            hasMulliganed: false,
            startingCookieSelected: true,
          },
          'player-two': {
            id: 'player-two',
            name: 'P2',
            deck: [item('p2-d')],
            hand: [cookie('p2-replacement')],
            battleArea: [
              {
                card: attacker,
                hpCards: [item('p2-hp')],
                rested: false,
                battleEntryId: 'attacker:battle:2',
              },
            ],
            supportArea: [{ card: item('p2-s'), rested: false }],
            breakArea: [],
            discardPile: [],
            stage: null,
            hasMulliganed: false,
            startingCookieSelected: true,
          },
        },
        firstPlayerId: 'player-one',
        activePlayerId: 'player-two',
        turnNumber: 2,
        phase: 'main',
        status: 'playing',
        result: null,
        supportPlacedThisTurn: false,
        skillUsesThisTurn: [],
        nextBattleEntrySequence: 3,
        attackModifiers: [],
        damageReceivedModifiers: [],
        pendingReplacement: null,
        departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
        pendingRefresh: null,
        pendingBattle: null,
      }
    }

    it('queues faint effect instead of auto-executing in battle damage', () => {
      const state = createFaintState()
      const battleState = beginAttack(
        state,
        'attacker',
        'faint-cookie',
        ['p2-s'],
      )
      // Attacker deals 5 damage, faint-cookie has 1 HP
      const battle1 = skipTrap(battleState, 'player-one')
      // Resolve first (and only) HP → cookie faints
      const afterDamage = resolveNextDamage(battle1)
      
      expect(afterDamage.pendingFaintEffects).toBeDefined()
      expect(afterDamage.pendingFaintEffects!.length).toBe(1)
      expect(afterDamage.pendingFaintEffects![0].sourceInstanceId).toBe('faint-cookie')
      expect(afterDamage.pendingFaintEffects![0].sourcePlayerId).toBe('player-one')
    })

    it('getFaintEffectCandidates returns opponent cookies', () => {
      const state = createFaintState()
      let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
      battleState = skipTrap(battleState, 'player-one')
      const afterDamage = resolveNextDamage(battleState)
      
      const candidates = getFaintEffectCandidates(afterDamage)
      expect(candidates.length).toBe(1)
      expect(candidates[0].card.instanceId).toBe('attacker')
    })

    it('resolveFaintEffect damages selected target', () => {
      const state = createFaintState()
      // Give attacker 2 HP so it survives 1 faint damage
      state.players['player-two'].battleArea[0] = {
        ...state.players['player-two'].battleArea[0],
        hpCards: [item('p2-hp-a'), item('p2-hp-b')],
      }
      let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
      battleState = skipTrap(battleState, 'player-one')
      let afterDamage = resolveNextDamage(battleState)
      
      afterDamage = resolveFaintEffect(afterDamage, ['attacker'])
      expect(afterDamage.pendingFaintEffects).toBeUndefined()
      expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
    })

    it('resolveFaintEffect skips when targets empty (up to 1 → 0)', () => {
      const state = createFaintState()
      let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
      battleState = skipTrap(battleState, 'player-one')
      let afterDamage = resolveNextDamage(battleState)
      
      afterDamage = resolveFaintEffect(afterDamage, [])
      expect(afterDamage.pendingFaintEffects).toBeUndefined()
      // Attacker should not have taken damage
      expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
    })

    it('faint triggered by effect damage also queues', () => {
      const state = createFaintState()
      const result = executeCardEffect(
        state,
        { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
        ['faint-cookie'],
      )
      
      // Should queue a faint effect since the cookie has faint skill
      expect(result.pendingFaintEffects).toBeDefined()
      expect(result.pendingFaintEffects!.length).toBeGreaterThanOrEqual(1)
    })

    it('faint respects missing candidates (empty opponent battle area)', () => {
      let state = createFaintState()
      state = {
        ...state,
        players: {
          ...state.players,
          'player-two': {
            ...state.players['player-two'],
            battleArea: [],
          },
        },
      }
      // Deal direct damage to the faint cookie to kill it
      const result = executeCardEffect(
        state,
        { sourcePlayerId: 'player-two', sourceInstanceId: 'effect-source' },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
        ['faint-cookie'],
      )
      
      // No opponent cookies → no faint effect queued (candidates empty)
      expect(result.pendingFaintEffects ?? []).toHaveLength(0)
    })

  })

  describe('ST2-021 Pretzel Snare condition + damage', () => {
    const pretzelSnare: GameCard = {
      id: 'ST2-021',
      instanceId: 'pretzel-snare',
      name: 'Pretzel Snare',
      type: 'trap',
      officialType: 'trap',
      energyColor: 'yellow',
      trap: {
        text: '《{Y}{Y}》 If 1 of your opponent\'s Cookies attacks more than 4 damage, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        condition: { kind: 'attacker-attack-more-than', amount: 4 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }

    const yellowSupport = (id: string): GameCard => ({
      id,
      instanceId: id,
      name: id,
      type: 'item',
      energyColor: 'yellow',
    })

    const createPretzelState = (attack: number): GameState => {
      const attacker = { ...cookie('attacker', attack, 3) }
      const defender = cookie('defender', 1, 3)
      return {
        players: {
          'player-one': {
            id: 'player-one',
            name: 'P1',
            deck: [item('p1-d')],
            hand: [pretzelSnare, cookie('p1-replacement')],
            battleArea: [
              {
                card: defender,
                hpCards: [item('defender-hp-a'), item('defender-hp-b'), item('defender-hp-c')],
                rested: false,
                battleEntryId: 'defender:battle:1',
              },
            ],
            supportArea: [
              { card: yellowSupport('p1-yellow-a'), rested: false },
              { card: yellowSupport('p1-yellow-b'), rested: false },
            ],
            breakArea: [],
            discardPile: [],
            stage: null,
            hasMulliganed: false,
            startingCookieSelected: true,
          },
          'player-two': {
            id: 'player-two',
            name: 'P2',
            deck: [item('p2-d')],
            hand: [cookie('p2-replacement')],
            battleArea: [
              {
                card: attacker,
                hpCards: [item('attacker-hp-a'), item('attacker-hp-b'), item('attacker-hp-c')],
                rested: false,
                battleEntryId: 'attacker:battle:2',
              },
            ],
            supportArea: [
              { card: item('p2-support'), rested: false },
            ],
            breakArea: [],
            discardPile: [],
            stage: null,
            hasMulliganed: false,
            startingCookieSelected: true,
          },
        },
        firstPlayerId: 'player-one',
        activePlayerId: 'player-two',
        turnNumber: 2,
        phase: 'main',
        status: 'playing',
        result: null,
        supportPlacedThisTurn: false,
        skillUsesThisTurn: [],
        nextBattleEntrySequence: 3,
        attackModifiers: [],
        damageReceivedModifiers: [],
        pendingReplacement: null,
        departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
        pendingRefresh: null,
        pendingBattle: null,
      }
    }

    it('excludes trap when declaredDamage=4 (condition not met)', () => {
      const state = beginAttack(createPretzelState(4), 'attacker', 'defender', ['p2-support'])
      expect(getTrapCandidates(state, 'player-one')).toEqual([])
    })

    it('includes trap when declaredDamage=5 (condition met)', () => {
      const state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
      expect(getTrapCandidates(state, 'player-one')).toEqual([pretzelSnare])
    })

    it('deals 1 damage to selected target and continues original attack', () => {
      let state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
      state = playTrap(state, 'player-one', {
        trapInstanceId: pretzelSnare.instanceId,
        paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
        targetIds: ['attacker'],
      })
      // Trap damage should be in flight (suspendedAttackDamage set)
      expect(state.pendingBattle).toMatchObject({
        stage: 'damage',
        damagePlayerId: 'player-two',
        damageTargetInstanceId: 'attacker',
        remainingDamage: 1,
        suspendedAttackDamage: 5,
      })
      expect(state.players['player-one'].discardPile).toContain(pretzelSnare)

      // Resolve trap damage: attacker loses 1 HP
      state = resolveNextDamage(state)
      expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)

      // Original attack resumes against defender (5 damage, 3 HP)
      state = resolveNextDamage(state) // defender 2/3
      state = resolveNextDamage(state) // defender 1/3
      state = resolveNextDamage(state) // defender 0/3 → faints, remainingDamage=2
      state = resolveNextDamage(state) // target gone → finishBattle
      expect(state.pendingBattle).toBeNull()
      expect(state.players['player-one'].battleArea).toHaveLength(0)
    })

    it('skips damage effect when targetIds=[] (select 0) and continues original attack', () => {
      let state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
      state = playTrap(state, 'player-one', {
        trapInstanceId: pretzelSnare.instanceId,
        paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
        targetIds: [],
      })
      // Trap was paid and discarded, but no damage effect
      expect(state.players['player-one'].discardPile).toContain(pretzelSnare)
      expect(state.pendingBattle).toMatchObject({
        stage: 'damage',
        trapUsed: true,
      })
      // suspendedAttackDamage should NOT be set (we didn't enter damage sub-stage)
      expect((state.pendingBattle as NonNullable<typeof state.pendingBattle>).suspendedAttackDamage).toBeUndefined()

      // Original attack should proceed normally (5 damage against defender with 3 HP)
      state = resolveNextDamage(state) // defender 2/3
      state = resolveNextDamage(state) // defender 1/3
      state = resolveNextDamage(state) // defender 0/3 → faints, remainingDamage=2
      state = resolveNextDamage(state) // target gone → finishBattle
      expect(state.pendingBattle).toBeNull()
      expect(state.players['player-one'].battleArea).toHaveLength(0)
      // Attacker took no trap damage (still has 3 HP)
      expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    })

    it('rejects invalid payment (not enough yellow energy)', () => {
      const state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
      expect(() => playTrap(state, 'player-one', {
        trapInstanceId: pretzelSnare.instanceId,
        paymentIds: ['p1-yellow-a'],
        targetIds: ['attacker'],
      })).toThrow('支付無效')
    })
  })
})

