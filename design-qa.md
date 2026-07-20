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
