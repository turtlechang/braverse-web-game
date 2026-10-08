import {
  getBreakCount,
  getBattleCookiePositionCostCandidates,
  getCookieToBreakCostCandidates,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getEnergyCostTotal,
  getDiscardHandCostCandidates,
  getRemainingEnergyCost,
  getHpToHandCostCandidates,
  getHpToTrashCostCandidates,
  getSupportEffectCandidates,
  getTrashToDeckCostCandidates,
  getTrashToDeckBottomCostCandidates,
  getExtraDeckTrashBattleCookieCostCandidates,
  getRefreshCandidates,
  isEffectConditionMet,
  isSupportToHandCostCandidate,
  isEnergyColorCompatibleWithCost,
  requiresEffectCardSelection,
  isFixedAttackTargetDamage,
  selectEnergyPayment,
  type CardEffect,
  type AbilityCost,
  type EnergyCost,
  type ExtraDeckCard,
  type GameCard,
  type GameState,
  type PlayerId,
} from '../../game'
import { energyColorLabel } from '../gameUiLabels'

export interface OptionalCostAttackPromptData {
  cookieBreakCost: number
  cookieBreakCandidates: { card: GameCard; instanceId: string; zone: 'hand' | 'battle' }[]
  sourceCard?: GameCard | ExtraDeckCard
  /** 來源餅乾可直接提供的能量；這是付款流程中的固定候選，不是支援區卡。 */
  sourceEnergy?: EnergyCost
  sourceCardName: string
  effectText: string
  /** `ability` 代表技能 Then 的可選效果，而非攻擊後續效果。 */
  resolution?: 'attack' | 'ability'
  /** 僅供明確規定不能略過的代價；一般 Then 代價維持可選。 */
  mandatory: boolean
  extraDeckEntry?: boolean
  conditionalSourcePlay?: boolean
  positionCost?: AbilityCost['battleCookiePosition']
  positionCostCandidates: { card: GameCard; instanceId: string }[]
  discardHandCost: number
  handCostDestination?: AbilityCost['handCostDestination']
  discardHandCandidates: { card: GameCard; instanceId: string }[]
  supportToHandCost: number
  supportToTrashCost: number
  supportToTrashCandidates: { card: GameCard; instanceId: string }[]
  hpToTrashCost: number
  hpToTrashCandidates: { card: GameCard; instanceId: string }[]
  hpToHandCost: number
  hpToHandCandidates: { card: GameCard; instanceId: string }[]
  trashToDeckCost: number
  trashToDeckDestination?: 'bottom'
  trashToDeckCandidates: { card: GameCard; instanceId: string }[]
  energyCostTotal: number
  playerHand: GameCard[]
  supportCandidates: { card: GameCard; instanceId: string }[]
  supportToHandCandidates: { card: GameCard; instanceId: string }[]
  targetCandidates: { card: GameCard; instanceId: string; requiresDiscardId?: string }[]
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
  /** 牌庫頂磨牌代價目前是否有可用的牌庫／Refresh 路徑。 */
  deckToTrashAvailable?: boolean
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
  sourceEnergy: EnergyCost | undefined,
  discardHandCost: number,
  supportToHandCost: number,
  supportToTrashCost: number,
  hpToTrashCost: number,
  hpToHandCost: number,
  selfToTrashCost: boolean,
  selfToBreakAreaCost: boolean,
  selfToDeckBottomCost: boolean,
  trashToDeckCost: number,
  deckToTrashCost: number,
  positionCost?: AbilityCost['battleCookiePosition'],
  discardHandKeyword?: AbilityCost['discardHandKeyword'],
  supportToHandKeyword?: AbilityCost['supportToHandKeyword'],
  discardHandType?: AbilityCost['discardHandType'],
): string => {
  const parts: string[] = []

  const sourceEnergyParts = (Object.keys(sourceEnergy ?? {}) as (keyof EnergyCost)[])
    .filter((key) => (sourceEnergy?.[key] ?? 0) > 0)
    .map(
      (key) =>
        `${sourceEnergy?.[key]} 點${energyColorLabel[key] ?? String(key)}能量`,
    )
  if (sourceEnergyParts.length > 0) {
    parts.push(`使用此餅乾作為 ${sourceEnergyParts.join('、')}`)
  }

  const energyParts = (Object.keys(remainingEnergy) as (keyof EnergyCost)[])
    .filter((key) => (remainingEnergy[key] ?? 0) > 0)
    .map(
      (key) =>
        `${remainingEnergy[key]} 點${energyColorLabel[key] ?? String(key)}能量`,
    )
  if (energyParts.length > 0) {
    parts.push(`支付支援區 ${energyParts.join('、')}`)
  }
  if (discardHandCost > 0) {
    const typeName = discardHandType ? { cookie: '餅乾', item: '道具', trap: '陷阱', stage: '場景' }[discardHandType] : ''
    parts.push(`棄置 ${discardHandCost} 張${discardHandKeyword === 'arena' ? '【Arena】' : discardHandKeyword === 'ancient' ? '【Ancient】' : ''}${typeName}手牌`)
  }
  if (supportToHandCost > 0) {
    const keyword = supportToHandKeyword === 'arena' ? '【Arena】' : supportToHandKeyword ? `【${supportToHandKeyword}】` : ''
    parts.push(`將 ${supportToHandCost} 張支援區${keyword}卡返回手牌`)
  }
  if (supportToTrashCost > 0) {
    parts.push(`將 ${supportToTrashCost} 張支援區卡送入棄牌區`)
  }
  if (hpToTrashCost > 0) parts.push(`棄置 ${hpToTrashCost} 張餅乾的 HP 卡`)
  if (hpToHandCost > 0) parts.push(`將 ${hpToHandCost} 張餅乾的 HP 卡返回手牌`)
  if (selfToTrashCost) parts.push('將此餅乾送入棄牌區')
  if (selfToBreakAreaCost) parts.push('將此餅乾放入休息區')
  if (selfToDeckBottomCost) parts.push('將此餅乾放到牌庫底')
  if (trashToDeckCost > 0) {
    parts.push(`將 ${trashToDeckCost} 張棄牌區卡洗回牌庫`)
  }
  if (deckToTrashCost > 0) {
    parts.push(`將牌庫頂 ${deckToTrashCost} 張卡放入棄牌區`)
  }
  if (positionCost) {
    parts.push(`將 ${positionCost.count} 張${positionCost.keyword === 'arena' ? ' Arena ' : ''}餅乾設為${positionCost.position === 'rested' ? '橫置' : '活躍'}`)
  }

  return parts.length > 0 ? parts.join('、') : '無'
}

