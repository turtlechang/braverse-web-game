import {
  getBreakCount,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getEnergyCostTotal,
  getRemainingEnergyCost,
  getHpToTrashCostCandidates,
  getTrashToDeckCostCandidates,
  isEffectConditionMet,
  isEnergyColorCompatibleWithCost,
  requiresEffectCardSelection,
  selectEnergyPayment,
  type CardEffect,
  type EnergyCost,
  type GameCard,
  type GameState,
  type PlayerId,
} from '../../game'
import { energyColorLabel } from '../gameUiLabels'

export interface OptionalCostAttackPromptData {
  sourceCard?: GameCard
  sourceCardName: string
  effectText: string
  discardHandCost: number
  supportToHandCost: number
  hpToTrashCost: number
  hpToTrashCandidates: { card: GameCard; instanceId: string }[]
  trashToDeckCost: number
  trashToDeckCandidates: { card: GameCard; instanceId: string }[]
  energyCostTotal: number
  playerHand: GameCard[]
  supportCandidates: { card: GameCard; instanceId: string }[]
  supportToHandCandidates: { card: GameCard; instanceId: string }[]
  targetCandidates: { card: GameCard; instanceId: string }[]
  needsTarget: boolean
  targetMin: number
  targetMax: number
  targetLabel: string
  /**
   * 目標若不是一般「餅乾／支援區卡」格式，提供完整的選取說明。
   * 例如 BS6-051 必須明確告知玩家從自己的手牌選綠色卡牌。
   */
  targetInstruction?: string
  /**
   * 代價的完整說明文字。含來源餅乾自付的能量（BS3-076「Use this Cookie as
   * {B}」這類寫法）——這部分不會出現在 `energyCostTotal`（那是扣掉來源能量後
   * 「還要從支援區付」的張數），少了它玩家會看到一個空白的「代價：」。
   */
  costText: string
  /**
   * 子效果的 condition 目前不成立時的提示文字。跟陷阱的
   * getUnmetTrapConditionWarning 同一套邏輯：resolveOptionalCostAttack
   * 本來就會用 isEffectConditionMet 過濾掉條件不成立的子效果（不會拋錯），
   * 但玩家付款前完全看不到任何說明，只會覺得「付了代價卻什麼事都沒發生」。
   */
  unmetConditionWarning: string | null
  /** 支援區沒有足夠的合法能量支付剩餘代價時的明確提示。 */
  paymentUnavailableWarning: string | null
}

const getUnmetConditionWarning = (
  game: GameState,
  viewerPlayerId: PlayerId,
  sourceInstanceId: string,
  effects: CardEffect[],
): string | null => {
  const context = { sourcePlayerId: viewerPlayerId, sourceInstanceId }
  for (const effect of effects) {
    if (effect.kind === 'damage-by-break-count' || effect.kind === 'modify-attack-by-break-count') {
      if (getBreakCount(game, viewerPlayerId, effect) <= 0) {
        return effect.kind === 'damage-by-break-count'
          ? '目前休息區沒有符合條件的餅乾，這個效果將不會造成任何傷害。'
          : '目前休息區沒有符合條件的餅乾，這個效果不會改變攻擊力。'
      }
      continue
    }
    if ('condition' in effect && effect.condition && !isEffectConditionMet(game, context, effect)) {
      return '目前條件不成立，確認後會略過此效果。'
    }
  }
  return null
}

/**
 * 代價說明文字。能量要標出顏色——只寫「支付 N 張能量支援卡」玩家不知道該挑
 * 哪一色，得回頭看卡面英文。
 */
const describeCost = (
  remainingEnergy: EnergyCost,
  discardHandCost: number,
  supportToHandCost: number,
  hpToTrashCost: number,
  trashToDeckCost: number,
): string => {
  const parts: string[] = []

  const energyParts = (Object.keys(remainingEnergy) as (keyof EnergyCost)[])
    .filter((key) => (remainingEnergy[key] ?? 0) > 0)
    .map(
      (key) =>
        `${remainingEnergy[key]} 點${energyColorLabel[key] ?? String(key)}能量`,
    )
  if (energyParts.length > 0) {
    parts.push(`支付支援區 ${energyParts.join('、')}`)
  }
  if (discardHandCost > 0) parts.push(`棄置 ${discardHandCost} 張手牌`)
  if (supportToHandCost > 0) {
    parts.push(`將 ${supportToHandCost} 張支援區卡返回手牌`)
  }
  if (hpToTrashCost > 0) parts.push(`棄置 ${hpToTrashCost} 張餅乾的 HP 卡`)
  if (trashToDeckCost > 0) {
    parts.push(`將 ${trashToDeckCost} 張棄牌區卡洗回牌庫`)
  }

  return parts.length > 0 ? parts.join('、') : '無'
}

