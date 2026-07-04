import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  createGame,
  createSeededShuffle,
  replayCommandLog,
  replayCommands,
  commandFromLogEntry,
  type GameCard,
  type CookieCard,
  type GameCommand,
  type GameState,
  type PlayerId,
} from '.'

const REPLAY_SEED = 20260704

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

const createInitialState = (): GameState =>
  createGame(
    { id: 'player-one', name: '玩家一', deck: createDeck('one') },
    { id: 'player-two', name: '玩家二', deck: createDeck('two') },
    'player-one',
    identityShuffle,
  )

interface ScriptedMatch {
  finalState: GameState
  commands: GameCommand[]
}

/**
 * 用指令驅動一場固定腳本對局：雙方選起始餅乾、玩家一調度重抽、
 * 三回合的支援放置與登場，最後由玩家一發動攻擊完成戰鬥結算。
 */
const playScriptedMatch = (): ScriptedMatch => {
  const options = { shuffle: createSeededShuffle(REPLAY_SEED) }
  const commands: GameCommand[] = []
  let state = createInitialState()

  const apply = (command: GameCommand) => {
    state = applyGameCommand(state, command, options)
    commands.push(command)
  }

  const advanceTo = (playerId: PlayerId, phase: GameState['phase']) => {
    while (!(state.activePlayerId === playerId && state.phase === phase)) {
      apply({ kind: 'advance-phase', playerId: state.activePlayerId })
    }
  }

  apply({
    kind: 'mulligan-opening-hand',
    playerId: 'player-one',
  })
  apply({
    kind: 'select-starting-cookie',
    playerId: 'player-one',
    instanceId: state.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )!.instanceId,
  })
  apply({
    kind: 'select-starting-cookie',
    playerId: 'player-two',
    instanceId: 'two-starter',
  })

  // 回合一（玩家一）：放支援、登場一隻餅乾。
  advanceTo('player-one', 'support')
  const supportCard = state.players['player-one'].hand.find(
    (card) => card.type === 'item',
  )!
  apply({
    kind: 'place-support',
    playerId: 'player-one',
    instanceId: supportCard.instanceId,
  })
  advanceTo('player-one', 'main')
  const deployTarget = state.players['player-one'].hand.find(
    (card) => card.type === 'cookie',
  )
  if (deployTarget) {
    apply({
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: deployTarget.instanceId,
    })
  }
  advanceTo('player-two', 'active')

  // 回合二（玩家二）：放支援後結束。
  advanceTo('player-two', 'support')
  apply({
    kind: 'place-support',
    playerId: 'player-two',
    instanceId: state.players['player-two'].hand.find(
      (card) => card.type === 'item',
    )!.instanceId,
  })
  advanceTo('player-one', 'active')

  // 回合三（玩家一）：攻擊對手起始餅乾。
  advanceTo('player-one', 'main')
  apply({
    kind: 'attack',
    playerId: 'player-one',
    attackerInstanceId:
      state.players['player-one'].battleArea[0].card.instanceId,
    targetInstanceId: 'two-starter',
    supportPaymentIds: [supportCard.instanceId],
  })

  return { finalState: state, commands }
}

describe('黃金重播', () => {
  it('固定種子 + 指令序列可重播出完全相同的終局狀態', () => {
    const { finalState, commands } = playScriptedMatch()

    const replayed = replayCommands(createInitialState(), commands, {
      shuffle: createSeededShuffle(REPLAY_SEED),
    })

    expect(JSON.stringify(replayed)).toBe(JSON.stringify(finalState))
  })

  it('commandLog 可完整還原指令序列並重播出相同終局', () => {
    const { finalState, commands } = playScriptedMatch()

    expect(finalState.commandLog).toHaveLength(commands.length)
    expect(
      finalState.commandLog?.map((entry) => commandFromLogEntry(entry).kind),
    ).toEqual(commands.map((command) => command.kind))

    const replayed = replayCommandLog(
      createInitialState(),
      finalState.commandLog ?? [],
      { shuffle: createSeededShuffle(REPLAY_SEED) },
    )

    expect(JSON.stringify(replayed)).toBe(JSON.stringify(finalState))
  })

  it('對局過程確實產生了戰鬥與支付紀錄', () => {
    const { finalState } = playScriptedMatch()

    expect(finalState.status).toBe('playing')
    expect(finalState.turnNumber).toBe(3)
    expect(
      finalState.commandLog?.some((entry) => entry.commandKind === 'attack'),
    ).toBe(true)
    // 攻擊造成 1 點傷害：對手起始餅乾的 HP 卡應少 1 張。
    const defender = finalState.players['player-two'].battleArea.find(
      (cookie) => cookie.card.instanceId === 'two-starter',
    )
    expect(defender?.hpCards).toHaveLength(2)
  })
})
