import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  attackCookie,
  canAttack,
  canActivateCookieSkill,
  createDemoGame,
  createGame,
  createSeededShuffle,
  drawMulliganCompensation,
  deployCookie,
  evaluateBasicVictory,
  getBreakAreaLevel,
  getRefreshCandidates,
  forceMulliganOpeningHand,
  keepOpeningHand,
  mulliganOpeningHand,
  placeSupportCard,
  refreshDeck,
  replaceDefeatedCookie,
  resolveBasicVictory,
  selectStartingCookie,
  skipDefeatedCookieReplacement,
  type CookieCard,
  type GameCard,
  type GameState,
  type PlayerId,
} from '.'

const identityShuffle = (cards: GameCard[]) => [...cards]

const createCookie = (
  instanceId: string,
  level = 1,
  hp = 2,
): CookieCard => ({
  id: `cookie-${instanceId}`,
  instanceId,
  name: `餅乾 ${instanceId}`,
  type: 'cookie',
  level,
  hp,
  attack: 1,
  attackCost: 1,
})

const createItem = (instanceId: string): GameCard => ({
  id: `item-${instanceId}`,
  instanceId,
  name: `道具 ${instanceId}`,
  type: 'item',
})

const createDeck = (prefix: string): GameCard[] => [
  createCookie(`${prefix}-starter`, 2, 3),
  ...Array.from({ length: 59 }, (_, index) =>
    index % 10 === 0
      ? createCookie(`${prefix}-cookie-${index}`)
      : createItem(`${prefix}-item-${index}`),
  ),
]

const createReadyGame = (): GameState => {
  let state = createGame(
    {
      id: 'player-one',
      name: '玩家一',
      deck: createDeck('one'),
    },
    {
      id: 'player-two',
      name: '玩家二',
      deck: createDeck('two'),
    },
    'player-one',
    identityShuffle,
  )

  state = selectStartingCookie(state, 'player-one', 'one-starter')
  state = selectStartingCookie(state, 'player-two', 'two-starter')
  return state
}

const reachSecondTurnActive = (initialState: GameState): GameState => {
  let state = initialState

  while (!(state.turnNumber === 2 && state.phase === 'active')) {
    state = advancePhase(state)
  }

  return state
}

describe('開局', () => {
  it('種子洗牌可重現、不修改輸入且不同種子產生不同牌序', () => {
    const deck = createDeck('seeded')
    const originalOrder = deck.map((card) => card.instanceId)
    const first = createSeededShuffle(20260607)(deck)
    const repeated = createSeededShuffle(20260607)(deck)
    const different = createSeededShuffle(20260608)(deck)

    expect(first.map((card) => card.instanceId)).toEqual(
      repeated.map((card) => card.instanceId),
    )
    expect(different.map((card) => card.instanceId)).not.toEqual(
      first.map((card) => card.instanceId),
    )
    expect(deck.map((card) => card.instanceId)).toEqual(originalOrder)
  })

  it('範例對局可直接進入第一回合', () => {
    const state = createDemoGame()

    expect(state.status).toBe('playing')
    expect(state.turnNumber).toBe(1)
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-two'].battleArea).toHaveLength(1)
  })

  it('洗牌後各抽 6 張，並由指定玩家先攻', () => {
    const state = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: createDeck('one'),
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: createDeck('two'),
      },
      'player-two',
      identityShuffle,
    )

    expect(state.status).toBe('setup')
    expect(state.activePlayerId).toBe('player-two')
    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-two'].hand).toHaveLength(6)
    expect(state.players['player-one'].deck).toHaveLength(54)
  })

  it('每位玩家只能自願重抽一次', () => {
    const initialState = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: createDeck('one'),
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: createDeck('two'),
      },
      'player-one',
      identityShuffle,
    )

    const state = mulliganOpeningHand(
      initialState,
      'player-one',
      identityShuffle,
    )

    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-one'].deck).toHaveLength(54)
    expect(state.players['player-one'].hasMulliganed).toBe(true)
    expect(() =>
      mulliganOpeningHand(state, 'player-one', identityShuffle),
    ).toThrow('每位玩家只能自願重抽一次。')
  })

  it('可保留初始手牌並鎖定自由調度決定', () => {
    const initialState = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: createDeck('one'),
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: createDeck('two'),
      },
      'player-one',
      identityShuffle,
    )

    const state = keepOpeningHand(initialState, 'player-one')

    expect(state.players['player-one'].freeMulliganDecided).toBe(true)
    expect(() => keepOpeningHand(state, 'player-one')).toThrow(
      '已完成自由調度決定',
    )
  })

  it('無餅乾手牌可反覆強制調度並記錄次數', () => {
    const itemOnlyDeck = Array.from({ length: 60 }, (_, index) =>
      createItem(`forced-${index}`),
    )
    let state = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: itemOnlyDeck,
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: createDeck('two'),
      },
      'player-one',
      identityShuffle,
    )

    state = forceMulliganOpeningHand(
      state,
      'player-one',
      identityShuffle,
    )

    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-one'].forcedMulliganCount).toBe(1)
  })

  it('強制調度後對手可抽取一張補償牌', () => {
    const initialState = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: createDeck('one'),
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: createDeck('two'),
      },
      'player-one',
      identityShuffle,
    )
    const handSize = initialState.players['player-two'].hand.length

    const state = drawMulliganCompensation(
      initialState,
      'player-two',
    )

    expect(state.players['player-two'].hand).toHaveLength(handSize + 1)
  })

  it('選擇起始餅乾後配置 HP，雙方完成後開始遊戲', () => {
    const state = createReadyGame()

    expect(state.status).toBe('playing')
    expect(state.phase).toBe('active')
    expect(state.players['player-one'].battleArea[0].card.instanceId).toBe(
      'one-starter',
    )
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(state.players['player-one'].hand).toHaveLength(5)
    expect(state.players['player-one'].deck).toHaveLength(51)
  })
})

