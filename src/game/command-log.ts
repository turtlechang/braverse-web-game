import { getOpponentId } from './helpers'
import type { GameCommand } from './commands'
import type { GameState, LogCategory, PlayerId } from './types'

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
  previous: GameState,
  next: GameState,
  command: GameCommand,
): string => {
  const state = previous
  const actor = playerName(state, command.playerId)

  switch (command.kind) {
    case 'attack':
    case 'declare-attack':
      return `${actor} 使用「${findCardName(state, command.attackerInstanceId)}」攻擊「${findCardName(state, command.targetInstanceId)}」`
    case 'deploy-cookie':
      return `${actor} 部署了「${findCardName(state, command.instanceId)}」`
    case 'place-support':
      return `${actor} 放置了支援卡「${findCardName(state, command.instanceId)}」`
    case 'play-item':
    case 'begin-play-item':
      return `${actor} 使用了道具卡「${findCardName(state, command.instanceId)}」`
    case 'play-stage':
      return `${actor} 打出了場景卡「${findCardName(state, command.instanceId)}」`
    case 'activate-stage':
    case 'begin-activate-stage':
      return `${actor} 發動了場景效果`
    case 'play-trap':
      return `${actor} 設置了陷阱卡「${findCardName(state, command.trapInstanceId)}」`
    case 'skip-trap':
      return `${actor} 選擇不發動陷阱`
    case 'play-blocker':
      return `${actor} 使用了阻擋卡「${findCardName(state, command.sourceInstanceId)}」`
    case 'activate-skill':
    case 'begin-activate-skill':
      return `${actor} 發動了「${findCardName(state, command.sourceInstanceId)}」的技能`
    case 'resolve-ability-effect':
      return `${actor} 決定了效果的目標`
    case 'skip-on-play':
      return `${actor} 選擇不發動「${findCardName(state, command.sourceInstanceId)}」的登場效果`
    case 'replace-cookie':
      return `${actor} 補位了「${findCardName(state, command.instanceId)}」`
    case 'skip-replacement':
      return `${actor} 選擇不補位`
    case 'refresh-deck':
      return `${actor} 讓「${findCardName(state, command.cookieInstanceId)}」進行調度`
    case 'advance-phase': {
      const drawnCount =
        next.players[command.playerId].hand.length -
        previous.players[command.playerId].hand.length
      return drawnCount > 0
        ? `${actor} 抽了 ${drawnCount} 張牌`
        : `${actor} 推進了階段`
    }
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

/**
 * commandKind -> 對戰紀錄分類，供 UI 篩選 chip 使用。用 `Record<GameCommand['kind'], LogCategory>`
 * （不是 `Partial`）讓 TS 強制窮舉——未來新增 commandKind 忘記歸類會直接編譯失敗。
 */
export const LOG_CATEGORY_BY_COMMAND_KIND: Record<GameCommand['kind'], LogCategory> = {
  'keep-opening-hand': 'system',
  'mulligan-opening-hand': 'system',
  'force-mulligan-opening-hand': 'system',
  'draw-mulligan-compensation': 'draw',
  'select-starting-cookie': 'deploy',

  // advance-phase 若偵測到抽牌，由 resolveLogCategory 覆寫成 'draw'。
  'advance-phase': 'phase',

  'place-support': 'deploy',
  'deploy-cookie': 'deploy',
  'play-stage': 'deploy',
  'replace-cookie': 'deploy',
  'skip-replacement': 'system',
  'refresh-deck': 'system',

  attack: 'attack',
  'declare-attack': 'attack',
  'resolve-optional-cost-attack': 'attack',
  'resolve-attack-effect': 'attack',
  'resolve-next-damage': 'damage',
  'resolve-battle': 'attack',
  'resolve-after-damage-effect': 'damage',
  'resolve-faint-effect': 'activate',
  'resolve-flip': 'flip',

  'play-trap': 'activate',
  'skip-trap': 'system',
  'play-blocker': 'activate',

  'activate-skill': 'activate',
  'begin-activate-skill': 'activate',
  'skip-on-play': 'system',
  'play-item': 'activate',
  'begin-play-item': 'activate',
  'activate-stage': 'activate',
  'begin-activate-stage': 'activate',
  'resolve-ability-effect': 'activate',
  'resolve-choose-one': 'activate',
  'resolve-opponent-hand-discard': 'activate',
  'resolve-inspect-deck': 'activate',
  'resolve-reveal-top-deck': 'activate',
  'resolve-draw-up-to': 'draw',
  'resolve-stage-trigger': 'activate',
  'resolve-effect-order': 'system',
}

export const resolveLogCategory = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): LogCategory => {
  if (command.kind === 'advance-phase') {
    const drawnCount =
      next.players[command.playerId].hand.length -
      previous.players[command.playerId].hand.length
    if (drawnCount > 0) return 'draw'
  }
  return LOG_CATEGORY_BY_COMMAND_KIND[command.kind]
}

const describePaymentStep = (paymentIds: string[]): string =>
  `支付代價：橫置 ${paymentIds.length} 張支援卡`

const describeTargetNamesStep = (
  state: GameState,
  label: string,
  targetIds: string[] | undefined,
): string | undefined =>
  targetIds && targetIds.length > 0
    ? `${label}：${targetIds.map((id) => findCardName(state, id)).join('、')}`
    : undefined

const describeEffectTargetsSteps = (
  state: GameState,
  effectTargets: string[][] | undefined,
): string[] =>
  (effectTargets ?? [])
    .map((targetIds, index) =>
      targetIds.length > 0
        ? `第 ${index + 1} 個效果目標：${targetIds.map((id) => findCardName(state, id)).join('、')}`
        : undefined,
    )
    .filter((step): step is string => step !== undefined)

const describeChooseOneSteps = (chooseOneModes: number[] | undefined): string[] =>
  (chooseOneModes ?? []).map(
    (modeIndex, index) => `第 ${index + 1} 個「選擇一項」效果：選了第 ${modeIndex + 1} 個選項`,
  )

/**
 * 針對「單筆 entry 但 payload 已經帶齊所有子步驟資料」的批次指令，合成逐步驟文字給 UI
 * 展開用。其餘 kind（例如互動式的 begin-* 系列，步驟本來就分散在多筆各自的 log entry
 * 裡）回傳 undefined，UI 端改用同一個 groupId 底下其他 entry 的 summary 當步驟。
 */
export const describeCommandSteps = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): string[] | undefined => {
  const state = previous

  switch (command.kind) {
    case 'play-trap': {
      const steps = [describePaymentStep(command.paymentIds)]
      const targetStep = describeTargetNamesStep(state, '選擇目標', command.targetIds)
      if (targetStep) steps.push(targetStep)
      const selfTargetStep = describeTargetNamesStep(
        state,
        '選擇自身目標',
        command.selfTargetIds,
      )
      if (selfTargetStep) steps.push(selfTargetStep)
      return steps
    }
    case 'activate-skill':
    case 'play-item':
    case 'activate-stage': {
      const steps = [describePaymentStep(command.paymentIds)]
      steps.push(...describeEffectTargetsSteps(state, command.effectTargets))
      steps.push(...describeChooseOneSteps(command.chooseOneModes))
      return steps
    }
    case 'attack': {
      const opponentId = getOpponentId(command.playerId)
      const targetBefore = previous.players[opponentId].battleArea.find(
        (cookie) => cookie.card.instanceId === command.targetInstanceId,
      )
      const targetAfter = next.players[opponentId].battleArea.find(
        (cookie) => cookie.card.instanceId === command.targetInstanceId,
      )
      const hpBefore = targetBefore?.hpCards.length ?? 0
      const hpAfter = targetAfter?.hpCards.length ?? 0
      const damage = Math.max(0, hpBefore - hpAfter)
      const outcome =
        hpBefore > 0 && hpAfter === 0
          ? `擊倒「${findCardName(state, command.targetInstanceId)}」`
          : damage > 0
            ? `造成 ${damage} 點傷害`
            : '未造成傷害'
      return [
        `宣告攻擊：「${findCardName(state, command.attackerInstanceId)}」→「${findCardName(state, command.targetInstanceId)}」`,
        `自動結算戰鬥，${outcome}`,
      ]
    }
    default:
      return undefined
  }
}
