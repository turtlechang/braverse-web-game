import { GameRuleError } from './errors'
import type { CookieInBattle, ExtraDeckCard, GameCard } from './types'

/** Attachments are discarded when the Cookie leaves without fainting. */
export const getNonFaintAttachmentTrash = (cookie: CookieInBattle): GameCard[] => [
  ...cookie.hpCards,
  ...(cookie.equippedCards ?? []),
  ...(cookie.awakenedUnderlay ?? []),
]

export const canReturnToMainDeckAsCost = (card: GameCard): boolean =>
  card.type !== 'cookie' || !card.extraDeckOrigin

/** A deck-return effect sends an EXTRA-origin body to its original EXTRA Deck. */
export const partitionDeckReturn = (cards: readonly GameCard[]): {
  mainDeck: GameCard[]
  extraDeck: ExtraDeckCard[]
} => {
  const mainDeck: GameCard[] = [], extraDeck: ExtraDeckCard[] = []
  for (const card of cards) {
    if (canReturnToMainDeckAsCost(card)) {
      mainDeck.push(card)
      continue
    }
    const original = card.type === 'cookie' ? card.extraDeckCard : undefined
    if (!original || original.instanceId !== card.instanceId || original.id !== card.id) {
      throw new GameRuleError('EXTRA 回牌庫效果缺少原始 EXTRA 卡片資料。')
    }
    extraDeck.push(original)
  }
  return { mainDeck, extraDeck }
}