describe('回合階段', () => {
  it('先攻第一回合跳過抽牌階段且不能攻擊', () => {
    let state = createReadyGame()
    const handSize = state.players['player-one'].hand.length

    state = advancePhase(state)

    expect(state.phase).toBe('support')
    expect(state.players['player-one'].hand).toHaveLength(handSize)

    state = advancePhase(state)
    expect(state.phase).toBe('main')
    expect(canAttack(state)).toBe(false)
  })

  it('離開活躍階段時將目前玩家的餅乾與支援卡轉為活躍', () => {
    let state = createReadyGame()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: state.players['player-one'].battleArea.map((cookie) => ({
            ...cookie,
            rested: true,
          })),
          supportArea: [
            {
              card: createItem('rested-support'),
              rested: true,
            },
          ],
        },
      },
    }

    state = advancePhase(state)

    expect(state.players['player-one'].battleArea[0].rested).toBe(false)
    expect(state.players['player-one'].supportArea[0].rested).toBe(false)
  })

  it('結束階段後換人，下一回合進入抽牌階段時抽 2 張', () => {
    let state = createReadyGame()

    state = advancePhase(state)
    state = advancePhase(state)
    state = advancePhase(state)
    state = advancePhase(state)

    expect(state.activePlayerId).toBe('player-two')
    expect(state.turnNumber).toBe(2)
    expect(state.phase).toBe('active')

    const handSize = state.players['player-two'].hand.length
    state = advancePhase(state)

    expect(state.phase).toBe('draw')
    expect(state.players['player-two'].hand).toHaveLength(handSize + 2)

    state = advancePhase(state)
    state = advancePhase(state)
    expect(state.phase).toBe('main')
    expect(canAttack(state)).toBe(true)
  })
})

