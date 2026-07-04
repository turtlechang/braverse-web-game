import { getOpponentId } from './helpers'
import type {
  AttackModifier,
  CookieCard,
  DamageReceivedModifier,
  GameCard,
  GameResult,
  GameStatus,
  PlayerId,
  GameState,
  StageCard,
  SupportCard,
  TurnPhase,
} from './types'

/**
 * 戰鬥區餅乾的可見資訊：HP 卡面朝下，雙方（含持有者）都只知道張數。
 */
export interface CookieInBattleView {
  card: CookieCard
  hpCount: number
  rested: boolean
  battleEntryId?: string
}

/**
 * 單一玩家側的公開資訊。牌庫與手牌只保留張數（手牌內容僅
 * viewer 自己的側可從 PlayerView.hand 取得）。
 */
export interface PlayerSideView {
  id: PlayerId
  name: string
  handCount: number
  deckCount: number
  battleArea: CookieInBattleView[]
  supportArea: SupportCard[]
  breakArea: CookieCard[]
  discardPile: GameCard[]
  stage: StageCard | null
}

/**
 * 以指定玩家視角過濾後的對局資訊。AI 策略與未來線上對戰的
 * state snapshot 應以此為輸入，用型別保證不讀取隱藏資訊。
 */
export interface PlayerView {
  viewerId: PlayerId
  hand: GameCard[]
  self: PlayerSideView
  opponent: PlayerSideView
  turnNumber: number
  phase: TurnPhase
  status: GameStatus
  activePlayerId: PlayerId
  firstPlayerId: PlayerId
  result: GameResult | null
  supportPlacedThisTurn: boolean
  attackModifiers: AttackModifier[]
  damageReceivedModifiers: DamageReceivedModifier[]
}

const toSideView = (
  state: GameState,
  playerId: PlayerId,
): PlayerSideView => {
  const player = state.players[playerId]
  return {
    id: player.id,
    name: player.name,
    handCount: player.hand.length,
    deckCount: player.deck.length,
    battleArea: player.battleArea.map((cookie) => ({
      card: cookie.card,
      hpCount: cookie.hpCards.length,
      rested: cookie.rested,
      battleEntryId: cookie.battleEntryId,
    })),
    supportArea: player.supportArea,
    breakArea: player.breakArea,
    discardPile: player.discardPile,
    stage: player.stage,
  }
}

export const createPlayerView = (
  state: GameState,
  viewerId: PlayerId,
): PlayerView => {
  const opponentId = getOpponentId(viewerId)
  return {
    viewerId,
    hand: state.players[viewerId].hand,
    self: toSideView(state, viewerId),
    opponent: toSideView(state, opponentId),
    turnNumber: state.turnNumber,
    phase: state.phase,
    status: state.status,
    activePlayerId: state.activePlayerId,
    firstPlayerId: state.firstPlayerId,
    result: state.result,
    supportPlacedThisTurn: state.supportPlacedThisTurn,
    attackModifiers: state.attackModifiers,
    damageReceivedModifiers: state.damageReceivedModifiers,
  }
}
