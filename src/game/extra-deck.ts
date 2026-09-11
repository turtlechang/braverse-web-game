import { GameRuleError } from './errors'
import { isEffectConditionMet } from './effects/targeting'
import { updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import { clearDepartedCookieModifiers } from './replacement'
import { hasCookieOnPlayEffects } from './skills'
import { finishWithDefeat } from './victory'
import type {
  CookieCard,
  CookieInBattle,
  ExtraDeckCard,
  GameState,
  PlayerId,
} from './types'

/** Comprehensive Rules 5-1-1：EXTRA Deck 的張數上限。 */
export const EXTRA_DECK_MAX_CARDS = 6
/** Comprehensive Rules 5-1-1-4：同一卡號在 EXTRA Deck 的張數上限。 */
export const EXTRA_DECK_MAX_COPIES_PER_CARD = 4

export interface ExtraDeckValidationResult {
  isValid: boolean
  valid: boolean
  errors: string[]
}

/**
 * 將 EXTRA Deck 的私有卡片實體化為可在戰鬥區運作的 Cookie。
 *
 * 實體化後仍保留 `extraDeckOrigin`，因此離場後不能被一般的手牌／休息區／
 * 棄牌區登場效果重複利用。Awaken 的覆蓋、HP 與昏厥去向由
 * `playExtraDeckCookie`／`getAwakenedFaintTrashCards` 處理，不能退化成一般登場。
 */
export const materializeExtraDeckCookie = (
  card: ExtraDeckCard,
): CookieCard => {
  if (
    card.level === undefined ||
    card.hp === undefined ||
    card.attack === undefined ||
    card.attackCost === undefined
  ) {
    throw new GameRuleError('EXTRA 卡缺少登場所需的等級、HP 或攻擊資料。')
  }

  return {
    id: card.id,
    instanceId: card.instanceId,
    name: card.name,
    type: 'cookie',
    level: card.level,
    hp: card.hp,
    attack: card.attack,
    attackCost: card.attackCost,
    ...(card.imageUrl ? { imageUrl: card.imageUrl } : {}),
    ...(card.cardColor ? { cardColor: card.cardColor } : {}),
    ...(card.energyColor ? { energyColor: card.energyColor } : {}),
    ...(card.keywords?.length ? { keywords: card.keywords } : {}),
    ...(card.effectText ? { effectText: card.effectText } : {}),
    ...(card.skill ? { skill: card.skill } : {}),
    ...(card.attackEnergyCost ? { attackEnergyCost: card.attackEnergyCost } : {}),
    ...(card.attackText ? { attackText: card.attackText } : {}),
    ...(card.attackEffects ? { attackEffects: card.attackEffects } : {}),
    ...(card.awakenHpBonus !== undefined
      ? { awakenHpBonus: card.awakenHpBonus }
      : {}),
    extraDeckOrigin:
      card.extraDeckPlayMode === 'awaken' || card.type === 'awakened'
        ? 'awakened'
        : 'extra',
  }
}

/**
 * EXTRA 登場後的共用狀態轉換。這個函式刻意放在 EXTRA 模組，讓一般玩家
 * 指令與「先支付 EXTRA 代價、再實體化」的待處理決策共用同一條規則路徑，
 * 避免付款後複製一份可分歧的登場／Awaken 邏輯。
 */
export const materializeExtraDeckCookieAfterEntryCost = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState => {
  const player = state.players[playerId]
  const extraDeckCard = (player.extraDeck ?? []).find(
    (candidate) => candidate.instanceId === instanceId,
  )
  if (!extraDeckCard) {
    throw new GameRuleError('找不到要從 EXTRA Deck 登場的餅乾。')
  }

  const deploymentCard = materializeExtraDeckCookie(extraDeckCard)
  const isAwaken = deploymentCard.extraDeckOrigin === 'awakened'
  const getAwakenTarget = () => {
    const requirement = extraDeckCard.awakenRequirement
    if (!requirement) return undefined
    return player.battleArea.find(
      (target) =>
        target.card.extraDeckOrigin !== 'awakened' &&
        target.card.name === requirement.targetName &&
        target.enteredFrom === requirement.playedFrom &&
        target.enteredTurn === state.turnNumber,
    )
  }

  if (isAwaken) {
    const target = getAwakenTarget()
    if (!target) {
      throw new GameRuleError('尚未符合此 Awakened 餅乾的覆蓋目標條件。')
    }

    const hpBonus = deploymentCard.awakenHpBonus
    if (!hpBonus || hpBonus < 1) {
      throw new GameRuleError('Awakened 餅乾缺少 HP+N 資料。')
    }

    const availableHpCards = player.deck.slice(0, hpBonus)
    const replacedBattleArea = player.battleArea.map((cookie) =>
      cookie.card.instanceId === target.card.instanceId
        ? {
            card: deploymentCard,
            hpCards: [...cookie.hpCards, ...availableHpCards],
            ...(cookie.faceUpHpCardInstanceIds
              ? { faceUpHpCardInstanceIds: cookie.faceUpHpCardInstanceIds }
              : {}),
            rested: false,
            battleEntryId:
              `${deploymentCard.instanceId}:battle:${state.nextBattleEntrySequence}`,
            enteredFrom: 'extra-deck' as const,
            enteredTurn: state.turnNumber,
            awakenedUnderlay: [
              target.card,
              ...(target.awakenedUnderlay ?? []),
            ],
            ...(target.equippedCards?.length
              ? { equippedCards: target.equippedCards }
              : {}),
          }
        : cookie,
    )
    const updatedState = clearDepartedCookieModifiers(
      updatePlayer(state, {
        ...player,
        deck: player.deck.slice(hpBonus),
        extraDeck: (player.extraDeck ?? []).filter(
          (candidate) => candidate.instanceId !== instanceId,
        ),
        battleArea: replacedBattleArea,
      }),
    )

    return resolveExtraDeckExhaustion(
      {
        ...updatedState,
        extraDeckPlayUsedThisTurn: true,
        nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
        pendingOnPlay:
          hasCookieOnPlayEffects(deploymentCard)
            ? {
                playerId,
                sourceInstanceId: deploymentCard.instanceId,
                origin: 'extra-deck',
              }
            : null,
      },
      playerId,
      {
        targetInstanceId: deploymentCard.instanceId,
        amount: hpBonus - availableHpCards.length,
      },
    )
  }

  const availableHpCards = player.deck.slice(0, deploymentCard.hp)
  const updatedState = updatePlayer(state, {
    ...player,
    deck: player.deck.slice(deploymentCard.hp),
    extraDeck: (player.extraDeck ?? []).filter(
      (candidate) => candidate.instanceId !== instanceId,
    ),
    battleArea: [
      ...player.battleArea,
      {
        card: deploymentCard,
        hpCards: availableHpCards,
        rested: false,
        battleEntryId:
          `${deploymentCard.instanceId}:battle:${state.nextBattleEntrySequence}`,
        enteredFrom: 'extra-deck',
        enteredTurn: state.turnNumber,
      },
    ],
  })

  return resolveExtraDeckExhaustion(
    {
      ...updatedState,
      extraDeckPlayUsedThisTurn: true,
      nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
      pendingOnPlay:
        hasCookieOnPlayEffects(deploymentCard)
          ? {
              playerId,
              sourceInstanceId: deploymentCard.instanceId,
              origin: 'extra-deck',
            }
          : null,
    },
    playerId,
    {
      targetInstanceId: deploymentCard.instanceId,
      amount: deploymentCard.hp - availableHpCards.length,
    },
  )
}

/** 牌庫耗盡時沿用一般抽牌／登場流程的 Refresh 裁決。 */
export const resolveExtraDeckExhaustion = (
  state: GameState,
  playerId: PlayerId,
  remainingHpSetup?: { targetInstanceId: string; amount: number },
): GameState => {
  if (state.players[playerId].deck.length > 0) {
    return state
  }

  if (getRefreshCandidates(state, playerId).length === 0) {
    return finishWithDefeat(state, playerId, 'refresh-unavailable')
  }

  return {
    ...state,
    pendingRefresh: {
      playerId,
      remainingDraws: 0,
      ...(remainingHpSetup && remainingHpSetup.amount > 0
        ? { remainingHpSetup: [remainingHpSetup] }
        : {}),
    },
  }
}

/**
 * 綜合規則 §9-4-2：Awakened Cookie 昏厥時，本體進 break，其餘卡進 trash。
 * 呼叫端依既有流程決定 HP 是否已在本次傷害中移出，避免重複放入 trash。
 */
export const getAwakenedFaintTrashCards = (
  cookie: CookieInBattle,
  includeHpCards: boolean,
) => [
  ...(cookie.card.extraDeckOrigin === 'awakened'
    ? (cookie.awakenedUnderlay ?? [])
    : []),
  ...(includeHpCards ? cookie.hpCards : []),
  ...(cookie.equippedCards ?? []),
]

/** 以既有的純函式條件裁決器檢查卡面 EXTRA 登場條件。 */
export const isExtraDeckPlayRequirementMet = (
  state: GameState,
  playerId: PlayerId,
  card: ExtraDeckCard,
): boolean =>
  card.playRequirement === undefined ||
  isEffectConditionMet(
    state,
    {
      sourcePlayerId: playerId,
      sourceInstanceId: card.instanceId,
      sourceCardName: card.name,
    },
    {
      kind: 'damage-all',
      amount: 0,
      side: 'self',
      condition: card.playRequirement,
    },
  )

/**
 * 僅驗證綜合規則 5-1-1 直接定義的 EXTRA Deck 構築條件。
 * 逐卡覆蓋條件、代價與禁限表仍由後續卡牌／賽制層處理。
 */
export const validateExtraDeck = (
  extraDeck: readonly ExtraDeckCard[],
): ExtraDeckValidationResult => {
  const errors: string[] = []
  const countsByCardNumber = new Map<string, number>()
  const instanceIds = new Set<string>()

  if (extraDeck.length > EXTRA_DECK_MAX_CARDS) {
    errors.push(
      `EXTRA Deck 最多只能放入 ${EXTRA_DECK_MAX_CARDS} 張，目前為 ${extraDeck.length} 張。`,
    )
  }

  for (const card of extraDeck) {
    if (
      (card.type !== 'extra' && card.type !== 'awakened') ||
      card.id.length === 0 ||
      card.instanceId.length === 0 ||
      card.name.length === 0
    ) {
      errors.push('EXTRA Deck 只能包含具有效識別資料的 EXTRA 或 Awakened 餅乾卡。')
      break
    }

    if (instanceIds.has(card.instanceId)) {
      errors.push('EXTRA Deck 內的卡片 instanceId 不可重複。')
      break
    }
    instanceIds.add(card.instanceId)

    countsByCardNumber.set(
      card.id,
      (countsByCardNumber.get(card.id) ?? 0) + 1,
    )
  }

  for (const [cardNumber, count] of countsByCardNumber) {
    if (count > EXTRA_DECK_MAX_COPIES_PER_CARD) {
      errors.push(
        `EXTRA Deck 中 ${cardNumber} 合計 ${count} 張，超過每卡最多 ${EXTRA_DECK_MAX_COPIES_PER_CARD} 張限制。`,
      )
    }
  }

  const isValid = errors.length === 0
  return { isValid, valid: isValid, errors }
}

/**
 * Comprehensive Rules 3-9-3：持有者可隨時自由調整自己的 EXTRA Deck 順序。
 * 呼叫端要負責只將持有者自己的牌區傳入；這個純函式不修改既有陣列。
 */
export const reorderExtraDeck = (
  extraDeck: readonly ExtraDeckCard[],
  orderedInstanceIds: readonly string[],
): ExtraDeckCard[] => {
  const cardsByInstanceId = new Map(
    extraDeck.map((card) => [card.instanceId, card]),
  )
  const hasExactCardSet =
    orderedInstanceIds.length === extraDeck.length &&
    new Set(orderedInstanceIds).size === extraDeck.length &&
    orderedInstanceIds.every((instanceId) => cardsByInstanceId.has(instanceId))

  if (!hasExactCardSet) {
    throw new GameRuleError(
      'EXTRA Deck 的重排結果必須剛好包含原本的每一張卡。',
    )
  }

  return orderedInstanceIds.map((instanceId) => cardsByInstanceId.get(instanceId)!)
}
