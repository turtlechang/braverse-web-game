import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  attackCookie,
  canAttack,
  createDemoGame,
  createGame,
  deployCookie,
  evaluateBasicVictory,
  getBreakAreaLevel,
  mulliganOpeningHand,
  placeSupportCard,
  resolveBasicVictory,
  selectStartingCookie,
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

describe('開局', () => {
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

  it('攻擊使攻擊者休息，並將目標 HP 卡移入棄牌區', () => {
    let state = createReadyGame()
    state = reachPhase(state, 'end')
    state = advancePhase(state)
    state = reachPhase(state, 'main')

    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]
    const targetHp = target.hpCards.length
    const discardCount = state.players['player-one'].discardPile.length

    state = attackCookie(
      state,
      attacker.card.instanceId,
      target.card.instanceId,
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
    )

    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-one'].breakArea).toContain(target.card)
    expect(state.players['player-one'].discardPile).toContain(target.hpCards[0])
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
