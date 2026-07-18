import type { GameCard } from '../../game'
import { BattleRow, type BattleRowProps } from './BattleRow'
import { AttackPreviewArrow, type AttackPreviewArrowProps } from './AttackPreviewArrow'
import { PhaseRail, type PhaseRailProps } from '../layout/PhaseRail'
import { AttackPaymentPanel, type AttackPaymentPanelProps } from '../panels/GameStatusPanels'
import { CardPreviewPanel } from '../panels/InteractionOverlays'
import { RemoteActionBanner, type RemoteActionBannerProps } from '../panels/RemoteActionBanner'

/**
 * 本機與線上戰場共用的版面骨架:PhaseRail、雙方 BattleRow(含分隔列與攻擊
 * 預覽箭頭)、卡牌快速預覽、攻擊付款面板。只搬運 JSX 結構,不統一背後的
 * 資料推導——每個 prop 都是呼叫端(App.tsx / OnlineBattleView.tsx)依自己
 * 的 match/pending hook 組好之後傳入,BattleTable 本身不重新計算任何邏輯。
 *
 * 桌墊背景(`.board-texture`)刻意不搬進來:它是 `position: absolute; inset: 0`
 * 且無 z-index 的裝飾層,視覺堆疊順序依賴 DOM 順序,兩邊呼叫端都把它放在
 * `<main>` 最前面(StatusToast/活動列之前),搬進這裡會讓它排到那些元件
 * 後面、蓋住它們,因此維持由呼叫端各自渲染。
 */
export interface BattleTableProps {
  ariaLabel: string
  phaseRail: PhaseRailProps
  topBattleRow: BattleRowProps
  bottomBattleRow: BattleRowProps
  remoteActionBanner: RemoteActionBannerProps
  attackPreviewArrow: AttackPreviewArrowProps
  opponentPreviewCard: GameCard | null
  opponentPreviewContextLabel?: string
  hoveredCard: GameCard | null
  attackPaymentPanel: AttackPaymentPanelProps | null
}

export function BattleTable({
  ariaLabel,
  phaseRail,
  topBattleRow,
  bottomBattleRow,
  remoteActionBanner,
  attackPreviewArrow,
  opponentPreviewCard,
  opponentPreviewContextLabel,
  hoveredCard,
  attackPaymentPanel,
}: BattleTableProps) {
  return (
    <>
      <PhaseRail {...phaseRail} />

      <section className="table-area" aria-label={ariaLabel}>
        <BattleRow {...topBattleRow} />

        <div className="table-divider">
          <span />
          <RemoteActionBanner {...remoteActionBanner} />
          <span />
        </div>

        <AttackPreviewArrow {...attackPreviewArrow} />

        <BattleRow {...bottomBattleRow} />
      </section>

      <CardPreviewPanel
        card={opponentPreviewCard}
        position="top"
        contextLabel={opponentPreviewContextLabel}
      />
      <CardPreviewPanel card={hoveredCard} position="bottom" />

      {attackPaymentPanel && <AttackPaymentPanel {...attackPaymentPanel} />}
    </>
  )
}
