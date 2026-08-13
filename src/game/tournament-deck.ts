import { createDeckFromCustomDeck } from './custom-deck'
import type { CustomDeck } from './custom-deck'
import type { GameCard, PlayerId } from './types'

/**
 * 將 Swiss roster 的 metadata 與正式 CustomDeck 形狀隔離，避免 benchmark
 * metadata 被寫進規則層的牌組轉換邏輯。
 */
export const createCustomDeckFromRoster = (
  deck: CustomDeck,
  playerId: PlayerId,
): GameCard[] => createDeckFromCustomDeck(deck, playerId)
