import { applyGameCommand } from '../commands'
import type { PlayerActionCommand } from '../commands'
import { getLegalTurnCommands } from '../legal-actions'
import type { GameState, PlayerId } from '../types'
import type { AiActionType, AiDecision } from './types'

export const commandActionTypes: Record<
  PlayerActionCommand['kind'],
  AiActionType
> = {
  'keep-opening-hand': 'idle',
  'mulligan-opening-hand': 'idle',
  'force-mulligan-opening-hand': 'idle',
  'draw-mulligan-compensation': 'idle',
  'select-starting-cookie': 'idle',
  'advance-phase': 'advance-phase',
  'place-support': 'place-support',
  'deploy-cookie': 'deploy-cookie',
  attack: 'attack',
  'declare-attack': 'attack',
  'activate-skill': 'activate-skill',
  'begin-activate-skill': 'activate-skill',
  'skip-on-play': 'idle',
  'play-item': 'play-item',
  'begin-play-item': 'play-item',
  'play-stage': 'play-stage',
  'activate-stage': 'activate-stage',
  'begin-activate-stage': 'activate-stage',
  'resolve-ability-effect': 'idle',
  'replace-cookie': 'replace-cookie',
  'skip-replacement': 'skip-replacement',
  'refresh-deck': 'refresh',
  'play-trap': 'play-trap',
  'skip-trap': 'idle',
  'play-blocker': 'play-blocker',
  'resolve-flip': 'resolve-flip',
  'resolve-attack-effect': 'resolve-attack-effect',
  'resolve-next-damage': 'resolve-damage',
  'resolve-battle': 'resolve-damage',
}

const findCardName = (state: GameState, instanceId: string): string => {
  for (const playerId of ['player-one', 'player-two'] as PlayerId[]) {
    const player = state.players[playerId]
    const found =
      player.hand.find((card) => card.instanceId === instanceId) ??
      player.battleArea.find(
        (cookie) => cookie.card.instanceId === instanceId,
      )?.card
    if (found) return found.name
  }
  return instanceId
}

export const describeCommand = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): string => {
  const name = state.players[playerId].name
  switch (command.kind) {
    case 'advance-phase':
      return `${name}推進回合階段。`
    case 'place-support':
      return `${name}將${findCardName(state, command.instanceId)}配置到支援區。`
    case 'deploy-cookie':
      return `${name}讓${findCardName(state, command.instanceId)}登場。`
    case 'attack':
      return `${name}以${findCardName(state, command.attackerInstanceId)}攻擊${findCardName(state, command.targetInstanceId)}。`
    case 'play-stage':
      return `${name}放置${findCardName(state, command.instanceId)}。`
    case 'refresh-deck':
      return `${name}使用${findCardName(state, command.cookieInstanceId)}完成 Refresh。`
    case 'replace-cookie':
      return `${name}補充${findCardName(state, command.instanceId)}到戰鬥區。`
    case 'skip-replacement':
      return `${name}選擇不補餅乾。`
    case 'skip-on-play':
      return `${name}未發動登場效果。`
    default:
      return `${name}執行${command.kind}。`
  }
}

/**
 * Lv.1 隨機 AI：從合法動作指令中以注入的亂數均勻挑選一個執行。
 * 不主動使用技能、物品與 OnPlay（一律略過），戰鬥回應與待處理
 * 決策仍由共用 handler 處理。
 */
export const handleAiRandomTurnState = (
  state: GameState,
  playerId: PlayerId,
  random: () => number,
): AiDecision => {
  const commands = getLegalTurnCommands(state, playerId)

  if (commands.length === 0) {
    return {
      state,
      action: 'idle',
      description: `${state.players[playerId].name}等待行動。`,
      reason: { level: 1, consideredCommands: 0 },
    }
  }

  const supportCommand = commands.find(
    (command) => command.kind === 'place-support',
  )
  if (state.phase === 'support' && supportCommand) {
    const nextState = applyGameCommand(state, supportCommand)
    return {
      state: nextState,
      action: commandActionTypes[supportCommand.kind],
      description: describeCommand(state, playerId, supportCommand),
      reason: {
        level: 1,
        consideredCommands: commands.length,
        chosenCommandKind: supportCommand.kind,
      },
    }
  }

  const index = Math.min(
    Math.floor(random() * commands.length),
    commands.length - 1,
  )
  const command = commands[index]
  const nextState = applyGameCommand(state, command)

  return {
    state: nextState,
    action: commandActionTypes[command.kind],
    description: describeCommand(state, playerId, command),
    reason: {
      level: 1,
      consideredCommands: commands.length,
      chosenCommandKind: command.kind,
    },
  }
}
