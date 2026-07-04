import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  createGame,
  createSeededShuffle,
  type GameCard,
  type CookieCard,
  type GameState,
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

const createSetupGame = (): GameState =>
  createGame(
    { id: 'player-one', name: '玩家一', deck: createDeck('one') },
    { id: 'player-two', name: '玩家二', deck: createDeck('two') },
    'player-one',
    identityShuffle,
  )

const createPlayingGame = (): GameState => {
  let state = createSetupGame()
  state = applyGameCommand(state, {
    kind: 'select-starting-cookie',
    playerId: 'player-one',
    instanceId: 'one-starter',
  })
  state = applyGameCommand(state, {
    kind: 'select-starting-cookie',
    playerId: 'player-two',
    instanceId: 'two-starter',
  })
  return state
}

describe('玩家動作指令', () => {
  it('開局指令可以選擇起始餅乾並記錄指令紀錄', () => {
    const state = createPlayingGame()

    expect(state.status).toBe('playing')
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-two'].battleArea).toHaveLength(1)
    expect(state.commandLog).toHaveLength(2)
    expect(state.commandLog?.[0]).toMatchObject({
      id: 1,
      commandKind: 'select-starting-cookie',
      playerId: 'player-one',
    })
    expect(state.commandLog?.[1]).toMatchObject({
      id: 2,
      commandKind: 'select-starting-cookie',
      playerId: 'player-two',
    })
  })

  it('advance-phase 拒絕非回合玩家', () => {
    const state = createPlayingGame()

    expect(state.activePlayerId).toBe('player-one')
    expect(() =>
      applyGameCommand(state, {
        kind: 'advance-phase',
        playerId: 'player-two',
      }),
    ).toThrowError('不是目前的回合玩家。')
  })

  it('place-support 與 deploy-cookie 指令依階段限制執行', () => {
    let state = createPlayingGame()

    expect(() =>
      applyGameCommand(state, {
        kind: 'place-support',
        playerId: 'player-one',
        instanceId: 'one-item-1',
      }),
    ).toThrowError('只能在支援階段放置支援卡。')

    while (state.phase !== 'support') {
      state = applyGameCommand(state, {
        kind: 'advance-phase',
        playerId: 'player-one',
      })
    }

    state = applyGameCommand(state, {
      kind: 'place-support',
      playerId: 'player-one',
      instanceId: 'one-item-1',
    })
    expect(state.players['player-one'].supportArea).toHaveLength(1)

    while (state.phase !== 'main') {
      state = applyGameCommand(state, {
        kind: 'advance-phase',
        playerId: 'player-one',
      })
    }

    state = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: 'one-cookie-0',
    })
    expect(state.players['player-one'].battleArea).toHaveLength(2)

    const kinds = state.commandLog?.map((entry) => entry.commandKind) ?? []
    expect(kinds[0]).toBe('select-starting-cookie')
    expect(kinds[1]).toBe('select-starting-cookie')
    expect(kinds).toContain('place-support')
    expect(kinds[kinds.length - 1]).toBe('deploy-cookie')
    expect(state.commandLog?.every((entry, index) => entry.id === index + 1))
      .toBe(true)
  })

  it('存在待處理決策時拒絕玩家動作指令', () => {
    const base = createPlayingGame()
    const state: GameState = {
      ...base,
      pendingOpponentHandDiscard: {
        playerId: 'player-two',
        count: 1,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'one-starter',
        sourceCardName: '餅乾 one-starter',
        effectText: '棄 1 張手牌',
      },
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'advance-phase',
        playerId: 'player-one',
      }),
    ).toThrowError('必須先處理待處理的決策。')
  })

  it('replace-cookie 與 skip-replacement 拒絕非補位玩家', () => {
    const state = createPlayingGame()

    expect(() =>
      applyGameCommand(state, {
        kind: 'replace-cookie',
        playerId: 'player-one',
        instanceId: 'one-cookie-0',
      }),
    ).toThrowError('不是目前需要補位的玩家。')
    expect(() =>
      applyGameCommand(state, {
        kind: 'skip-replacement',
        playerId: 'player-one',
      }),
    ).toThrowError('不是目前需要補位的玩家。')
  })

  it('mulligan-opening-hand 指令用相同種子洗牌可重現相同手牌', () => {
    const run = () =>
      applyGameCommand(
        createSetupGame(),
        { kind: 'mulligan-opening-hand', playerId: 'player-one' },
        { shuffle: createSeededShuffle(7) },
      )

    const first = run()
    const second = run()

    expect(first.players['player-one'].hand.map((card) => card.instanceId))
      .toEqual(second.players['player-one'].hand.map((card) => card.instanceId))
    expect(first.players['player-one'].hasMulliganed).toBe(true)
  })

  it('沒有戰鬥時 resolve-battle 與 resolve-next-damage 會被拒絕', () => {
    const state = createPlayingGame()

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-battle',
        playerId: 'player-one',
      }),
    ).toThrowError('目前沒有可自動結算的戰鬥。')
    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-next-damage',
        playerId: 'player-one',
      }),
    ).toThrowError('不是目前需要結算傷害的玩家。')
  })
})
