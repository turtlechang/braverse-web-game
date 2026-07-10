# UI / UX 改版計畫（Redesign Plan）

最後更新：2026-07-10。**定位**：UI 已歷經多輪重製（滿版桌墊、PhaseRail、扇形手牌、統一效果 modal——見 CHANGELOG），本文件不是砍掉重練計畫，而是「記錄現行設計的定案 + 對標分析（[tcg-comparison.md](tcg-comparison.md)）萃取的下一步改進」，與 UI 迭代並行維護。

## 1. 現行設計定案（不重開的決策）

| 決策 | 內容 |
|---|---|
| 滿版桌墊 | 100vw×100vh 無捲軸畫布，深藍漸層底；桌機優先 |
| PhaseRail | 左側窄型五階段列 + 精確 CTA；<900px 改頂部階段列 + 底部工具列 |
| 場地比例 | 雙方固定 戰鬥區 55% / 支援區 45%，戰鬥卡靠中央分隔列 |
| 手牌 | 扇形；我方右切齊、對手左切齊（牌背 180°）；選取後才抬升顯示合法動作，`Escape` 取消 |
| 資源區 | 牌庫/場景/休息區為數字牌堆 + hover 浮層；棄牌與牌組清單用大型視窗 |
| 效果回應 | 深色置中提示框 + 可縮小 dock（陷阱/FLIP/物品/昏厥/抽牌/棄牌統一） |
| 中央分隔列 | 攻擊、付款與目標選擇提示集中於此 |
| 動畫 | 短促功能性（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小） |
| 拖放 | 暫不實作；未來只作輸入層、仍走規則 API |

## 2. 改進項（W 系列，依優先序）

### W1 全域卡牌放大預覽（高）

- 問題：支援區卡牌與對手戰鬥卡缺乏「兩步內讀全文」的放大途徑（目前僅我方戰鬥卡有 hover 預覽面板）。
- 方案：統一 hover（桌機）/長按（觸控）→ 右側或游標旁固定位置的放大卡面板；重用既有 `BattleRow` 預覽事件與卡牌詳情 modal 資料。
- 驗收：任一區域任一卡（含對手可見卡）皆可 2 步內讀到全文；不遮擋操作目標。

### W2 動畫可跳過（中）

- 方案：設定項「減少動畫」（同時尊重 `prefers-reduced-motion`），動畫時長歸零但保留結果狀態。
- 驗收：開啟後對局流程無等待感；Playwright 驗證不受影響。

### W3 甜點戰場質感（中）

- 方案：桌墊加低對比甜點紋理/暈影、卡牌兩層陰影（環境+接觸）、區域圓角統一 12px；accent 以糖果色點綴（見 style guide），僅裝飾不承載資訊。
- 驗收：1366×768 截圖對比前後；可讀性不下降（文字對比維持 AA）。

### W4 數值變化微回饋（低）

- 方案：HP/ATK 徽章數值變動時 200ms 縮放脈衝 + 顏色閃爍（增益綠/傷害紅）。

### W5 主選單氛圍（低）

- 方案：主選單加 logo 字標、牌組卡片縮圖化；維持現有 grid 資訊結構。

## 3. 驗收基準（全案通用，延續主計畫）

- 桌機 16:9 完整遊玩；1366×768 不爆版；最低 600×338 可操作。
- 手機/平板可瀏覽與簡化操作（現況：<900px 窄版模式；觸控深度優化列為後續，見 [ui-reference/05-mobile-rwd-wireframe.md](ui-reference/05-mobile-rwd-wireframe.md)）。
- 玩家不需要猜現在可以做什麼。
- 每個可點擊區域都有 hover / active / disabled 狀態。
- 戰鬥紀錄可收合；動畫可跳過（W2 完成後）。

## 4. 參考畫面

- Wireframe：[01 戰場](ui-reference/01-battlefield-wireframe.md)、[02 主選單](ui-reference/02-main-menu-wireframe.md)、[03 牌組編輯器](ui-reference/03-deck-editor-wireframe.md)、[04 卡牌 modal](ui-reference/04-card-modal-wireframe.md)、[05 行動裝置 RWD](ui-reference/05-mobile-rwd-wireframe.md)
- 可渲染 mockup（dev server 下以網址開啟，像 Figma 一樣審查）：
  - `/?mockup=battlefield` → `src/ui-reference/BattlefieldMockup.tsx`
  - `/?mockup=main-menu` → `src/ui-reference/MainMenuMockup.tsx`
  - `/?mockup=deck-editor` → `src/ui-reference/DeckEditorMockup.tsx`
  - mockup 呈現的是「現行版面 + W 系列改進套用後」的目標樣貌，供審查比對。
