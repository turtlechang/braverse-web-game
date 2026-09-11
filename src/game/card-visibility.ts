import type { GameCard, PlayerId } from './types'

/** 公開槽位識別碼只編碼位置，不能包含隱藏卡的卡號、實體 ID 或牌面。 */
export const createHiddenCard = (label: string, index: number): GameCard => ({
  id: 'hidden',
  instanceId: `${label}-${index}`,
  name: '???',
  type: 'item',
})

export const maskCards = (cards: readonly GameCard[], label: string): GameCard[] =>
  cards.map((_, index) => createHiddenCard(label, index))

export const hiddenHandSlotId = (ownerId: PlayerId, index: number): string =>
  `${ownerId}-hidden-hand-${index}`
