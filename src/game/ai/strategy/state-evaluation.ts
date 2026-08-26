import type { PlayerView, CookieInBattleView } from '../../player-view'

export interface PublicStateEvaluationBreakdown {
  /** 終局勝負分；非終局為 0。 */
  terminal: number
  /** 雙方戰鬥區餅乾的存在價值差。 */
  board: number
  /** 公開攻擊力差，讓同 HP／張數的場面仍能分辨壓力。 */
  attack: number
  /** 雙方公開 HP 張數差。 */
  hp: number
  /** 手牌數差；只看張數，不讀對手手牌卡面。 */
  hand: number
  /** 我方支援區資源價值。 */
  resources: number
  /** 雙方 Break race 差。 */
  breakPressure: number
  /** 我方剩餘牌庫張數，作為公開續航訊號。 */
  deck: number
  /** 我方場景／Stage 公開存在價值。 */
  stage: number
  total: number
}

const sumBreakLevel = (cards: CookieInBattleView['card'][]): number =>
  cards.reduce((sum, card) => sum + card.level, 0)

const boardPresenceValue = (cookies: CookieInBattleView[]): number =>
  cookies.reduce((sum, cookie) => sum + 40 + cookie.card.level * 10, 0)

const attackPotentialValue = (cookies: CookieInBattleView[]): number =>
  cookies.reduce((sum, cookie) => sum + (cookie.card.attack ?? 0), 0)

/**
 * 只使用 PlayerView 的結構化公開欄位，將狀態評估拆成可稽核分項。
 * 權重沿用既有 Lv.3/Lv.4 基線；本次先拆解、不改變原始總分尺度。
 */
export const evaluatePlayerViewBreakdown = (
  view: PlayerView,
): PublicStateEvaluationBreakdown => {
  if (view.status === 'finished') {
    const terminal = !view.result
      ? 0
      : view.result.winnerId === view.viewerId
        ? 100000
        : -100000
    return {
      terminal,
      board: 0,
      attack: 0,
      hp: 0,
      hand: 0,
      resources: 0,
      breakPressure: 0,
      deck: 0,
      stage: 0,
      total: terminal,
    }
  }

  const { self, opponent } = view
  const board =
    boardPresenceValue(self.battleArea) -
    boardPresenceValue(opponent.battleArea)
  const attack =
    attackPotentialValue(self.battleArea) * 3 -
    attackPotentialValue(opponent.battleArea) * 3
  const hp =
    self.battleArea.reduce((sum, cookie) => sum + cookie.hpCount, 0) * 25 -
    opponent.battleArea.reduce((sum, cookie) => sum + cookie.hpCount, 0) * 25
  const hand = self.handCount * 6 - opponent.handCount * 3
  const resources =
    self.supportArea.filter((support) => !support.rested).length * 10 +
    self.supportArea.length * 4
  const breakPressure =
    -sumBreakLevel(self.breakArea) * 20 +
    sumBreakLevel(opponent.breakArea) * 20
  const deck = self.deckCount
  const stage = self.stage ? 8 : 0
  const total =
    board + attack + hp + hand + resources + breakPressure + deck + stage

  return {
    terminal: 0,
    board,
    attack,
    hp,
    hand,
    resources,
    breakPressure,
    deck,
    stage,
    total,
  }
}

export const evaluatePlayerView = (view: PlayerView): number =>
  evaluatePlayerViewBreakdown(view).total