describe('玩家動作', () => {
  const reachPhase = (state: GameState, phase: GameState['phase']) => {
    let current = state

    while (current.phase !== phase) {
      current = advancePhase(current)
    }

    return current
  }

  const addActiveSupport = (
    state: GameState,
    playerId: PlayerId,
    instanceId = `${playerId}-payment`,
  ): GameState => ({
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        supportArea: [
          ...state.players[playerId].supportArea,
          {
            card: createItem(instanceId),
            rested: false,
          },
        ],
      },
    },
  })

  it('支援階段可從手牌放置一張支援卡，每回合限一次', () => {
    let state = reachPhase(createReadyGame(), 'support')
    const player = state.players[state.activePlayerId]
    const firstCard = player.hand[0]

    state = placeSupportCard(state, firstCard.instanceId)

    expect(state.players['player-one'].hand).toHaveLength(4)
    expect(state.players['player-one'].supportArea[0].card).toBe(firstCard)
    expect(state.supportPlacedThisTurn).toBe(true)
    expect(() =>
      placeSupportCard(
        state,
        state.players['player-one'].hand[0].instanceId,
      ),
    ).toThrow('每回合只能放置一張支援卡。')
  })

  it('主要階段可登場第二隻餅乾並配置 HP', () => {
    let state = reachPhase(createReadyGame(), 'main')
    const player = state.players['player-one']
    const cookie = player.hand.find((card) => card.type === 'cookie')

    expect(cookie).toBeDefined()
    state = deployCookie(state, cookie!.instanceId)

    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(
      cookie!.type === 'cookie' ? cookie!.hp : 0,
    )
    expect(state.players['player-one'].hand).not.toContain(cookie)
  })

  it('登場配置 HP 後牌庫歸零時立即要求 Refresh', () => {
    let state = reachPhase(createReadyGame(), 'main')
    const cookie = state.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )
    const refreshCookie = createCookie('deploy-refresh', 1)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [createItem('hp-a'), createItem('hp-b')],
          discardPile: [refreshCookie, createItem('recycled')],
        },
      },
    }

    state = deployCookie(state, cookie!.instanceId)

    expect(state.pendingRefresh).toEqual({
      playerId: 'player-one',
      remainingDraws: 0,
    })
    expect(() => advancePhase(state)).toThrow('必須先完成牌庫 Refresh。')
  })

  it('攻擊使攻擊者休息，並將目標 HP 卡移入棄牌區', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')
    state = addActiveSupport(state, 'player-two')

    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]
    const targetHp = target.hpCards.length
    const discardCount = state.players['player-one'].discardPile.length

    state = attackCookie(
      state,
      attacker.card.instanceId,
      target.card.instanceId,
      ['player-two-payment'],
    )

    expect(state.players['player-two'].battleArea[0].rested).toBe(true)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(
      targetHp - attacker.card.attack,
    )
    expect(state.players['player-one'].discardPile).toHaveLength(
      discardCount + attacker.card.attack,
    )
  })

  it('HP 歸零時目標餅乾進入休息區', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')
    state = addActiveSupport(state, 'player-two')

    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [{ ...target, hpCards: [target.hpCards[0]] }],
        },
      },
    }

    state = attackCookie(
      state,
      state.players['player-two'].battleArea[0].card.instanceId,
      target.card.instanceId,
      ['player-two-payment'],
    )

    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-one'].breakArea).toContain(target.card)
    expect(state.players['player-one'].discardPile).toContain(target.hpCards[0])
    expect(state.pendingReplacement?.tasks[0]).toEqual({
      playerId: 'player-one',
      remaining: 1,
    })
  })

  it('攻擊必須支付足額的活躍支援卡', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')

    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]

    expect(() =>
      attackCookie(
        state,
        attacker.card.instanceId,
        target.card.instanceId,
        [],
      ),
    ).toThrow('需要選擇 1 張支援卡，目前已選 0 張。')

    state = addActiveSupport(state, 'player-two')
    state = attackCookie(
      state,
      attacker.card.instanceId,
      target.card.instanceId,
      ['player-two-payment'],
    )

    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
  })

  it('攻擊付款必須符合指定顏色，萬用能量可替代', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')

    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            {
              ...attacker,
              card: {
                ...attacker.card,
                attackEnergyCost: { red: 1 },
              },
            },
          ],
          supportArea: [
            {
              card: {
                ...createItem('blue-payment'),
                energyColor: 'blue',
              },
              rested: false,
            },
          ],
        },
      },
    }

    expect(() =>
      attackCookie(
        state,
        attacker.card.instanceId,
        target.card.instanceId,
        ['blue-payment'],
      ),
    ).toThrow('能量顏色不符合費用需求')

    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          supportArea: [
            {
              card: {
                ...createItem('wild-payment'),
                energyColor: 'wild',
              },
              rested: false,
            },
          ],
        },
      },
    }
    state = attackCookie(
      state,
      attacker.card.instanceId,
      target.card.instanceId,
      ['wild-payment'],
    )

    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
  })

  it('擊倒最後一隻餅乾後必須補充，補充完成才能繼續', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')
    state = addActiveSupport(state, 'player-two')

    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [{ ...target, hpCards: [target.hpCards[0]] }],
        },
      },
    }
    state = attackCookie(
      state,
      state.players['player-two'].battleArea[0].card.instanceId,
      target.card.instanceId,
      ['player-two-payment'],
    )

    expect(() => advancePhase(state)).toThrow('必須先補充戰鬥區餅乾。')

    const replacement = state.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )
    expect(replacement).toBeDefined()

    state = replaceDefeatedCookie(state, replacement!.instanceId)

    expect(state.pendingReplacement).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-one'].battleArea[0].card).toBe(replacement)
  })

  it('allows replacement OnPlay during the opponent turn', () => {
    let state = createDemoGame()
    const replacement: CookieCard = {
      ...createCookie('opponent-turn-replacement'),
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'OnPlay skill',
        effects: [],
      },
    }
    state = {
      ...state,
      activePlayerId: 'player-two',
      pendingReplacement: {
        tasks: [{ playerId: 'player-one', remaining: 1 }],
      },
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [],
          hand: [replacement],
        },
      },
    }

    state = replaceDefeatedCookie(state, replacement.instanceId)

    expect(state.pendingOnPlay).toEqual({
      playerId: 'player-one',
      sourceInstanceId: replacement.instanceId,
    })
    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        replacement.instanceId,
        'on-play',
      ),
    ).toBe(true)
  })

  it('擊倒最後一隻餅乾且無合法補位時，詢問後才判定敗北', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')
    state = addActiveSupport(state, 'player-two')

    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [createItem('only-item')],
          battleArea: [{ ...target, hpCards: [target.hpCards[0]] }],
        },
      },
    }
    state = attackCookie(
      state,
      state.players['player-two'].battleArea[0].card.instanceId,
      target.card.instanceId,
      ['player-two-payment'],
    )

    expect(state.status).toBe('playing')
    expect(state.pendingReplacement?.tasks[0]).toEqual({
      playerId: 'player-one',
      remaining: 1,
    })

    state = skipDefeatedCookieReplacement(state)

    expect(state.status).toBe('finished')
    expect(state.result).toEqual({
      winnerId: 'player-two',
      loserId: 'player-one',
      reason: 'no-cookie-available',
    })
    expect(state.pendingReplacement).toBeNull()
  })

  it('擊倒使休息區 LV 達 10 時直接結束，不進入補充流程', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')
    state = addActiveSupport(state, 'player-two')

    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [{ ...target, hpCards: [target.hpCards[0]] }],
          breakArea: [createCookie('break-eight', 8)],
        },
      },
    }

    state = attackCookie(
      state,
      state.players['player-two'].battleArea[0].card.instanceId,
      target.card.instanceId,
      ['player-two-payment'],
    )

    expect(state.status).toBe('finished')
    expect(state.result?.reason).toBe('break-level-limit')
    expect(state.pendingReplacement).toBeNull()
  })
})

