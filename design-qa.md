# 藍色基調桌面戰場設計 QA

- source visual truth: `C:\Users\WH3FTURTLE\Downloads\ChatGPT Image 2026年7月19日 下午10_55_13.png`
- implementation screenshot: `C:\Users\WH3FTURTLE\.codex\visualizations\2026\07\16\019f6927-54cb-7980-977f-53da4c492c59\blue-cookie-layout-implementation.png`
- full-view comparison evidence: `C:\Users\WH3FTURTLE\.codex\visualizations\2026\07\16\019f6927-54cb-7980-977f-53da4c492c59\blue-cookie-layout-comparison.png`
- viewport: 1672 × 943 px（來源圖由 1672 × 941 px 正規化至同高後並排）
- state: 本機 AI 對局、雙方已有起始餅乾、玩家位於支援階段。

**Findings**

- [P3] 參考圖的左右角色雕像與玩家徽章是情境裝飾，實作保留可讀性更高的玩家資訊與資源欄。
  Evidence: 並排比較可見雙方皆以中央戰區、左預覽、右回合欄與上下手牌構成相同視覺層級；依需求，實作使用既有深藍／青色基調，不複製參考圖的焦糖底色或角色插畫。
  Impact: 不影響卡牌操作、公開資訊或回合流程。
  Fix: 若下一輪要追求更高相似度，可再新增原創角色雕像與玩家徽章資產。

**Open Questions**

- 無。桌面版採原創裝飾資產，避免直接重製參考圖中的角色。

**Implementation Checklist**

1. 已保留既有藍色網格底色與深藍面板 token。
2. 已將中央戰場、左側焦點預覽、右側回合欄與扇形手牌收斂到同一桌遊構圖。
3. 已把手牌下移，避免遮住玩家戰鬥區卡牌。
4. 已完成開局到可操作對局的瀏覽器流程與 console 檢查。

**Follow-up Polish**

- 若需要更貼近參考圖，可額外加入原創的左右角色雕像、玩家徽章與戰鬥紀錄大按鈕。

## Comparison history

1. 初版比較發現下方扇形手牌覆蓋玩家戰鬥卡（P1）。將桌面版 `.hand-fan.bottom-hand` 下移後重新截圖，戰鬥卡完整可辨。
2. 依最新需求將桌面背景、中央區、側欄、焦點預覽與回合欄全部切回深藍／青色 token。
3. 最終並排檢查：版面層級、手牌位置、卡牌焦點與回合欄均保留；色彩基調的差異是使用者指定，無可操作的 P0／P1／P2 差異。
4. 焦點預覽改回僅在 hover／focus 卡牌時顯示，並移至桌面版左側 8px；相關元件測試確認未 hover 時不渲染面板。
5. 對方手牌改為支援區上方的小弧度卡背堆疊（露出約三分之一）；我方手牌改為支援區下方的小弧度堆疊（露出約三分之二），並只在 hover 個別卡牌時上移。

## Browser verification

- 主要操作：進入對戰入口 → 猜拳 → 保留手牌 → 選擇起始餅乾。
- console errors/warnings: 無。

final result: passed

## 2026-07-19 我方手牌參考圖比對

- source visual truth: `C:\Users\WH3FTURTLE\Downloads\螢幕擷取畫面 (800).png`
- implementation screenshot: In-app Browser capture of `http://127.0.0.1:5173/` (1600 × 720)
- state: 本機 AI 對戰的開局猜拳 modal 開啟；我方 6 張手牌仍完整可見於底部。
- full-view comparison evidence: 參考圖與 Browser 截圖皆顯示底部卡牌以橫向重疊、低弧度排列；實作將 5 張時的外側角度控制為 ±4.8°、外側高差 6px。
- focused region comparison: 底部我方手牌。參考圖只呈現此區域，且實作卡牌數不同，因此僅比較排列方式，不比較卡圖、背景或文案。

**Findings**

- 無 P0、P1 或 P2 差異。實作的卡片橫向展開、細微旋轉與底部裁切比例符合參考手牌的構圖。

**Open Questions**

- 無。

**Implementation Checklist**

1. 使用較寬的動態步距，讓五張手牌展開而非堆成窄扇形。
2. 將弧度降至 6px、旋轉降至每側最多 4.8°。
3. 保留 hover 上移、選取與既有底部裁切互動。

**Follow-up Polish**

