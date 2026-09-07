import { GameRuleError } from './errors'
import { isEffectConditionMet } from './effects/targeting'
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