describe('牌庫 Refresh', () => {
  const identity = (cards: GameCard[]) => [...cards]

  it('牌庫耗盡時選擇棄牌區餅乾進休息區並洗回其餘卡牌', () => {
    let state = createReadyGame()
    const refreshCookie = createCookie('refresh-cookie', 2)
    const recycledItem = createItem('recycled-item')
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [],
          discardPile: [refreshCookie, recycledItem],
        },
      },
    }

    expect(getRefreshCandidates(state, 'player-one')).toEqual([refreshCookie])
    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      identity,
    )

    expect(state.players['player-one'].breakArea).toContain(refreshCookie)
    expect(state.players['player-one'].deck).toEqual([recycledItem])
    expect(state.players['player-one'].discardPile).toHaveLength(0)
  })

  it('抽牌途中耗盡時等待 Refresh，完成後補足剩餘抽牌', () => {
    let state = createReadyGame()
    state = reachSecondTurnActive(state)
    const lastDeckCard = createItem('last-deck-card')
    const refreshCookie = createCookie('refresh-draw-cookie', 1)
    const recycledA = createItem('recycled-a')
    const recycledB = createItem('recycled-b')
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          deck: [lastDeckCard],
          discardPile: [refreshCookie, recycledA, recycledB],
        },
      },
    }
    const handSize = state.players['player-two'].hand.length

    state = advancePhase(state)

    expect(state.phase).toBe('draw')
    expect(state.pendingRefresh).toEqual({
      playerId: 'player-two',
      remainingDraws: 1,
    })
    expect(state.players['player-two'].hand).toContain(lastDeckCard)
    expect(() => advancePhase(state)).toThrow('必須先完成牌庫 Refresh。')

    state = refreshDeck(
      state,
      'player-two',
      refreshCookie.instanceId,
      identity,
    )

    expect(state.pendingRefresh).toBeNull()
    expect(state.players['player-two'].hand).toHaveLength(handSize + 2)
    expect(state.players['player-two'].hand).toContain(recycledA)
  })

  it('抽牌剛好將牌庫抽成 0 時也必須完成 Refresh', () => {
    let state = reachSecondTurnActive(createReadyGame())
    const refreshCookie = createCookie('exact-refresh-cookie', 1)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          deck: [createItem('exact-a'), createItem('exact-b')],
          discardPile: [refreshCookie, createItem('exact-recycled')],
        },
      },
    }

    state = advancePhase(state)

    expect(state.players['player-two'].deck).toHaveLength(0)
    expect(state.pendingRefresh).toEqual({
      playerId: 'player-two',
      remainingDraws: 0,
    })
  })

  it('Refresh 使休息區 LV 達 10 時立即判敗', () => {
    let state = createReadyGame()
    const refreshCookie = createCookie('fatal-refresh', 2)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [],
          discardPile: [refreshCookie, createItem('recycled')],
          breakArea: [createCookie('existing-break', 8)],
        },
      },
    }

    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      identity,
    )

    expect(state.status).toBe('finished')
    expect(state.result?.reason).toBe('break-level-limit')
    expect(state.result?.winnerId).toBe('player-two')
  })

  it('抽牌耗盡且沒有合法 Refresh 候選時立即判敗', () => {
    let state = reachSecondTurnActive(createReadyGame())
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          deck: [],
          discardPile: [createItem('no-cookie')],
        },
      },
    }

    state = advancePhase(state)

    expect(state.status).toBe('finished')
    expect(state.result).toEqual({
      winnerId: 'player-one',
      loserId: 'player-two',
      reason: 'refresh-unavailable',
    })
  })
})

