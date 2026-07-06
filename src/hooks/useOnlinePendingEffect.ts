import { useEffect, useState } from 'react'
import {
  canActivateCookieSkill,
  canPlayItem,
  canActivateStage,
  getEffectTargetCandidates,
  getTrashBattleCookieCostCandidates,
  isEffectUntargeted,
  selectEnergyPayment,
  type CardAbility,
  type CardSkill,
  type EffectContext,
  type GameCard,
  type GameState,
  type PlayerId,
} from '../game'
import type { DispatchGameCommand } from './useBattleActions'
import type { PendingEffect } from '../components/effects/effectUiTypes'

const findCardByInstanceId = (
  game: GameState,
  instanceId: string,
): GameCard | undefined => {
  for (const player of Object.values(game.players)) {
    const battleCard = player.battleArea.find(
      (cookie) => cookie.card.instanceId === instanceId,
    )?.card
    if (battleCard) return battleCard
    const handCard = player.hand.find((card) => card.instanceId === instanceId)
    if (handCard) return handCard
    if (player.stage?.card.instanceId === instanceId) return player.stage.card
  }
  return undefined
}

/**
 * 線上對戰版的技能/道具/場景卡效果解析。與本地 usePendingEffect 的差異:
 *
 * 1. 代價支付改成自動計算(比照既有 selectEnergyPayment/攻擊付款的自動選取
 *    邏輯,並非新規則),不提供手動選擇要用哪幾張支援卡付款的精靈 UI——
 *    線上模式沒有同步結果可以即時驗證每一步選擇是否合法,把「決定要不要
 *    發動」跟「怎麼付款」黏在一起會需要伺服器來回確認,MVP 階段先簡化掉。
 * 2. 效果目標選擇改成從 GameState.pendingAbilityEffect / pendingBattle
 *    (M0 已經是權威狀態)直接推導,而不是本地維護 effectIndex/suspendedEffect
 *    ——伺服器才是「現在是第幾個效果」的真相來源,中途暫停恢復也自然正確
 *    (該欄位在其他待處理決策清空前就是保持不變)。
 * 3. 目前只支援「一般目標選擇」（target: EffectTargetSelector 的效果，如
 *    damage/gain-hp/modify-attack/prevent-knockout/redirect-attack/
 *    view-hp/disable-block 等）；break-to-trash、support-to-trash/hand、
 *    trash-to-*、flip-to-support、field-to-trash、inspect-deck 等需要
 *    專屬候選清單的效果類型,目前會以空目標送出(已知的縮小範圍,留待後續
 *    里程碑補齊,不影響大多數技能/道具/場景卡的基本目標選擇)。
 */