/**
 * 攻擊後代價的目標要依「支付代價後」的區域判定。
 *
 * BS6-096 會先把來源餅乾放入棄牌區，再從棄牌區登場 LV.1 紫色餅乾。
 * 當己方戰鬥區已經有兩張餅乾時，若直接用目前 state 找候選，
 * `getTrashCookieCandidates` 會因戰鬥區已滿而回傳空陣列，讓支付按鈕被
 * UI 錯誤地停用。規則引擎在實際結算時本來就先支付來源代價再驗證目標，
 * 這裡只建立同樣的唯讀投影供提示框使用，不會改動正式 GameState。
 */
const getTargetSelectionState = (
  game: GameState,
  viewerPlayerId: PlayerId,
  sourceInstanceId: string,
  targetedEffect: CardEffect | undefined,
  cost: EnergyCost & {
    selfToTrash?: boolean
    selfToBreakArea?: boolean
  },
): GameState => {
  const projectsTrashToBattle =
    cost.selfToTrash === true && targetedEffect?.kind === 'trash-to-battle'
  const projectsBreakToBattle =
    cost.selfToBreakArea === true && targetedEffect?.kind === 'break-to-battle'
  if (!projectsTrashToBattle && !projectsBreakToBattle) return game

  const player = game.players[viewerPlayerId]
  const source = player.battleArea.find(
    (cookie) => cookie.card.instanceId === sourceInstanceId,
  )
  if (!source) return game

  const sourceCards = [
    source.card,
    ...source.hpCards,
    ...(source.equippedCards ?? []),
  ]
  return {
    ...game,
    players: {
      ...game.players,
      [viewerPlayerId]: {
        ...player,
        battleArea: player.battleArea.filter(
          (cookie) => cookie.card.instanceId !== sourceInstanceId,
        ),
        ...(projectsBreakToBattle
          ? { breakArea: [...player.breakArea, source.card] }
          : {}),
        discardPile: projectsTrashToBattle
          ? [...player.discardPile, ...sourceCards]
          : player.discardPile,
      },
    },
  }
}

