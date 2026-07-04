import type { GameCommand } from './commands'
import type { GameState, PlayerId } from './types'

const playerName = (state: GameState, playerId: PlayerId): string =>
  state.players[playerId]?.name ?? playerId

const findCardName = (state: GameState, instanceId: string): string => {
  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    const player = state.players[playerId]
    const zones = [
      player.hand,
      player.deck,
      player.breakArea,
      player.discardPile,
      ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards]),
      ...player.supportArea.map((entry) => entry.card),
    ]
    for (const zone of zones) {
      const list = Array.isArray(zone) ? zone : [zone]
      const found = list.find((card) => card.instanceId === instanceId)
      if (found) return found.name
    }
    if (player.stage?.card.instanceId === instanceId) {
      return player.stage.card.name
    }
  }
  return '未知卡牌'
}

export const describeCommand = (
  state: GameState,
  command: GameCommand,
): string => {
  const actor = playerName(state, command.playerId)

  switch (command.kind) {
    case 'attack':
      return `${actor} 使用「${findCardName(state, command.attackerInstanceId)}」攻擊「${findCardName(state, command.targetInstanceId)}」`
    case 'deploy-cookie':
      return `${actor} 部署了「${findCardName(state, command.instanceId)}」`
    case 'place-support':
      return `${actor} 放置了支援卡「${findCardName(state, command.instanceId)}」`
    case 'play-item':
      return `${actor} 使用了道具卡「${findCardName(state, command.instanceId)}」`
    case 'play-stage':
      return `${actor} 打出了場景卡「${findCardName(state, command.instanceId)}」`
    case 'activate-stage':
      return `${actor} 發動了場景效果`
    case 'play-trap':
      return `${actor} 設置了陷阱卡「${findCardName(state, command.trapInstanceId)}」`
    case 'skip-trap':
      return `${actor} 選擇不發動陷阱`
    case 'play-blocker':
      return `${actor} 使用了阻擋卡「${findCardName(state, command.sourceInstanceId)}」`
    case 'activate-skill':
      return `${actor} 發動了「${findCardName(state, command.sourceInstanceId)}」的技能`
    case 'skip-on-play':
      return `${actor} 選擇不發動「${findCardName(state, command.sourceInstanceId)}」的登場效果`
    case 'replace-cookie':
      return `${actor} 補位了「${findCardName(state, command.instanceId)}」`
    case 'skip-replacement':
      return `${actor} 選擇不補位`
    case 'refresh-deck':
      return `${actor} 讓「${findCardName(state, command.cookieInstanceId)}」進行調度`
    case 'advance-phase':
      return `${actor} 推進了階段`
    case 'select-starting-cookie':
      return `${actor} 選擇了先發餅乾「${findCardName(state, command.instanceId)}」`
    case 'keep-opening-hand':
      return `${actor} 保留了起始手牌`
    case 'mulligan-opening-hand':
      return `${actor} 重新抽取了起始手牌`
    case 'force-mulligan-opening-hand':
      return `${actor} 被要求重新抽取起始手牌`
    case 'draw-mulligan-compensation':
      return `${actor} 抽取了補償手牌`
    case 'resolve-flip':
      return command.activate
        ? `${actor} 發動了翻面效果`
        : `${actor} 選擇不發動翻面效果`
    case 'resolve-attack-effect':
      return `${actor} 決定了攻擊效果的目標`
    case 'resolve-next-damage':
      return `${actor} 結算了下一段傷害`
    case 'resolve-battle':
      return `${actor} 自動結算了戰鬥`
    case 'resolve-faint-effect':
      return `${actor} 決定了擊倒效果的目標`
    case 'resolve-opponent-hand-discard':
      return `${actor} 選擇了要棄掉的手牌`
    case 'resolve-inspect-deck':
      return `${actor} 決定了檢視牌庫的結果`
    case 'resolve-optional-cost-attack':
      return command.action === 'pay'
        ? `${actor} 支付了額外代價`
        : `${actor} 選擇不支付額外代價`
    case 'resolve-draw-up-to':
      return `${actor} 抽了 ${command.drawCount} 張牌`
    case 'resolve-stage-trigger':
      return command.action === 'activate'
        ? `${actor} 發動了場景觸發效果`
        : `${actor} 選擇不發動場景觸發效果`
    case 'resolve-after-damage-effect':
      return `${actor} 決定了傷害後效果的目標`
    case 'resolve-effect-order':
      return `${actor} 決定了效果的結算順序`
    default:
      return `${actor} 執行了 ${(command as GameCommand).kind}`
  }
}
