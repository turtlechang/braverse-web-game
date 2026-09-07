import { getCookieEffectiveHp } from './helpers'
import type {
  ExtraDeckCard,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
} from './types'

/**
 * 線上對戰的遮罩版 GameState:型別上仍是完整 GameState,讓既有戰場 UI/規則函式
 * （BattleRow、EffectPanel、useMatchController 系列 hook）不用改就能吃。
 * 雙方牌庫與 HP 卡預設只有張數；只有自己的手牌與 EXTRA 可直接查看。
 * HP 重排決策僅對決策玩家開放已選定的卡堆，不能因此公開其他 HP。
 * 戰鬥區餅乾本體、支援區、破損區、棄牌區、場景區維持原樣(含真實 instanceId)。
 */

const createHiddenCard = (label: string, index: number): GameCard => ({
  id: 'hidden',
  instanceId: `${label}-${index}`,
  name: '???',
  type: 'item',
})

const maskCards = (cards: GameCard[], label: string): GameCard[] =>
  cards.map((_, index) => createHiddenCard(label, index))

const createHiddenExtraCard = (label: string, index: number): ExtraDeckCard => ({
  id: 'hidden-extra',
  instanceId: `${label}-${index}`,
  name: '???',
  type: 'extra',
})

const maskExtraDeck = (
  cards: ExtraDeckCard[],
  label: string,
): ExtraDeckCard[] =>
  cards.map((_, index) => createHiddenExtraCard(label, index))

const maskPlayerState = (
  player: PlayerState,
  viewerId: PlayerId,
  reorderTarget: NonNullable<GameState['pendingAbilityEffect']>['pendingReorderHp'],
): PlayerState => ({
  ...player,
  hand: player.id === viewerId
    ? player.hand
    : maskCards(player.hand, `${player.id}-hidden-hand`),
  deck: maskCards(player.deck, `${player.id}-hidden-deck`),
  extraDeck: player.id === viewerId
    ? player.extraDeck
    : maskExtraDeck(player.extraDeck ?? [], `${player.id}-hidden-extra`),
  battleArea: player.battleArea.map((entry) => ({
    ...entry,
    publicHp: getCookieEffectiveHp(entry),
    hpCards: reorderTarget?.targetPlayerId === player.id &&
      reorderTarget.targetInstanceId === entry.card.instanceId
      ? entry.hpCards
      : maskCards(
          entry.hpCards,
          `${player.id}-hidden-hp-${entry.card.instanceId}`,
        ),
  })),
})

export const maskGameStateForViewer = (
  state: GameState,
  viewerId: PlayerId,
): GameState => {
  const { hpInspectionResults, ...publicState } = state
  const reorderTarget = state.pendingAbilityEffect?.playerId === viewerId
    ? state.pendingAbilityEffect.pendingReorderHp
    : undefined

  const maskedInspect =
    state.pendingInspectDeck && state.pendingInspectDeck.playerId !== viewerId
      ? {
          ...state.pendingInspectDeck,
          revealedCards: maskCards(
            state.pendingInspectDeck.revealedCards,
            `${state.pendingInspectDeck.playerId}-hidden-inspect`,
          ),
        }
      : state.pendingInspectDeck

  return {
    ...publicState,
    players: {
      'player-one': maskPlayerState(state.players['player-one'], viewerId, reorderTarget),
      'player-two': maskPlayerState(state.players['player-two'], viewerId, reorderTarget),
    },
    pendingInspectDeck: maskedInspect,
    ...(hpInspectionResults?.[viewerId]
      ? { hpInspectionResults: { [viewerId]: hpInspectionResults[viewerId] } }
      : {}),
    // Command payloads are replay inputs, not public battle history. They may
    // contain private HP/deck ordering IDs or shuffle seeds even after masking.
    commandLog: state.commandLog?.map((entry) => ({
      ...entry,
      payload: { kind: entry.commandKind, playerId: entry.playerId },
    })),
  }
}