export function getOptionalCostAttackPrompt(
  game: GameState,
  viewerPlayerId: PlayerId,
): OptionalCostAttackPromptData | null {
  const pending = game.pendingOptionalCostAttack
  if (!pending || pending.playerId !== viewerPlayerId) return null

  // A source-only battle-to-break effect is an automatic cost step (the
  // attacking Cookie itself), not the card the player is asked to choose.
  // Skip it so chained effects such as BS4-029 expose the following
  // break-to-battle candidate in the payment flow.
  const targetedEffect = pending.effects.find(
    (effect) =>
      requiresEffectCardSelection(effect) &&
      !(effect.kind === 'battle-to-break' && effect.target.sourceOnly),
  )
  const needsTarget = Boolean(targetedEffect)
  const targetSelectionState = getTargetSelectionState(
    game,
    viewerPlayerId,
    pending.sourceInstanceId,
    targetedEffect,
    pending.cost,
  )
  const targetCandidates = (
    targetedEffect
      ? getEffectSelectionCandidates(
          targetSelectionState,
          {
            sourcePlayerId: viewerPlayerId,
            sourceInstanceId: pending.sourceInstanceId,
          },
          targetedEffect,
        )
      : []
  ).map((card) => ({ card, instanceId: card.instanceId }))
  const selectionLimits = targetedEffect
    ? getEffectSelectionLimits(targetedEffect)
    : null
  const targetMin = selectionLimits?.min ?? 0
  const targetMax = selectionLimits?.max ?? 1
  const targetSelector =
    targetedEffect && 'target' in targetedEffect ? targetedEffect.target : undefined
  // rest-support 的目標是支援區的卡，不是餅乾；依照目標面給出正確標籤，
  // 避免把「對手的支援區卡」顯示成「對手餅乾」。
  const targetLabel =
    targetedEffect?.kind === 'hand-to-support'
      ? `自己的手牌中的${
          energyColorLabel[targetedEffect.energyColor ?? ''] ?? '符合條件的'
        }卡牌`
      : targetedEffect?.kind === 'rest-support'
      ? targetedEffect.side === 'self'
        ? '己方支援區的卡'
        : '對手支援區的卡'
      : targetedEffect?.kind === 'opponent-battle-to-trash'
        ? '對手餅乾'
        : targetedEffect?.kind === 'break-to-battle'
          ? '己方休息區餅乾'
          : targetedEffect?.kind === 'trash-to-battle'
            ? '己方棄牌區餅乾'
            : targetedEffect?.kind === 'trash-to-deck'
              ? '棄牌區卡牌'
          : targetSelector?.side === 'self'
          ? '己方餅乾'
          : '對手餅乾'

  const targetInstruction =
    targetedEffect?.kind === 'hand-to-support'
      ? `從自己的手牌選擇${targetMin === 0 ? '最多 ' : ''}${targetMax} 張${
          energyColorLabel[targetedEffect.energyColor ?? ''] ?? '符合條件的'
        }卡牌作為目標`
      : undefined

  const costEnergy = pending.cost.energy ?? ({} as EnergyCost)
  const energyCost = getRemainingEnergyCost(costEnergy, pending.sourceEnergy)
  const energyCostTotal = getEnergyCostTotal(energyCost)
  const discardHandCost = pending.cost.discardHand ?? 0
  const supportToHandCost = pending.cost.supportToHand ?? 0
  const hpToTrashCost = pending.cost.hpToTrash ? 1 : 0
  const hpToTrashCandidates = hpToTrashCost
    ? getHpToTrashCostCandidates(
        pending.cost,
        game.players[viewerPlayerId].battleArea,
        pending.sourceInstanceId,
      ).map((cookie) => ({ card: cookie.card, instanceId: cookie.card.instanceId }))
    : []
  const trashToDeckCost = pending.cost.trashToDeck?.count ?? 0
  const trashToDeckCandidates = trashToDeckCost
    ? getTrashToDeckCostCandidates(
        pending.cost,
        game.players[viewerPlayerId].discardPile,
      ).map((card) => ({ card, instanceId: card.instanceId }))
    : []
  const supportCandidates = energyCostTotal === 0
    ? []
    : game.players[viewerPlayerId].supportArea
    .filter((support) => !support.rested)
    .filter((support) =>
      isEnergyColorCompatibleWithCost(
        energyCost,
        support.card.energyColor,
      ),
    )
    .map((support) => ({ card: support.card, instanceId: support.card.instanceId }))
  const paymentUnavailableWarning =
    energyCostTotal > 0 &&
    selectEnergyPayment(
      energyCost,
      game.players[viewerPlayerId].supportArea,
    ) === null
      ? `目前沒有足夠的可支付${Object.entries(energyCost)
          .filter(([, amount]) => (amount ?? 0) > 0)
          .map(([color]) => `${energyColorLabel[color] ?? color}`)
          .join('、')}能量，無法執行攻擊後效果，請選擇「略過」。`
      : null
  const supportToHandCandidates =
    supportToHandCost === 0
      ? []
      : game.players[viewerPlayerId].supportArea
          .filter(
            (support) =>
              pending.cost.supportToHandType === undefined ||
              support.card.type === pending.cost.supportToHandType,
          )
          .map((support) => ({ card: support.card, instanceId: support.card.instanceId }))

  return {
    sourceCard: game.players[viewerPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === pending.sourceInstanceId,
    )?.card,
    sourceCardName: pending.sourceCardName,
    effectText: pending.effectText,
    discardHandCost,
    supportToHandCost,
    hpToTrashCost,
    hpToTrashCandidates,
    trashToDeckCost,
    trashToDeckCandidates,
    energyCostTotal,
    costText: describeCost(
      energyCost,
      discardHandCost,
      supportToHandCost,
      hpToTrashCost,
      trashToDeckCost,
    ),
    playerHand: game.players[viewerPlayerId].hand,
    supportCandidates,
    supportToHandCandidates,
    targetCandidates,
    needsTarget,
    targetMin,
    targetMax,
    targetLabel,
    targetInstruction,
    unmetConditionWarning: getUnmetConditionWarning(
      game,
      viewerPlayerId,
      pending.sourceInstanceId,
      pending.effects,
    ),
    paymentUnavailableWarning,
  }
}
