import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  canAttack,
  createDemoGame,
  createGame,
  evaluateBasicVictory,
  getBreakAreaLevel,
  mulliganOpeningHand,
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
