# Controller、AI 與效果模組強化設計

## 目標

在不改變 Braverse 規則行為與既有公開 API 的前提下：

1. 修正藍色／紫色牌組在開局訊息中顯示成綠色的錯誤。
2. 將 `useMatchController` 的開局、動畫與攻擊責任拆成可獨立測試的 hooks。
3. 在 React 根節點加入錯誤邊界，避免 render 錯誤造成空白畫面。
4. 將 `takeAiStep` 改為依固定優先順序呼叫領域 handler 的 dispatcher。
5. 將 `effects.ts` 依目標選擇、戰鬥計算、效果執行與待決處理分組；保留 `CardEffect` discriminated union。
6. 以第一支 PR 驗證 GitHub Actions 與 Vercel Preview。

## 非目標

- 不加入未經 profiler 證明有需要的 `memo`、`useMemo` 或其他效能最佳化。
- 不導入 i18n 套件。
- 不改變卡牌規則、AI 策略、AI 決策優先順序或效果結算順序。
- 不提交 `review-output.txt`、`dist/`、`test-results/` 或認證資料。

## React 邊界

### `useMatchSetup`

負責開局階段狀態、牌組選擇、猜拳、先後攻、調度與起始餅乾。牌組名稱一律讀取既有 `deckChoiceLabel`，不再以三元運算維護第二份對照。

### `useMatchAnimations`

負責攻擊抖動、傷害閃爍、昏厥縮小與抽牌動畫。對外只接受前後 `GameState`，集中管理 timeout 並在 unmount/reset 時清除。

### `useBattleActions`

負責攻擊者、付款卡選取、付款驗證及宣告攻擊。規則合法性仍由 `src/game/energy.ts` 與公開戰鬥函式決定。

### `GameErrorBoundary`

在 `main.tsx` 包住 `App`。捕捉 render／生命週期錯誤，顯示正體中文 fallback 與重新載入按鈕；不宣稱捕捉事件處理函式或非同步 callback 錯誤。

## AI 邊界

`takeAiStep` 保持唯一公開入口，依下列順序呼叫回傳 `AiDecision | null` 的 handler：

1. 結束狀態
2. pending decision
3. pending battle
4. Refresh／補位／OnPlay
5. 非 AI 控制狀態
6. active／draw／support／main／end 階段
7. 統一錯誤轉換

handler 必須保持 deterministic，第一個回傳非 `null` 的決策即停止分派。`simulateAiMatch` 與既有公開型別仍由 `src/game/ai.ts` 匯出。

## 效果模組邊界

`src/game/effects.ts` 保留相容 façade，對外匯出名稱不變。內部依責任分成：

- `effects/targeting.ts`：候選目標、目標型別與條件判斷。
- `effects/combat.ts`：傷害結果與攻防修正計算。
- `effects/execute.ts`：`executeCardEffect` 與效果狀態轉換。
- `effects/pending.ts`：對手棄牌與檢視牌庫等待決結算。

`CardEffect` 與 `TargetedCardEffect` 繼續以 `src/game/types.ts` 為單一真實來源，不改用鬆散 registry。

## 驗證與交付

- 每個行為修正先建立會失敗的測試，再做最小實作。
- 純重構以既有行為測試加上新模組介面測試鎖定分派順序。
- 完成後執行 `npm test`、`npm run lint`、`npm run build` 與 `npm run test:ai:browser`。
- 建立 PR 後確認 GitHub CI 成功，取得並實際開啟 Vercel Preview；若平台登入或外部狀態阻擋，保留證據並明確回報。
