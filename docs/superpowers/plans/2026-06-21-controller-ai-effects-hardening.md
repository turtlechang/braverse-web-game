# Controller, AI, and Effects Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly disabled subagent delegation for this work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正五色牌組訊息，拆分 React controller、AI dispatcher 與效果模組，加入根層錯誤邊界，並以 PR 驗證 Vercel Preview。

**Architecture:** 保留 `useMatchController`、`takeAiStep` 與 `effects.ts` 作為相容入口，將內部責任抽到具名 hooks／handlers／領域模組。所有遊戲規則仍由 `src/game/` 純函式決定，React 僅協調狀態與呈現。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Playwright 1.60。

---

### Task 1: 牌組選擇訊息回歸修正

**Files:**
- Create: `src/hooks/useMatchSetup.ts`
- Create: `src/hooks/useMatchSetup.test.tsx`
- Modify: `src/hooks/useMatchController.ts`

- [ ] 先測試 `formatDeckSelectionMessage('blue', 'purple')` 應包含「藍色」與「紫色」。
- [ ] 執行 `npm test -- src/hooks/useMatchSetup.test.tsx`，確認因 API 尚未存在而失敗。
- [ ] 以 `deckChoiceLabel` 實作訊息格式化，取代 controller 內三元運算。
- [ ] 重跑目標測試，確認紅、藍、紫案例通過。

### Task 2: 抽出開局流程

**Files:**
- Modify: `src/hooks/useMatchSetup.ts`
- Modify: `src/hooks/useMatchSetup.test.tsx`
- Modify: `src/hooks/useMatchController.ts`

- [ ] 建立 hook 測試，鎖定選牌後的 `deckConfig`、`setupStep='rps'` 與訊息。
- [ ] 將猜拳、先後攻、調度、起始餅乾與 `processAiOpeningHand` 移入 `useMatchSetup`。
- [ ] controller 組合 hook 回傳值，保持 App 使用的欄位名稱不變。
- [ ] 執行 setup hook 測試與所有 hooks 測試。

### Task 3: 抽出動畫狀態

**Files:**
- Create: `src/hooks/useMatchAnimations.ts`
- Create: `src/hooks/useMatchAnimations.test.tsx`
- Modify: `src/hooks/useMatchController.ts`

- [ ] 以 fake timers 測試前後狀態可觸發並在期限後清除動畫 ID。
- [ ] 實作 `observeTransition(previous, next)`、`resetAnimations()` 與 unmount timer cleanup。
- [ ] 將 `runAction` 中動畫差異判斷改呼叫動畫 hook。
- [ ] 執行動畫與 controller 相關測試。

### Task 4: 抽出攻擊互動

**Files:**
- Create: `src/hooks/useBattleActions.ts`
- Create: `src/hooks/useBattleActions.test.tsx`
- Modify: `src/hooks/useMatchController.ts`

- [ ] 測試合法付款可宣告攻擊，不合法付款不改變遊戲狀態。
- [ ] 移動攻擊者、付款選取、費用與付款驗證衍生狀態。
- [ ] 保持 `handleAttackTarget`、`toggleAttackPayment`、`clearAttacker` 等外部欄位相容。
- [ ] 執行 hooks 與戰鬥測試。

### Task 5: 根層 ErrorBoundary

**Files:**
- Create: `src/components/errors/GameErrorBoundary.tsx`
- Create: `src/components/errors/GameErrorBoundary.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.css`

- [ ] 測試子元件 render 拋錯時顯示 fallback，而正常子元件照常呈現。
- [ ] 實作 class error boundary、錯誤標題、說明與重新載入按鈕。
- [ ] 在 `StrictMode` 內、`App` 外包覆 error boundary。
- [ ] 執行目標測試、lint 與 build。

### Task 6: AI dispatcher 分組

**Files:**
- Create: `src/game/ai/types.ts`
- Create: `src/game/ai/pending-handler.ts`
- Create: `src/game/ai/battle-handler.ts`
- Create: `src/game/ai/turn-handler.ts`
- Modify: `src/game/ai.ts`
- Modify: existing `src/game/ai-*.test.ts` files as needed for import compatibility only

- [ ] 新增 dispatcher 順序測試，鎖定 pending decision 優先於 battle／phase。
- [ ] 移動 `AiAction`、`AiDecision`、`AiMatchResult` 等型別並由 `ai.ts` re-export。
- [ ] 依 pending、battle、turn 移動原分支，handler 只回傳 `AiDecision | null`。
- [ ] 讓 `takeAiStep` 依原順序短路分派並保留統一 catch。
- [ ] 執行全部 AI 單元測試與種子 1–20 模擬。

### Task 7: Effects 領域分組

**Files:**
- Create: `src/game/effects/targeting.ts`
- Create: `src/game/effects/combat.ts`
- Create: `src/game/effects/execute.ts`
- Create: `src/game/effects/pending.ts`
- Modify: `src/game/effects.ts`

- [ ] 先以既有效果測試鎖定 façade 匯出及主要行為。
- [ ] 依目標選擇、戰鬥計算、執行、待決處理移動程式碼。
- [ ] `effects.ts` 僅 re-export，所有既有 import 保持可編譯。
- [ ] 執行全部 effects、battle、commands、replacement 測試。

### Task 8: 文件、完整驗證與 PR

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md` only if verified test count changes

- [ ] 在保留既有 README 修改的前提下更新目前進度與下一步。
- [ ] 執行 `npm test`、`npm run lint`、`npm run build`、`npm run test:ai:browser`。
- [ ] 執行 `git diff --check`，檢查完整 diff 並排除 `review-output.txt` 與產物。
- [ ] 以英文 commit 訊息建立乾淨提交並 push 功能分支。
- [ ] 建立第一支 PR，等待 GitHub CI 與 Vercel Preview，實際開啟 Preview 驗證頁面載入與核心對局操作。
