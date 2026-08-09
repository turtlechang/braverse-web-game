import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  createGame,
  getLegalTurnCommands,
  type CookieCard,
  type GameCard,
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

const createPlayingGame = (): GameState => {
  let state = createGame(
    { id: 'player-one', name: '玩家一', deck: createDeck('one') },
    { id: 'player-two', name: '玩家二', deck: createDeck('two') },
    'player-one',
    identityShuffle,
  )
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

const advanceTo = (
  state: GameState,
  phase: GameState['phase'],
): GameState => {
  let current = state
  while (current.phase !== phase) {
    current = applyGameCommand(current, {
      kind: 'advance-phase',
      playerId: current.activePlayerId,
    })
  }
  return current
}

describe('getLegalTurnCommands', () => {
  it('非行動玩家會得到空清單', () => {
    const state = createPlayingGame()

    expect(getLegalTurnCommands(state, 'player-two')).toEqual([])
  })

  it('支援階段列出每張手牌的放置選項與推進階段', () => {
    const state = advanceTo(createPlayingGame(), 'support')

    const commands = getLegalTurnCommands(state, 'player-one')
    const placements = commands.filter(
      (command) => command.kind === 'place-support',
    )
    const handSize = state.players['player-one'].hand.length

    expect(placements).toHaveLength(handSize)
    expect(commands.at(-1)).toEqual({
      kind: 'advance-phase',
      playerId: 'player-one',
    })
  })

  it('本回合已放過支援卡後不再列出放置選項', () => {
    let state = advanceTo(createPlayingGame(), 'support')
    const firstCard = state.players['player-one'].hand[0]
    state = applyGameCommand(state, {
      kind: 'place-support',
      playerId: 'player-one',
      instanceId: firstCard.instanceId,
    })

    const commands = getLegalTurnCommands(state, 'player-one')

    expect(
      commands.some((command) => command.kind === 'place-support'),
    ).toBe(false)
  })

  it('主要階段列出登場選項；先攻第一回合沒有攻擊選項', () => {
    const state = advanceTo(createPlayingGame(), 'main')

    const commands = getLegalTurnCommands(state, 'player-one')
    const deploys = commands.filter(
      (command) => command.kind === 'deploy-cookie',
    )
    const cookieInHand = state.players['player-one'].hand.filter(
      (card) => card.type === 'cookie',
    ).length

    expect(deploys).toHaveLength(cookieInHand)
    expect(commands.some((command) => command.kind === 'attack')).toBe(false)
  })

  it('可攻擊回合列出攻擊者×目標組合並附上能量支付', () => {
    // 推進到玩家一的第三回合主要階段，途中放一張支援卡供攻擊付費。
    let state = advanceTo(createPlayingGame(), 'support')
    state = applyGameCommand(state, {
      kind: 'place-support',
      playerId: 'player-one',
      instanceId: state.players['player-one'].hand[0].instanceId,
    })
    while (
      !(
        state.activePlayerId === 'player-one' &&
        state.phase === 'main' &&
        state.turnNumber >= 3
      )
    ) {
      state = applyGameCommand(state, {
        kind: 'advance-phase',
        playerId: state.activePlayerId,
      })
    }

    const commands = getLegalTurnCommands(state, 'player-one')
    const attacks = commands.filter((command) => command.kind === 'attack')

    expect(attacks.length).toBeGreaterThan(0)
    for (const attack of attacks) {
      expect(attack.kind).toBe('attack')
      if (attack.kind === 'attack') {
        expect(attack.supportPaymentIds.length).toBeGreaterThan(0)
      }
    }
  })

  it('每個枚舉出的指令都能被 applyGameCommand 接受', () => {
    let state = advanceTo(createPlayingGame(), 'main')

    const commands = getLegalTurnCommands(state, 'player-one')
    for (const command of commands) {
      expect(() => applyGameCommand(state, command)).not.toThrow()
    }

    // 支援階段同樣驗證。
    state = createPlayingGame()
    state = advanceTo(state, 'support')
    for (const command of getLegalTurnCommands(state, 'player-one')) {
      expect(() => applyGameCommand(state, command)).not.toThrow()
    }
  })

  it('空戰鬥區仍有餅乾可補位時不列出非法的略過指令', () => {
    const base = createPlayingGame()
    const replacement = createCookie('forced-replacement')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          hand: [replacement, ...base.players['player-two'].hand],
        },
      },
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
    }

    const commands = getLegalTurnCommands(state, 'player-two')

    expect(commands).toContainEqual({
      kind: 'replace-cookie',
      playerId: 'player-two',
      instanceId: replacement.instanceId,
    })
    expect(
      commands.some((command) => command.kind === 'skip-replacement'),
    ).toBe(false)
    for (const command of commands) {
      expect(() => applyGameCommand(state, command)).not.toThrow()
    }
  })

  it('有待處理決策時回傳空清單', () => {
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

    expect(getLegalTurnCommands(state, 'player-one')).toEqual([])
    expect(getLegalTurnCommands(state, 'player-two')).toEqual([])
  })
})
