import type { GameCard, GameState } from '../../game'

/** 只從目前畫面已存在的狀態找卡牌，線上模式不會自行揭露未公開手牌。 */
export const findCardInGame = (
  game: GameState,
  instanceId: string | undefined,
): GameCard | undefined => {
  if (!instanceId) return undefined

  for (const player of Object.values(game.players)) {
    const found = [
      ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards]),
      ...player.supportArea.map((entry) => entry.card),
      ...player.breakArea,
      ...player.discardPile,
      ...(player.stage ? [player.stage.card] : []),
      ...player.hand,
      ...player.deck,
    ].find((card) => card.instanceId === instanceId)
    if (found) return found
  }

  return undefined
}