describe('基本勝負判定', () => {
  const withPlayer = (
    state: GameState,
    playerId: PlayerId,
    changes: Partial<GameState['players'][PlayerId]>,
  ): GameState => ({
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        ...changes,
      },
    },
  })

  it('休息區餅乾 LV 合計達 10 時判定敗北', () => {
    let state = createReadyGame()
    state = withPlayer(state, 'player-two', {
      breakArea: [
        createCookie('break-a', 4),
        createCookie('break-b', 6),
      ],
    })

    expect(getBreakAreaLevel(state, 'player-two')).toBe(10)
    expect(evaluateBasicVictory(state)).toEqual({
      winnerId: 'player-one',
      loserId: 'player-two',
      reason: 'break-level-limit',
    })

    const finishedState = resolveBasicVictory(state)
    expect(finishedState.status).toBe('finished')
    expect(finishedState.result?.winnerId).toBe('player-one')
  })

  it('戰鬥區清空且手牌沒有餅乾時判定敗北', () => {
    let state = createReadyGame()
    state = withPlayer(state, 'player-one', {
      battleArea: [],
      hand: [createItem('last-card')],
    })

    expect(evaluateBasicVictory(state)).toEqual({
      winnerId: 'player-two',
      loserId: 'player-one',
      reason: 'no-cookie-available',
    })
  })

  it('戰鬥區清空但手牌仍有餅乾時不會立即敗北', () => {
    let state = createReadyGame()
    state = withPlayer(state, 'player-one', {
      battleArea: [],
      hand: [createCookie('replacement')],
    })

    expect(evaluateBasicVictory(state)).toBeNull()
  })
})