- P3：若未來卡牌寬度調整，可連帶校正 `playerHandFan.ts` 的最大步距。

**Browser verification**

- 互動：從對戰入口進入本機 AI 對戰，確認我方 6 張手牌呈現於底部。
- console errors/warnings: 無。

final result: passed

## 2026-07-24 戰場 mockup 比對

- 參考圖：使用者提供的 `ChatGPT Image 2026年7月24日 下午05_19_38.png`
- prototype：本機 `/?mockup=battlefield`
- 檢視尺寸：1680 × 940

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| 深黑藍底色與科技桌墊氛圍 | 通過 | 原創 `public/mockup-cyber-tabletop.png` 提供低對比深藍桌墊；全畫面外框已移除，避免穿過手牌。 |
| 參考圖不直接作為背景或提交 | 通過 | 專案只引用原創生成資產，不使用參考圖片檔案。 |
| 戰鬥區卡片位置、單／雙卡間距與 HP dock | 通過 | mockup 直接渲染正式 `BattleTable` / `BattleRow`，沒有靜態複製版面。 |
| 卡片預覽與攻擊目標互動 | 通過 | 點選我方可攻擊餅乾後，正式的攻擊目標與卡片預覽會顯示。 |
| 視覺可讀性 | 通過 | 電路細節集中於外圍；戰鬥與支援列仍維持低對比背景，卡片、HP 與提示可辨識。 |

通過。參考圖的卡背、玩家頭像與各區塊編排沒有複製；mockup 刻意保留 Braverse 實機的正式結構，僅吸收其深黑藍、電光藍與科技桌墊的視覺語言。

## 2026-07-24 PR #70 背景色比較

- `/?mockup=battlefield` 的底色改用 PR #70 合併提交 `c722f7a` 的遊戲場漸層：`#0a367f → #123f90 → #08285f`，並同步使用原本的低透明白色菱格。
- 此視覺規格已同步套入實機 `src/App.css` 的桌面 `tactical-clean` 主題；戰場配置與 mockup 持續直接重用正式元件。

## 2026-07-24 場區雙層底色

- 檢視尺寸：1680 × 940；畫面狀態為雙方各兩張戰鬥餅乾與三張支援卡。
- 戰鬥區：`#0a2858 → #04142f`，中央保留低亮度藍色暈光，維持主戰場的最深層級。
- 支援區：`rgba(13, 62, 132, 0.88) → rgba(6, 33, 75, 0.92)`，亮一級且降低陰影，讀作次要的冷藍托盤。
- 結果：卡面、HP dock、中央「戰鬥區」文字與陣營邊框仍清楚可辨；只覆寫 mockup。

final result: passed

## 2026-07-24 敵我場區邊框識別

- 檢視尺寸：1680 × 940；維持雙方各兩張戰鬥餅乾與三張支援卡的 mockup 狀態。
- 對方場區：`rgba(255, 105, 120, 0.72)` 紅色外框與低強度紅暈光。
- 我方場區：`rgba(74, 213, 255, 0.78)` 青藍外框與低強度藍暈光。
- 結果：敵我場區可在不依賴名稱牌的情況下辨識；卡牌、HP dock 與戰鬥／支援區底色層級未被外框蓋過。

final result: passed

## 2026-07-24 戰鬥區完整外框

- 對方與我方戰鬥區皆改為完整四邊、`18px` 圓角外框，不再與中央分隔列共用透明邊。
- 1280 × 720 檢視確認：對方為紅色、我方為青藍色，圓角與全邊框均可見。

final result: passed

## 2026-08-10 Deck Editor QA

- 參考：使用者提供的 Master Duel 牌組編輯器截圖，以及同一輪的 Braverse 全頁編輯器截圖。
- 桌面版採固定三欄：左側卡牌資訊、中央主要牌組、右側卡池；牌組名稱與賽制移入中央欄，卡別統計與 JSON 操作移入右欄。
- 保留 Braverse 深藍桌面、卡牌圖像、黃色重點數字與既有中文資訊；不使用 Master Duel 的品牌素材。
- JSON 匯入展開後，取消與確認按鈕完整留在中央欄內，不會被右側卡池遮住或裁切。
- 390px 窄螢幕無水平溢位；836 張卡池固定高度並在面板內捲動。
- 自動化瀏覽器驗證涵蓋 1366×768 與 280×720 的搜尋、加卡上限、錯誤與合法 JSON 匯入、儲存流程。

final result: passed
