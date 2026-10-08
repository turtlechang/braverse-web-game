import type { PlayerSideView, PlayerView } from '../../player-view'
import type { EffectCondition, EnergyColor, GameCard } from '../../types'

export type PublicConditionState = 'met' | 'unmet' | 'unknown'

export interface PublicConditionAssessment {
  state: PublicConditionState
  detail: string
}

const met = (detail: string): PublicConditionAssessment => ({ state: 'met', detail })
const unmet = (detail: string): PublicConditionAssessment => ({ state: 'unmet', detail })
const unknown = (detail: string): PublicConditionAssessment => ({ state: 'unknown', detail })

const levelTotal = (side: PlayerSideView): number =>
  side.breakArea.reduce((total, card) => total + card.level, 0)

const includesKeyword = (card: GameCard, keyword: string): boolean =>
  card.keywords?.includes(keyword as never) ?? false

const matchesCard = (
  card: GameCard,
  options: {
    color?: EnergyColor
    keyword?: string
    minLevel?: number
    maxLevel?: number
  },
): boolean =>
  (!options.color || card.energyColor === options.color) &&
  (!options.keyword || includesKeyword(card, options.keyword)) &&
  (options.minLevel === undefined || (card.type === 'cookie' && card.level >= options.minLevel)) &&
  (options.maxLevel === undefined || (card.type === 'cookie' && card.level <= options.maxLevel))

const sideFor = (view: PlayerView, side: 'self' | 'opponent'): PlayerSideView =>
  side === 'self' ? view.self : view.opponent

const combineAll = (
  assessments: readonly PublicConditionAssessment[],
): PublicConditionAssessment => {
  if (assessments.some((assessment) => assessment.state === 'unmet')) {
    return unmet('至少一個公開前置尚未成立。')
  }
  if (assessments.every((assessment) => assessment.state === 'met')) {
    return met('所有公開前置均已成立。')
  }
  return unknown('部分前置需要非公開或事件歷程資訊。')
}

const combineAny = (
  assessments: readonly PublicConditionAssessment[],
): PublicConditionAssessment => {
  if (assessments.some((assessment) => assessment.state === 'met')) {
    return met('至少一個公開前置已成立。')
  }
  if (assessments.every((assessment) => assessment.state === 'unmet')) {
    return unmet('所有公開替代前置都尚未成立。')
  }
  return unknown('替代前置需要非公開或事件歷程資訊。')
}

/**
 * 只用 PlayerView 評估能由盤面、公開區域與張數證明的 EffectCondition。
 * 來源本身、隱藏卡面或未投影的歷程條件回傳 unknown；已公開投影的精確事件
 * 可直接評估，避免 AI 偽造已完成的 Combo 前置。
 */