export function useOnlinePendingEffect(params: {
  game: GameState
  viewerPlayerId: PlayerId
  dispatch: DispatchGameCommand
  hasFaint: boolean
  hasAfterDamage: boolean
}) {
  const { game, viewerPlayerId, dispatch, hasFaint, hasAfterDamage } = params
  const [effectHistory, setEffectHistory] = useState<string[]>([])

  const pendingAbility = game.pendingAbilityEffect
  const abilityActiveForViewer = Boolean(
    pendingAbility && pendingAbility.playerId === viewerPlayerId,
  )

  const attackBattle = game.pendingBattle
  const attackEffectActive = Boolean(
    attackBattle?.stage === 'attack-effect' &&
      attackBattle.attackerPlayerId === viewerPlayerId,
  )

  const currentEffect = attackEffectActive
    ? (attackBattle!.attackEffects[attackBattle!.attackEffectIndex] ?? null)
    : abilityActiveForViewer
      ? (pendingAbility!.effects[pendingAbility!.effectIndex] ?? null)
      : null

  const context: EffectContext | null = attackEffectActive
    ? {
        sourcePlayerId: viewerPlayerId,
        sourceInstanceId: attackBattle!.attackerInstanceId,
      }
    : abilityActiveForViewer
      ? {
          sourcePlayerId: pendingAbility!.sourcePlayerId,
          sourceInstanceId: pendingAbility!.sourceInstanceId,
          sourceCardName: pendingAbility!.sourceCardName,
        }
      : null

  const currentTargetSelector =
    currentEffect && context && !isEffectUntargeted(currentEffect)
      ? ('target' in currentEffect ? currentEffect.target : null)
      : null

  const candidateCards: GameCard[] =
    context && currentTargetSelector
      ? getEffectTargetCandidates(game, context, currentTargetSelector).map(
          (candidate) => candidate.card,
        )
      : []

  const effectKey = attackEffectActive
    ? `attack:${attackBattle?.attackEffectIndex}`
    : abilityActiveForViewer
      ? `ability:${pendingAbility?.effectIndex}`
      : 'none'

  const [selectedTargetState, setSelectedTargetState] = useState<{
    key: string
    ids: string[]
  }>({ key: effectKey, ids: [] })
  const selectedTargetIds =
    selectedTargetState.key === effectKey ? selectedTargetState.ids : []

  const toggleTarget = (instanceId: string) => {
    const max = currentTargetSelector?.max ?? 1
    setSelectedTargetState((currentState) => {
      const current =
        currentState.key === effectKey ? currentState.ids : []
      if (current.includes(instanceId)) {
        return {
          key: effectKey,
          ids: current.filter((id) => id !== instanceId),
        }
      }
      if (max <= 1) return { key: effectKey, ids: [instanceId] }
      if (current.length >= max) return { key: effectKey, ids: current }
      return { key: effectKey, ids: [...current, instanceId] }
    })
  }

  const confirmEffect = () => {
    if (!currentEffect || !context) return
    if (attackEffectActive) {
      dispatch(
        {
          kind: 'resolve-attack-effect',
          playerId: viewerPlayerId,
          targetIds: selectedTargetIds,
        },
        '已決定攻擊後續效果的目標。',
      )
    } else if (abilityActiveForViewer) {
      dispatch(
        {
          kind: 'resolve-ability-effect',
          playerId: viewerPlayerId,
          targetIds: selectedTargetIds,
        },
        '已決定效果目標。',
      )
    }
    setEffectHistory((history) => [
      `${context.sourceCardName ?? '效果'}已結算。`,
      ...history,
    ].slice(0, 4))
  }

  const skipOnPlay = (sourceInstanceId: string) => {
    dispatch(
      { kind: 'skip-on-play', playerId: viewerPlayerId, sourceInstanceId },
      '未發動 OnPlay 技能。',
    )
  }

  const beginCookieSkill = (
    card: GameCard,
    trigger: 'activate' | 'on-play',
  ) => {
    if (!card.skill || card.skill.trigger !== trigger) return
    if (!canActivateCookieSkill(game, viewerPlayerId, card.instanceId, trigger)) {
      if (trigger === 'on-play' && game.pendingOnPlay) {
        skipOnPlay(card.instanceId)
      }
      return
    }
    const cost = card.skill.cost
    const paymentIds = selectEnergyPayment(
      cost.energy ?? cost,
      game.players[viewerPlayerId].supportArea,
    )
    if (!paymentIds) {
      if (trigger === 'on-play' && game.pendingOnPlay) {
        skipOnPlay(card.instanceId)
      }
      return
    }
    dispatch(
      {
        kind: 'begin-activate-skill',
        playerId: viewerPlayerId,
        sourceInstanceId: card.instanceId,
        trigger,
        paymentIds,
        costSupportToTrashIds: autoPickSupportToTrash(
          game,
          viewerPlayerId,
          cost.supportToTrash,
          paymentIds,
        ),
        discardHandIds: autoPickDiscardHand(
          game,
          viewerPlayerId,
          cost.discardHand,
          cost.discardHandColor,
          card.instanceId,
        ),
        trashBattleCookieIds: autoPickTrashBattleCookie(game, viewerPlayerId, cost),
      },
      `${card.name}已發動技能。`,
    )
  }

  // 補位(refresh-deck/replace-cookie)完成後若觸發 OnPlay 技能,伺服器送來的
  // 下一份遮罩狀態會帶著 pendingOnPlay——用這個 effect 主動觸發技能精靈,
  // 取代本地版本仰賴 onSuccess 同步拿到 nextGame 的做法(線上沒有同步結果)。
  useEffect(() => {
    const onPlay = game.pendingOnPlay
    if (!onPlay || onPlay.playerId !== viewerPlayerId) return
    const card = game.players[onPlay.playerId].battleArea.find(
      (cookie) => cookie.card.instanceId === onPlay.sourceInstanceId,
    )?.card
    if (card) beginCookieSkill(card, 'on-play')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.pendingOnPlay])

  /** 本地版本仰賴同步拿到指令套用後的狀態才能檢查 OnPlay;線上模式已經有
   * 上面的 effect 主動處理,這裡維持相同呼叫介面但不需要做任何事。 */
  const handleOnPlayTrigger: (state: GameState) => void = () => {}

  const beginPlayItem = (card: GameCard) => {
    if (!card.item || !canPlayItem(game, viewerPlayerId, card.instanceId)) return
    const cost = card.item.cost
    const paymentIds = selectEnergyPayment(
      cost.energy ?? cost,
      game.players[viewerPlayerId].supportArea,
    )
    if (!paymentIds) return
    dispatch(
      {
        kind: 'begin-play-item',
        playerId: viewerPlayerId,
        instanceId: card.instanceId,
        paymentIds,
        supportToTrashIds: autoPickSupportToTrash(
          game,
          viewerPlayerId,
          cost.supportToTrash,
          paymentIds,
        ),
        discardHandIds: autoPickDiscardHand(
          game,
          viewerPlayerId,
          cost.discardHand,
          cost.discardHandColor,
          card.instanceId,
        ),
      },
      `已使用${card.name}。`,
    )
  }

  const beginActivateStage = () => {
    const stage = game.players[viewerPlayerId].stage
    const ability = stage?.card.stageAbility
    if (!stage || !ability || !canActivateStage(game, viewerPlayerId)) return
    const cost = ability.cost
    const paymentIds = selectEnergyPayment(
      cost.energy ?? cost,
      game.players[viewerPlayerId].supportArea,
    )
    if (!paymentIds) return
    dispatch(
      {
        kind: 'begin-activate-stage',
        playerId: viewerPlayerId,
        paymentIds,
        supportToTrashIds: autoPickSupportToTrash(
          game,
          viewerPlayerId,
          cost.supportToTrash,
          paymentIds,
        ),
        discardHandIds: autoPickDiscardHand(
          game,
          viewerPlayerId,
          cost.discardHand,
          cost.discardHandColor,
          undefined,
        ),
      },
      `${stage.card.name}已發動場景效果。`,
    )
  }

  const isEffectPending = Boolean(currentEffect)

  /**
   * 建構與本地 usePendingEffect 相容的 PendingEffect 物件,讓 EffectPanel
   * 元件能原樣重用。因為代價已經在 begin-* 指令送出前自動付清(見上方
   * 檔案註解),這裡固定 skillActivated:true,EffectPanel 會自動跳過整個
   * 代價選擇 UI、直接顯示目標選擇畫面。
   */
  const pendingEffectView: PendingEffect | null =
    currentEffect && context
      ? {
          sourceCard:
            findCardByInstanceId(game, context.sourceInstanceId) ?? {
              id: 'unknown',
              instanceId: context.sourceInstanceId,
              name: context.sourceCardName ?? '效果來源',
              type: 'item',
            },
          context,
          skill: attackEffectActive
            ? ({
                trigger: 'activate',
                oncePerTurn: false,
                yourTurn: true,
                restSource: false,
                cost: {},
                text: '',
                effects: attackBattle?.attackEffects ?? [],
              } satisfies CardSkill)
            : ({
                trigger:
                  pendingAbility?.trigger === 'on-play' ? 'on-play' : 'activate',
                oncePerTurn: false,
                yourTurn: true,
                restSource: false,
                cost: {},
                text: '',
                effects: pendingAbility?.effects ?? [],
              } satisfies CardSkill),
          trigger: attackEffectActive
            ? 'activate'
            : (pendingAbility?.trigger ?? 'activate'),
          effects: attackEffectActive
            ? (attackBattle?.attackEffects ?? [])
            : (pendingAbility?.effects ?? []),
          effectIndex: attackEffectActive
            ? (attackBattle?.attackEffectIndex ?? 0)
            : (pendingAbility?.effectIndex ?? 0),
          selectedTargetIds,
          selectedPaymentIds: [],
          selectedCostSupportToTrashIds: [],
          selectedDiscardHandIds: [],
          selectedTrashBattleCookieIds: [],
          skillActivated: true,
          optional: false,
          triggerLabel: attackEffectActive
            ? '攻擊後續效果'
            : pendingAbility?.sourceKind === 'item'
              ? '使用物品'
              : pendingAbility?.sourceKind === 'stage'
                ? '啟動場景'
                : pendingAbility?.trigger === 'on-play'
                  ? 'OnPlay 登場觸發'
                  : 'Activate 主動發動',
          sourceKind: attackEffectActive
            ? 'attack'
            : pendingAbility?.sourceKind === 'item'
              ? 'item'
              : pendingAbility?.sourceKind === 'stage'
                ? 'stage'
                : 'cookie',
        }
      : null

  return {
    currentEffect,
    candidateCards,
    selectedTargetIds,
    toggleTarget,
    confirmEffect,
    beginCookieSkill,
    handleOnPlayTrigger,
    beginPlayItem,
    beginActivateStage,
    skipOnPlay,
    effectHistory,
    isEffectPending,
    // 與本地 usePendingEffect 對齊的欄位名,讓 EffectPanel/BattleResponseModals/
    // DamageEffectModals/PendingDecisionModals 能原樣重用。
    pendingEffect: pendingEffectView,
    faintActive: hasFaint && !isEffectPending,
    afterDamageActive: hasAfterDamage && !isEffectPending,
  } as const
}

const autoPickSupportToTrash = (
  game: GameState,
  playerId: PlayerId,
  count: number | undefined,
  excludeIds: string[],
): string[] => {
  if (!count) return []
  return game.players[playerId].supportArea
    .filter((support) => !excludeIds.includes(support.card.instanceId))
    .slice(0, count)
    .map((support) => support.card.instanceId)
}

const autoPickDiscardHand = (
  game: GameState,
  playerId: PlayerId,
  count: number | undefined,
  color: string | undefined,
  excludeInstanceId: string | undefined,
): string[] => {
  if (!count) return []
  return game.players[playerId].hand
    .filter(
      (card) =>
        card.instanceId !== excludeInstanceId &&
        (!color || card.energyColor === color),
    )
    .slice(0, count)
    .map((card) => card.instanceId)
}

const autoPickTrashBattleCookie = (
  game: GameState,
  playerId: PlayerId,
  cost: CardAbility['cost'],
): string[] => {
  const count = cost.trashBattleCookie?.count
  if (!count) return []
  return getTrashBattleCookieCostCandidates(
    cost,
    game.players[playerId].battleArea,
  )
    .slice(0, count)
    .map((cookie) => cookie.card.instanceId)
}