/**
 * 攻擊後代價的目標要依「支付代價後」的區域判定。
 *
 * 休息區的來源餅乾是公開資訊，移入休息區的投影可用於選擇該公開目標。
 * 棄牌來源代價則可能公開隱藏 HP，必須由規則層實際支付後另開選牌，
 * 不得在唯讀投影中把 HP 牌面提前顯示。
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
  const projectsBreakToBattle =
    cost.selfToBreakArea === true && targetedEffect?.kind === 'break-to-battle'
  if (!projectsBreakToBattle) return game

  const player = game.players[viewerPlayerId]
  const source = player.battleArea.find(
    (cookie) => cookie.card.instanceId === sourceInstanceId,
  )
  if (!source) return game

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
  const isAbilityResolution = pending.resolution === 'ability'
  // EXTRA battle payment uses the existing targetIds selection channel; these
  // are cost Cookies, and the entry resolver validates them before deployment.
  const battleTrashCost = pending.extraDeckPlayInstanceId ? pending.cost.trashBattleCookie : undefined

  // Printed source-only movement uses the attacking Cookie automatically.
  // Keep these recipients out of the player choice, while exposing any
  // following selectable effect (such as BS4-029 break-to-battle).
  const targetedEffect = isAbilityResolution
    ? undefined
    : pending.effects.find(
        (effect) =>
          requiresEffectCardSelection(effect) &&
          !isFixedAttackTargetDamage(effect) &&
          !(effect.kind === 'battle-to-break' && effect.target.sourceOnly) &&
          !(effect.kind === 'field-to-deck-bottom' && !effect.hpOnly && effect.target.sourceOnly),
      )
  // A local payment step must never reveal hidden HP. Commit the source cost
  // first, then let pendingAbilityEffect select from the actual public Trash.
  const selectAfterSourcePayment = (
    pending.cost.selfToTrash === true && (targetedEffect?.kind === 'trash-to-hand' || targetedEffect?.kind === 'trash-to-battle')
  ) || (Boolean(pending.cost.cookieToBreakArea) && targetedEffect?.kind === 'break-to-battle' &&
    targetedEffect.excludeBreakPaymentCardNumber === true)
  const needsTarget = Boolean(battleTrashCost || (targetedEffect && !selectAfterSourcePayment))
  const targetSelectionState = getTargetSelectionState(
    game,
    viewerPlayerId,
    pending.sourceInstanceId,
    targetedEffect,
    pending.cost,
  )
  const targetCandidates: OptionalCostAttackPromptData['targetCandidates'] = (
    battleTrashCost ? getExtraDeckTrashBattleCookieCostCandidates(pending.cost, game.players[viewerPlayerId].battleArea, pending.sourceInstanceId).map(cookie => cookie.card)
    : targetedEffect && !selectAfterSourcePayment
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
  const targetMin = battleTrashCost?.count ?? selectionLimits?.min ?? 0
  const targetMax = battleTrashCost?.count ?? selectionLimits?.max ?? 1
  const targetSelector =
    targetedEffect && 'target' in targetedEffect ? targetedEffect.target : undefined
  // rest-support 的目標是支援區的卡，不是餅乾；依照目標面給出正確標籤，
  // 避免把「對手的支援區卡」顯示成「對手餅乾」。
  const targetLabel =
    battleTrashCost ? '己方戰鬥區代價餅乾' : targetedEffect?.kind === 'hand-to-support'
      ? `自己的手牌中的${
          energyColorLabel[targetedEffect.energyColor ?? ''] ?? '符合條件的'
        }卡牌`
      : targetedEffect?.kind === 'set-active'
      ? '己方支援區的卡'
      : targetedEffect?.kind === 'rest-support'
      ? targetedEffect.side === 'self'
        ? '己方支援區的卡'
        : '對手支援區的卡'
      : targetedEffect?.kind === 'opponent-battle-to-trash'
        ? '對手餅乾'
        : targetedEffect?.kind === 'break-to-battle'
          ? '己方休息區餅乾'
          : targetedEffect?.kind === 'trash-to-hand'
          ? targetedEffect.cookieOnly ? '己方棄牌區餅乾' : '己方棄牌區卡牌'
        : targetedEffect?.kind === 'trash-to-battle'
            ? '己方棄牌區餅乾'
            : targetedEffect?.kind === 'trash-to-deck'
              ? '棄牌區卡牌'
          : targetSelector?.side === 'self'
          ? '己方餅乾'
          : '對手餅乾'

  const targetInstruction =
    battleTrashCost ? `EXTRA 登場代價：選擇 ${targetMax} 張己方${energyColorLabel[battleTrashCost.energyColor ?? ''] ?? ''}${battleTrashCost.maxLevel === undefined ? '' : ` LV.${battleTrashCost.maxLevel} 以下`}戰鬥區餅乾，與 HP／裝備放入棄牌區`
    : targetedEffect?.kind === 'hand-to-support'
      ? `從自己的手牌選擇${targetMin === 0 ? '最多 ' : ''}${targetMax} 張${
          energyColorLabel[targetedEffect.energyColor ?? ''] ?? '符合條件的'
        }卡牌作為目標`
      : targetedEffect?.kind === 'set-active'
        ? `從自己的支援區選擇${targetMin === 0 ? '最多 ' : ''}${targetMax} 張卡牌，設為活躍`
        : undefined

  const costEnergy = pending.cost.energy ?? ({} as EnergyCost)
  const energyCost = getRemainingEnergyCost(costEnergy, pending.sourceEnergy)
  const energyCostTotal = getEnergyCostTotal(energyCost)
  const discardHandCost = pending.cost.discardHand ?? 0
  const positionCost = pending.cost.battleCookiePosition
  const cookieBreakCost = pending.cost.cookieToBreakArea?.count ?? 0
  const cookieBreakCandidates = getCookieToBreakCostCandidates(pending.cost, game.players[viewerPlayerId], pending.sourceInstanceId)
  const positionCostCandidates = getBattleCookiePositionCostCandidates(
    pending.cost, game.players[viewerPlayerId].battleArea, pending.sourceInstanceId,
  ).map(cookie => ({ card: cookie.card, instanceId: cookie.card.instanceId }))
  const discardHandCandidates = getDiscardHandCostCandidates(
    pending.cost,
    game.players[viewerPlayerId].hand,
    pending.sourceInstanceId,
  ).map((card) => ({ card, instanceId: card.instanceId }))
  // A selected exact-one hand payment can itself become a legal recovery.
  // Derive this option through the authoritative candidate helper using a
  // readonly payment projection; the printed card is never modified.
  if (targetedEffect?.kind === 'trash-to-hand' && discardHandCost === 1 && pending.cost.handCostDestination === undefined) {
    const player = game.players[viewerPlayerId]
    for (const entry of discardHandCandidates) {
      const projected: GameState = { ...game, players: { ...game.players, [viewerPlayerId]: {
        ...player,
        hand: player.hand.filter(card => card.instanceId !== entry.instanceId),
        discardPile: [...player.discardPile, entry.card],
      } } }
      const recovered = getEffectSelectionCandidates(projected, {
        sourcePlayerId: viewerPlayerId, sourceInstanceId: pending.sourceInstanceId,
      }, targetedEffect).find(card => card.instanceId === entry.instanceId)
      if (recovered) targetCandidates.push({ card: recovered, instanceId: recovered.instanceId, requiresDiscardId: entry.instanceId })
    }
  }
  const supportToHandCost = pending.cost.supportToHand ?? 0
  const supportToTrashCost = pending.cost.supportToTrash ?? 0
  const supportToTrashCandidates = supportToTrashCost === 0
    ? []
    : getSupportEffectCandidates(
        game,
        {
          sourcePlayerId: viewerPlayerId,
          sourceInstanceId: pending.sourceInstanceId,
        },
        {
          side: 'self',
          keyword: pending.cost.supportToTrashKeyword,
        },
      ).map((support) => ({ card: support.card, instanceId: support.card.instanceId }))
  const hpToTrashCost = pending.cost.hpToTrash ? 1 : 0
  const hpToTrashCandidates = hpToTrashCost
    ? getHpToTrashCostCandidates(
        pending.cost,
        game.players[viewerPlayerId].battleArea,
        pending.sourceInstanceId,
      ).map((cookie) => ({ card: cookie.card, instanceId: cookie.card.instanceId }))
    : []
  const hpToHandCost = pending.cost.hpToHand ? 1 : 0
  const hpToHandCandidates = hpToHandCost
    ? getHpToHandCostCandidates(
        pending.cost,
        game.players[viewerPlayerId].battleArea,
        pending.sourceInstanceId,
      ).map((cookie) => ({ card: cookie.card, instanceId: cookie.card.instanceId }))
    : []
  const trashToDeckCost = pending.cost.trashToDeckBottom?.count ?? pending.cost.trashToDeck?.count ?? 0
  const trashToDeckCandidates = trashToDeckCost
    ? (pending.cost.trashToDeckBottom ? getTrashToDeckBottomCostCandidates : getTrashToDeckCostCandidates)(
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
  const deckToTrashCost = pending.cost.deckToTrash?.amount ?? 0
  const deckToTrashAvailable =
    deckToTrashCost <= 0 ||
    game.players[viewerPlayerId].deck.length >= deckToTrashCost ||
    getRefreshCandidates(game, viewerPlayerId).length > 0
  const paymentUnavailableWarning =
    cookieBreakCandidates.length < cookieBreakCost
      ? '目前沒有足夠的合法餅乾可放入休息區作為代價，請選擇「略過」。'
      :
    positionCost && positionCostCandidates.length < positionCost.count
      ? '目前沒有足夠的餅乾可以支付狀態代價，請選擇「略過」。'
      : trashToDeckCandidates.length < trashToDeckCost
      ? `目前棄牌區沒有足夠的合法卡牌可支付代價，${pending.mandatory ? '此效果必須支付。' : '請選擇「略過」。'}`
      : !deckToTrashAvailable
      ? `目前牌庫不足以支付磨牌代價，且沒有可用的 Refresh，無法執行${pending.resolution === 'ability' ? '技能 Then 效果' : '攻擊後效果'}，${pending.mandatory ? '此效果必須支付。' : '請選擇「略過」。'}`
      : energyCostTotal > 0 &&
        selectEnergyPayment(
          energyCost,
          game.players[viewerPlayerId].supportArea,
        ) === null
      ? `目前沒有足夠的可支付${Object.entries(energyCost)
          .filter(([, amount]) => (amount ?? 0) > 0)
          .map(([color]) => `${energyColorLabel[color] ?? color}`)
          .join('、')}能量，無法執行${pending.resolution === 'ability' ? '技能 Then 效果' : '攻擊後效果'}，${pending.mandatory ? '此效果必須支付。' : '請選擇「略過」。'}`
      : null
  const sourceCard = game.players[viewerPlayerId].battleArea.find(
    (cookie) => cookie.card.instanceId === pending.sourceInstanceId,
  )?.card ?? game.players[viewerPlayerId].extraDeck?.find(
    (card) => card.instanceId === pending.sourceInstanceId,
  ) ?? game.players[viewerPlayerId].discardPile.find(
    (card) => card.instanceId === pending.sourceInstanceId,
  ) ?? game.players[viewerPlayerId].breakArea.find(
    (card) => card.instanceId === pending.sourceInstanceId,
  )
  const supportToHandCandidates =
    supportToHandCost === 0
      ? []
      : game.players[viewerPlayerId].supportArea
          .filter((support) => isSupportToHandCostCandidate(pending.cost, support))
          .map((support) => ({ card: support.card, instanceId: support.card.instanceId }))

  const basicCostText = describeCost(
    energyCost, pending.sourceEnergy, discardHandCost, supportToHandCost,
    supportToTrashCost, hpToTrashCost, hpToHandCost,
    pending.cost.selfToTrash === true, pending.cost.selfToBreakArea === true,
    pending.cost.selfToDeckBottom === true, trashToDeckCost, deckToTrashCost,
    positionCost, pending.cost.discardHandKeyword, pending.cost.supportToHandKeyword,
    pending.cost.discardHandType,
  )

  return {
    cookieBreakCost,
    cookieBreakCandidates,
    sourceCard,
    sourceEnergy: pending.sourceEnergy,
    sourceCardName: pending.sourceCardName,
    effectText: pending.effectText,
    resolution: pending.resolution,
    mandatory: pending.mandatory === true,
    extraDeckEntry: Boolean(pending.extraDeckPlayInstanceId),
    conditionalSourcePlay: pending.effects.some(effect => effect.kind === 'play-revealed-bottom-cookie'),
    positionCost,
    positionCostCandidates,
      discardHandCost,
      discardHandCandidates,
      handCostDestination: pending.cost.handCostDestination,
      supportToHandCost,
      supportToTrashCost,
      supportToTrashCandidates,
    hpToTrashCost,
    hpToTrashCandidates,
    hpToHandCost,
    hpToHandCandidates,
    trashToDeckCost,
    trashToDeckDestination: pending.cost.trashToDeckBottom ? 'bottom' : undefined,
    trashToDeckCandidates,
    energyCostTotal,
    costText: (pending.cost.trashToDeckBottom
      ? `將 ${trashToDeckCost} 張己方棄牌區${pending.cost.trashToDeckBottom.blockerOnly ? ' Blocker 餅乾' : '卡牌'}依選取順序放到牌庫底`
      : battleTrashCost ? targetInstruction : pending.effects.some(effect => effect.kind === 'reveal-bottom-deck' && effect.requireCard)
      ? [basicCostText === '無' ? '' : basicCostText, '展示 1 張牌庫底卡'].filter(Boolean).join('、')
      : pending.cost.handCostDestination === 'deck-bottom'
      ? `公開 ${discardHandCost} 張${pending.cost.discardHandLevel === undefined ? '' : ` LV.${pending.cost.discardHandLevel}`}${pending.cost.discardHandKeyword === 'arena' ? ' Arena' : ''} 餅乾手牌，將同一張牌放入牌庫底`
      : cookieBreakCost ? `從${pending.cost.cookieToBreakArea?.zones.map(zone => zone === 'hand' ? '手牌' : '己方戰鬥區').join('或')}將 ${cookieBreakCost} 張${pending.cost.cookieToBreakArea?.excludeSource ? '來源以外的 ' : ''}Arena 餅乾放入休息區${selectAfterSourcePayment ? '，支付後再選擇效果目標' : ''}` : '') || basicCostText,
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
    deckToTrashAvailable,
  }
}