export const assessPublicCondition = (
  view: PlayerView,
  condition: EffectCondition | undefined,
): PublicConditionAssessment => {
  if (!condition) return unknown('沒有可公開驗證的結構化前置。')
  switch (condition.kind) {
    case 'arena-cookie-placed-from-battle-to-deck-bottom-this-turn':
      return view.arenaCookiesPlacedFromBattleToDeckBottomThisTurn?.[sideFor(view, condition.side).id]
        ? met('本回合指定玩家戰鬥區的 Arena 餅乾已放入其牌庫底。')
        : unmet('本回合尚未有指定玩家戰鬥區的 Arena 餅乾放入其牌庫底。')
    case 'player-started-second':
      return view.firstPlayerId !== view.viewerId
        ? met('開局為後攻玩家。')
        : unmet('開局為先攻玩家。')
    case 'all-of':
      return combineAll(condition.conditions.map((child) => assessPublicCondition(view, child)))
    case 'any-of':
      return combineAny(condition.conditions.map((child) => assessPublicCondition(view, child)))
    case 'break-level-at-least':
      return levelTotal(view.self) >= condition.level
        ? met('己方休息區 LV 已達門檻。')
        : unmet('己方休息區 LV 尚未達門檻。')
    case 'break-level-at-most':
      return levelTotal(view.self) <= condition.level
        ? met('己方休息區 LV 未超過門檻。')
        : unmet('己方休息區 LV 已超過門檻。')
    case 'opponent-break-level-at-most':
      return levelTotal(view.opponent) <= condition.level
        ? met('對手休息區 LV 未超過門檻。')
        : unmet('對手休息區 LV 已超過門檻。')
    case 'break-level-higher-than-opponent': {
      const requiredDifference = condition.minDifference ?? 1
      return levelTotal(view.self) - levelTotal(view.opponent) >= requiredDifference
        ? met('己方休息區 LV 領先已達門檻。')
        : unmet('己方休息區 LV 領先尚未達門檻。')
    }
    case 'support-count-at-least': {
      const count = view.self.supportArea.filter((support) =>
        (!condition.restedOnly || support.rested) &&
        (!condition.keyword || includesKeyword(support.card, condition.keyword)),
      ).length
      return count >= condition.count
        ? met('己方支援區張數已達門檻。')
        : unmet('己方支援區張數尚未達門檻。')
    }
    case 'support-color-count-at-least': {
      const count = view.self.supportArea.filter((support) =>
        support.card.energyColor === condition.color,
      ).length
      return count >= condition.count
        ? met('己方指定色支援數已達門檻。')
        : unmet('己方指定色支援數尚未達門檻。')
    }
    case 'support-count-at-most':
      return view.self.supportArea.length <= condition.count
        ? met('己方支援區張數未超過門檻。')
        : unmet('己方支援區張數已超過門檻。')
    case 'opponent-support-count-at-least':
      return view.opponent.supportArea.length >= condition.count
        ? met('對手支援區張數已達門檻。')
        : unmet('對手支援區張數尚未達門檻。')
    case 'stage-has-card': {
      const side = sideFor(view, condition.side)
      return side.stage?.card.name === condition.cardName
        ? met('指定場景區存在指定卡名。')
        : unmet('指定場景區沒有指定卡名。')
    }
    case 'active-support-count-at-least':
      return view.self.supportArea.filter((support) => !support.rested).length >= condition.count
        ? met('己方活躍支援數已達門檻。')
        : unmet('己方活躍支援數尚未達門檻。')
    case 'all-support-rested': {
      const side = sideFor(view, condition.side)
      return side.supportArea.every((support) => support.rested)
        ? met('指定支援區全部已休息。')
        : unmet('指定支援區仍有活躍卡。')
    }
    case 'support-keyword-at-least':
      return view.self.supportArea.filter((support) => includesKeyword(support.card, condition.keyword)).length >= condition.count
        ? met('己方指定關鍵字支援數已達門檻。')
        : unmet('己方指定關鍵字支援數尚未達門檻。')
    case 'support-count-less-than-opponent':
      return view.self.supportArea.length + condition.difference < view.opponent.supportArea.length
        ? met('己方支援區落後對手的差距已達門檻。')
        : unmet('己方支援區落後對手的差距尚未達門檻。')
    case 'trash-count-at-least':
      return view.self.discardPile.length >= condition.count
        ? met('己方棄牌區張數已達門檻。')
        : unmet('己方棄牌區張數尚未達門檻。')
    case 'trash-count-at-most':
      return view.self.discardPile.length <= condition.count
        ? met('己方棄牌區張數未超過門檻。')
        : unmet('己方棄牌區張數已超過門檻。')
    case 'opponent-trash-count-at-least':
      return view.opponent.discardPile.length >= condition.count
        ? met('對手棄牌區張數已達門檻。')
        : unmet('對手棄牌區張數尚未達門檻。')
    case 'trash-color-count-at-least':
      return view.self.discardPile.filter((card) => card.energyColor === condition.color).length >= condition.count
        ? met('己方指定色棄牌數已達門檻。')
        : unmet('己方指定色棄牌數尚未達門檻。')
    case 'trash-keyword-count-at-least':
      return view.self.discardPile.filter((card) => includesKeyword(card, condition.keyword)).length >= condition.count
        ? met('己方指定關鍵字棄牌數已達門檻。')
        : unmet('己方指定關鍵字棄牌數尚未達門檻。')
    case 'trash-blocker-cookie-count-at-least':
      return view.self.discardPile.filter(card => card.type === 'cookie' && card.skill?.trigger === 'block').length >= condition.count
        ? met('己方棄牌區 Blocker 餅乾數已達門檻。')
        : unmet('己方棄牌區 Blocker 餅乾數尚未達門檻。')
    case 'trash-flip-count-at-least':
      return view.self.discardPile.filter((card) => Boolean(card.flip)).length >= condition.count
        ? met('己方 FLIP 棄牌數已達門檻。')
        : unmet('己方 FLIP 棄牌數尚未達門檻。')
    case 'hand-count-at-least':
      return view.hand.length >= condition.count
        ? met('己方手牌張數已達門檻。')
        : unmet('己方手牌張數尚未達門檻。')
    case 'hand-count-at-most':
      return view.hand.length <= condition.count
        ? met('己方手牌張數未超過門檻。')
        : unmet('己方手牌張數已超過門檻。')
    case 'opponent-hand-count-at-least':
      return view.opponent.handCount >= condition.count
        ? met('對手公開手牌張數已達門檻。')
        : unmet('對手公開手牌張數尚未達門檻。')
    case 'opponent-battle-area-cookie-count':
      return view.opponent.battleArea.length === condition.count
        ? met('對手戰鬥區餅乾數符合門檻。')
        : unmet('對手戰鬥區餅乾數不符合門檻。')
    case 'opponent-has-cookie-with-level':
      return view.opponent.battleArea.some((cookie) => cookie.card.level === condition.level)
        ? met('對手戰鬥區存在指定 LV 餅乾。')
        : unmet('對手戰鬥區沒有指定 LV 餅乾。')
    case 'battle-area-has-cookie-with-level': {
      const side = sideFor(view, condition.side)
      return side.battleArea.some((cookie) => cookie.card.level === condition.level)
        ? met('指定戰鬥區存在指定 LV 餅乾。')
        : unmet('指定戰鬥區沒有指定 LV 餅乾。')
    }
    case 'battle-area-has-cookie-with-min-level': {
      const side = sideFor(view, condition.side)
      return side.battleArea.some((cookie) => cookie.card.level >= condition.minLevel)
        ? met('指定戰鬥區存在達到最低 LV 的餅乾。')
        : unmet('指定戰鬥區沒有達到最低 LV 的餅乾。')
    }
    case 'battle-area-cookie-level-sum-at-least': {
      const side = sideFor(view, condition.side)
      const levelSum = side.battleArea.reduce((total, cookie) => total + cookie.card.level, 0)
      return levelSum >= condition.level
        ? met('指定戰鬥區 LV 總和已達門檻。')
        : unmet('指定戰鬥區 LV 總和尚未達門檻。')
    }
    case 'battle-area-has-cookie-with-level-and-remaining-hp': {
      const side = sideFor(view, condition.side)
      return side.battleArea.some((cookie) =>
        cookie.card.level >= condition.minLevel &&
        (condition.maxLevel === undefined || cookie.card.level <= condition.maxLevel) &&
        cookie.hpCount === condition.remainingHp,
      )
        ? met('指定戰鬥區存在符合 LV 與剩餘 HP 的餅乾。')
        : unmet('指定戰鬥區沒有符合 LV 與剩餘 HP 的餅乾。')
    }
    case 'battle-area-has-color': {
      if (condition.excludeSource) return unknown('條件需要辨識來源實體。')
      const side = sideFor(view, condition.side)
      return side.battleArea.some((cookie) => matchesCard(cookie.card, condition))
        ? met('指定戰鬥區存在符合顏色條件的餅乾。')
        : unmet('指定戰鬥區沒有符合顏色條件的餅乾。')
    }
    case 'battle-area-has-keyword': {
      if (condition.excludeSource) return unknown('條件需要辨識來源實體。')
      const side = sideFor(view, condition.side)
      return side.battleArea.some((cookie) =>
        includesKeyword(cookie.card, condition.keyword) &&
        (condition.maxRemainingHp === undefined || cookie.hpCount <= condition.maxRemainingHp),
      )
        ? met('指定戰鬥區存在符合關鍵字條件的餅乾。')
        : unmet('指定戰鬥區沒有符合關鍵字條件的餅乾。')
    }
    case 'battle-area-has-named-cookie': {
      if (condition.excludeSource) return unknown('條件需要辨識來源實體。')
      const side = sideFor(view, condition.side)
      return side.battleArea.some((cookie) => cookie.card.name === condition.name &&
        (!condition.keyword || includesKeyword(cookie.card, condition.keyword)))
        ? met('指定戰鬥區存在指定名稱餅乾。')
        : unmet('指定戰鬥區沒有指定名稱餅乾。')
    }
    case 'break-area-has-card': {
      const side = sideFor(view, condition.side)
      return side.breakArea.some((card) => matchesCard(card, condition))
        ? met('指定休息區存在符合條件的餅乾。')
        : unmet('指定休息區沒有符合條件的餅乾。')
    }
    case 'break-area-card-count-at-least': {
      const side = sideFor(view, condition.side)
      return side.breakArea.filter((card) => matchesCard(card, condition)).length >= condition.count
        ? met('指定休息區符合條件的餅乾數已達門檻。')
        : unmet('指定休息區符合條件的餅乾數尚未達門檻。')
    }
    case 'battle-area-remaining-hp-count-at-least': {
      const side = sideFor(view, condition.side)
      return side.battleArea.filter((cookie) => cookie.hpCount === condition.remainingHp).length >= condition.count
        ? met('指定戰鬥區剩餘 HP 餅乾數已達門檻。')
        : unmet('指定戰鬥區剩餘 HP 餅乾數尚未達門檻。')
    }
    case 'battle-area-count-at-most':
      return view.self.battleArea.length <= condition.count
        ? met('己方戰鬥區張數未超過門檻。')
        : unmet('己方戰鬥區張數已超過門檻。')
    case 'any-battle-area-has-blocker':
      return [...view.self.battleArea, ...view.opponent.battleArea].some(
        (cookie) => cookie.card.skill?.trigger === 'block',
      )
        ? met('公開戰鬥區存在 Blocker。')
        : unmet('公開戰鬥區沒有 Blocker。')
    case 'opponent-battle-area-has-no-blocker':
      return view.opponent.battleArea.every((cookie) => cookie.card.skill?.trigger !== 'block')
        ? met('公開對手戰鬥區沒有 Blocker。')
        : unmet('公開對手戰鬥區存在 Blocker。')
    default:
      return unknown(`條件 ${condition.kind} 需要來源、事件歷程或非公開資訊。`)
  }
}
